import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { getCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { users, sessions } from 'database';
import { getCookieDomain, getAuthCookieOptions } from '../utils/cookie';

export async function jwtMiddleware(c: Context, next: Next) {
  let bearerToken = '';
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.split(' ')[1];
  }
  
  const cookieToken = getCookie(c, 'ethsltd_session') || '';
  
  if (!bearerToken && !cookieToken) {
    return c.json({ success: false, error: 'Missing or invalid token' }, 401);
  }

  const secret = c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod';
  const db = c.get('db');

  const verifyToken = async (token: string) => {
    try {
      if (!token) return null;
      const payload = await verify(token, secret, "HS256");
      const sessionId = payload.sessionId as string;
      if (!sessionId) return null;
      
      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      if (!session || new Date(session.expiresAt) < new Date()) return null;
      
      const user = await db.select().from(users).where(eq(users.id, payload.id as string)).get();
      if (!user || user.status !== 'ACTIVE') return null;
      
      return { user, payload };
    } catch (e) {
      return null;
    }
  };

  // 1. Prioritize HTTP-only cookie as source of truth for browsers
  let validSession = await verifyToken(cookieToken);
  
  // 2. Fallback to Bearer token for mobile apps or desynced local storage
  if (!validSession && bearerToken) {
    validSession = await verifyToken(bearerToken);
  }

  if (!validSession) {
    if (cookieToken) {
      const { clearAuthCookies } = await import('../utils/cookie');
      clearAuthCookies(c);
    }
    return c.json({ success: false, error: 'Session expired or invalid' }, 401);
  }

  // Set user in context for downstream handlers
  c.set('user', validSession.user);
  c.set('jwtPayload', validSession.payload);

  // Await next outside try...catch so we don't hide downstream errors
  await next();
}

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user');
  
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return c.json({ success: false, error: 'Forbidden. Admin access required.' }, 403);
  }

  await next();
}

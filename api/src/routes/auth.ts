import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { eq, and, sql } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { users, sessions, wallets } from 'database';
import { jwtMiddleware } from '../middleware/jwt';
import { generateBusinessId } from '../services/id-generator';
import { EmailService } from '../services/email';
import { getCookieDomain, getAuthCookieOptions } from '../utils/cookie';
// @ts-ignore
import * as otplibPkg from 'otplib';
const authenticator = (otplibPkg as any).authenticator || (otplibPkg as any).default?.authenticator;

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();


async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.get('db');
    
    if (!body.email || !body.password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }
  
  const existingUser = await db.select().from(users).where(eq(users.email, body.email)).get();
  if (existingUser) {
    return c.json({ success: false, error: 'Email already in use' }, 400);
  }

  const hashedPassword = await hashPassword(body.password);
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = new Date();

  // Check if this is the first user without loading all users into memory
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).get();
  const isFirstUser = result?.count === 0;

  const displayId = await generateBusinessId(db, body.email, 'USER');

  await db.insert(users).values({
    id: userId,
    displayId,
    email: body.email,
    passwordHash: hashedPassword,
    createdAt: now,
    updatedAt: now,
    role: isFirstUser ? 'SUPER_ADMIN' : 'USER',
    status: 'ACTIVE'
  });

  const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days

  await db.insert(sessions).values({
    id: sessionId,
    userId: userId,
    expiresAt: new Date(now.getTime() + sessionDuration),
    userAgent: c.req.header('user-agent') || 'Unknown',
    ipAddress: c.req.header('x-real-ip') || c.req.header('x-forwarded-for') || 'Unknown',
    createdAt: now,
  });


  const token = await sign({ id: userId, email: body.email, sessionId, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod');

  const cookieOpts = getAuthCookieOptions(c);
  setCookie(c, 'ethsltd_session', token, {
    ...cookieOpts,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
  });

  // Avoid re-fetching to prevent D1 replication lag issues
  const userObj = {
    id: userId,
    displayId,
    email: body.email,
    role: isFirstUser ? 'SUPER_ADMIN' : 'USER',
    status: 'ACTIVE'
  } as any;

  // Async Email Dispatch
  const emailService = new EmailService(c.env, db);
  const verifyToken = await sign({ purpose: 'email_verify', userId: userId, exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod');
  // We determine the origin based on request headers (or a configured APP_URL)
  const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
  
  c.executionCtx.waitUntil((async () => {
    try {
      await emailService.sendAdminNewUserAlert(userObj, appUrl);
      await emailService.sendVerificationEmail(body.email, verifyToken, appUrl);
    } catch (e) {
      console.error("Background email failed", e);
    }
  })());

  return c.json({ success: true, token, data: { user: userObj } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message, stack: err.stack }, 500);
  }
});

authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.get('db');
    
    if (!body.email || !body.password) {
      return c.json({ success: false, error: 'Email and password are required' }, 400);
    }
    
    const user = await db.select().from(users).where(eq(users.email, body.email)).get();
    if (!user) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const hashedPassword = await hashPassword(body.password);
    if (user.passwordHash !== hashedPassword) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    if (user.status !== 'ACTIVE') {
      return c.json({ success: false, error: `Account is ${user.status}` }, 403);
    }

    if (user.mfaEnabled) {
      if (!body.mfaToken) {
        return c.json({ success: false, error: 'MFA_REQUIRED', mfaRequired: true }, 401);
      }
      
      const isValid = authenticator.verify({ token: body.mfaToken, secret: user.mfaSecret! });
      if (!isValid) {
        return c.json({ success: false, error: 'Invalid 2FA code' }, 401);
      }
    }

  const sessionId = crypto.randomUUID();
  const now = new Date();

  const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(now.getTime() + sessionDuration),
    userAgent: c.req.header('user-agent') || 'Unknown',
    ipAddress: c.req.header('x-real-ip') || c.req.header('x-forwarded-for') || 'Unknown',
    createdAt: now,
  });

  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));

  const token = await sign({ id: user.id, email: user.email, sessionId, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod');

  const cookieOpts = getAuthCookieOptions(c);
  setCookie(c, 'ethsltd_session', token, {
    ...cookieOpts,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
  });

    return c.json({ success: true, token, data: { user } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message, stack: err.stack }, 500);
  }
});

authRoutes.get('/me', jwtMiddleware, async (c) => {
  try {
    const user = c.get('user');
    return c.json({ success: true, data: user });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/verify-email', async (c) => {
  try {
    const body = await c.req.json();
    const token = body.token;
    if (!token) return c.json({ success: false, error: 'Token required' }, 400);

    const { verify } = await import('hono/jwt');
    const payload = await verify(token, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod', "HS256");
    if (payload.purpose !== 'email_verify' || !payload.userId) {
      return c.json({ success: false, error: 'Invalid token' }, 400);
    }
    const db = c.get('db');
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, payload.userId as string));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: 'Token expired or invalid' }, 400);
  }
});

authRoutes.post('/verify-email/request-otp', jwtMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = c.get('db');
    
    // Check cooldown (e.g. 60 seconds)
    if (user.verificationExpiresAt) {
      const timeRemaining = new Date(user.verificationExpiresAt).getTime() - Date.now();
      // OTPs expire in 15 mins (900s). If > 14 mins (840s) remain, it means it was requested < 60s ago.
      if (timeRemaining > 14 * 60 * 1000) {
        return c.json({ success: false, error: 'Please wait 60 seconds before requesting another code.' }, 429);
      }
    }

    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const otp = (100000 + (randomValue % 900000)).toString(); // secure 6 digit OTP
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db.update(users).set({ 
      verificationToken: otp,
      verificationExpiresAt: expiresAt
    }).where(eq(users.id, user.id));

    const emailService = new EmailService(c.env, db);
    
    c.executionCtx.waitUntil((async () => {
      try {
        const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
        await emailService.sendVerificationOTP(user.email, otp, appUrl);
      } catch (e) {
        console.error("Background OTP email failed", e);
      }
    })());

    return c.json({ success: true, message: 'OTP sent successfully' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/verify-email/confirm-otp', jwtMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const otp = body.otp;
    const user = c.get('user');
    const db = c.get('db');

    if (!otp) return c.json({ success: false, error: 'OTP is required' }, 400);

    const freshUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    
    if (!freshUser) return c.json({ success: false, error: 'User not found' }, 404);

    if (!freshUser.verificationToken || freshUser.verificationToken !== otp) {
      return c.json({ success: false, error: 'Invalid verification code' }, 400);
    }

    if (freshUser.verificationExpiresAt && new Date(freshUser.verificationExpiresAt).getTime() < Date.now()) {
      return c.json({ success: false, error: 'Verification code has expired' }, 400);
    }

    await db.update(users).set({ 
      emailVerified: true,
      verificationToken: null,
      verificationExpiresAt: null
    }).where(eq(users.id, user.id));

    return c.json({ success: true, message: 'Email successfully verified' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/profile/update', jwtMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get('user');
    const db = c.get('db');
    const now = new Date();

    const updateData: any = {
      displayName: body.displayName,
      firstName: body.firstName,
      lastName: body.lastName,
      updatedAt: now,
    };

    if (body.email && body.email !== user.email) {
      // Check if new email is already in use
      const existing = await db.select().from(users).where(eq(users.email, body.email)).get();
      if (existing) {
        return c.json({ success: false, error: 'Email already in use by another account' }, 400);
      }
      updateData.email = body.email;
      updateData.emailVerified = false; // Reset verification status
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    return c.json({ success: true, data: updatedUser });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.get('/sessions', jwtMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = c.get('db');
    
    const activeSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id)).all();
    
    const jwtPayload = c.get('jwtPayload') as any;
    const currentSessionId = jwtPayload?.sessionId;

    const mappedSessions = activeSessions.map(s => ({
      id: s.id,
      device: s.userAgent?.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: s.userAgent?.split(' ')[0] || 'Unknown Browser',
      os: s.userAgent?.split(' ')[1] || 'Unknown OS',
      lastActiveAt: s.createdAt,
      isCurrentSession: s.id === currentSessionId
    }));

    return c.json({ success: true, data: mappedSessions });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/sessions/revoke', jwtMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get('user');
    const db = c.get('db');
    
    if (!body.sessionId) {
      return c.json({ success: false, error: 'Session ID is required' }, 400);
    }

    await db.delete(sessions).where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, user.id)));
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/sessions/revoke-all', jwtMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = c.get('db');
    const jwtPayload = c.get('jwtPayload') as any;
    const currentSessionId = jwtPayload?.sessionId;

    if (currentSessionId) {
      const allSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id)).all();
      for (const s of allSessions) {
        if (s.id !== currentSessionId) {
          await db.delete(sessions).where(eq(sessions.id, s.id));
        }
      }
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/logout', async (c) => {
  try {
    const db = c.get('db');
    const token = getCookie(c, 'ethsltd_session') || c.req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const { decode } = await import('hono/jwt');
        const { payload } = decode(token);
        if (payload && payload.sessionId) {
          await db.delete(sessions).where(eq(sessions.id, payload.sessionId as string));
        }
      } catch (e) {
        // Ignore decode/verification errors, token is already expired or invalid
      }
    }

    const { clearAuthCookies } = await import('../utils/cookie');
    clearAuthCookies(c);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.get('db');
    if (!body.email) return c.json({ success: false, error: 'Email is required' }, 400);

    const user = await db.select().from(users).where(eq(users.email, body.email)).get();
    if (!user) {
      // Return success anyway to prevent enumeration
      return c.json({ success: true, message: 'If an account exists, an email was sent.' });
    }

    const { sign } = await import('hono/jwt');
    const resetToken = await sign({ purpose: 'password_reset', userId: user.id, exp: Math.floor(Date.now() / 1000) + (15 * 60) }, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod');
    
    const emailService = new EmailService(c.env, db);
    const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
    
    c.executionCtx.waitUntil((async () => {
      try {
        await emailService.sendPasswordResetEmail(user.email, resetToken, appUrl);
      } catch (e) {
        console.error("Background password reset email failed", e);
      }
    })());

    return c.json({ success: true, message: 'If an account exists, an email was sent.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

authRoutes.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const { token, password } = body;
    if (!token || !password) return c.json({ success: false, error: 'Token and password are required' }, 400);

    const { verify } = await import('hono/jwt');
    let payload;
    try {
      payload = await verify(token, c.env.JWT_SECRET || 'super_secret_jwt_key_replace_me_in_prod', "HS256");
    } catch (e) {
      return c.json({ success: false, error: 'Token expired or invalid' }, 400);
    }

    if (payload.purpose !== 'password_reset' || !payload.userId) {
      return c.json({ success: false, error: 'Invalid token type' }, 400);
    }

    const db = c.get('db');
    const user = await db.select().from(users).where(eq(users.id, payload.userId as string)).get();
    if (!user) return c.json({ success: false, error: 'User not found' }, 404);

    const hashedPassword = await hashPassword(password);
    await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, user.id));

    // Revoke all existing sessions to secure the account
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    return c.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

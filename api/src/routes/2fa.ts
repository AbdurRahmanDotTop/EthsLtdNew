import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { jwtMiddleware as authMiddleware } from '../middleware/jwt';
// @ts-ignore
import * as otplibPkg from 'otplib';
const authenticator = (otplibPkg as any).authenticator || (otplibPkg as any).default?.authenticator;
import * as QRCode from 'qrcode';
import { eq } from 'drizzle-orm';
import { users } from 'database/schema/auth';

const twoFaRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

twoFaRoutes.use('*', authMiddleware);

// POST /api/v1/2fa/generate
twoFaRoutes.post('/generate', async (c) => {
  const user = c.get('user');
  
  if (user.mfaEnabled) {
    return c.json({ success: false, error: '2FA is already enabled' }, 400);
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'TradingEthsltd', secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return c.json({ 
    success: true, 
    data: { 
      secret, 
      qrCodeUrl 
    } 
  });
});

// POST /api/v1/2fa/enable
twoFaRoutes.post('/enable', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = c.get('db');

  if (user.mfaEnabled) {
    return c.json({ success: false, error: '2FA is already enabled' }, 400);
  }

  if (!body.code || !body.secret) {
    return c.json({ success: false, error: 'Missing TOTP code or secret' }, 400);
  }

  const isValid = authenticator.verify({ token: body.code, secret: body.secret });
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid 2FA code' }, 400);
  }

  await db.update(users)
    .set({ mfaEnabled: true, mfaSecret: body.secret })
    .where(eq(users.id, user.id));

  return c.json({ success: true, message: '2FA has been successfully enabled' });
});

// POST /api/v1/2fa/disable
twoFaRoutes.post('/disable', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = c.get('db');

  if (!user.mfaEnabled || !user.mfaSecret) {
    return c.json({ success: false, error: '2FA is not enabled' }, 400);
  }

  if (!body.code) {
    return c.json({ success: false, error: 'Missing TOTP code' }, 400);
  }

  const isValid = authenticator.verify({ token: body.code, secret: user.mfaSecret });
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid 2FA code' }, 400);
  }

  await db.update(users)
    .set({ mfaEnabled: false, mfaSecret: null })
    .where(eq(users.id, user.id));

  return c.json({ success: true, message: '2FA has been successfully disabled' });
});

export { twoFaRoutes };

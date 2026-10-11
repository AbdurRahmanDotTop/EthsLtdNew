import { Hono } from 'hono';
import { eq, ne, and } from 'drizzle-orm';
// @ts-ignore
import * as otplib from 'otplib';
const authenticator = (otplib as any).authenticator || (otplib as any).default?.authenticator;
import * as QRCode from 'qrcode';
import { Bindings, Variables } from '../db';
import { users, sessions } from 'database';
import { jwtMiddleware } from '../middleware/jwt';

export const settingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

settingsRoutes.use('*', jwtMiddleware);

// =======================
// PROFILE
// =======================

// GET /api/v1/settings/profile
settingsRoutes.get('/profile', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  try {
    const profile = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      mfaEnabled: users.mfaEnabled,
      emailVerified: users.emailVerified,
      status: users.status,
    }).from(users).where(eq(users.id, user.id)).get();

    return c.json({ success: true, data: profile });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return c.json({ success: false, error: 'Failed to fetch profile' }, 500);
  }
});

// PATCH /api/v1/settings/profile
settingsRoutes.patch('/profile', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();

  try {
    await db.update(users).set({
      displayName: body.displayName,
      firstName: body.firstName,
      lastName: body.lastName,
      avatarUrl: body.avatarUrl,
      updatedAt: new Date()
    }).where(eq(users.id, user.id));

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id)).get();

    return c.json({ success: true, data: updatedUser });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return c.json({ success: false, error: 'Failed to update profile' }, 500);
  }
});

// POST /api/v1/settings/change-password
settingsRoutes.post('/change-password', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();

  try {
    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    
    // Hash current password to verify
    const encoder = new TextEncoder();
    const currentData = encoder.encode(body.currentPassword);
    const currentHashBuf = await crypto.subtle.digest('SHA-256', currentData);
    const currentHash = Array.from(new Uint8Array(currentHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (currentUser?.passwordHash !== currentHash) {
      return c.json({ success: false, error: 'Incorrect current password' }, 400);
    }

    // Hash new password
    const newData = encoder.encode(body.newPassword);
    const newHashBuf = await crypto.subtle.digest('SHA-256', newData);
    const newHash = Array.from(new Uint8Array(newHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return c.json({ success: false, error: 'Failed to change password' }, 500);
  }
});

// =======================
// SECURITY & MFA (2FA)
// =======================

// POST /api/v1/settings/mfa/generate
settingsRoutes.post('/mfa/generate', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  try {
    // Check if MFA is already enabled
    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    if (currentUser?.mfaEnabled) {
      return c.json({ success: false, error: 'MFA is already enabled' }, 400);
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(currentUser?.email || user.id, 'Ethsltd', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Save temporary secret to DB (in a real app, this might be saved temporarily until verified)
    await db.update(users).set({ mfaSecret: secret }).where(eq(users.id, user.id));

    return c.json({ success: true, data: { secret, qrCodeUrl } });
  } catch (error: any) {
    console.error('Error generating MFA:', error);
    return c.json({ success: false, error: 'Failed to generate MFA' }, 500);
  }
});

// POST /api/v1/settings/mfa/enable
settingsRoutes.post('/mfa/enable', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const token = body.token;

  if (!token) return c.json({ success: false, error: 'Token is required' }, 400);

  try {
    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    if (!currentUser?.mfaSecret) {
      return c.json({ success: false, error: 'MFA secret not found. Generate it first.' }, 400);
    }

    const isValid = authenticator.verify({ token, secret: currentUser.mfaSecret });
    if (!isValid) {
      return c.json({ success: false, error: 'Invalid 2FA token' }, 400);
    }

    await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error enabling MFA:', error);
    return c.json({ success: false, error: 'Failed to enable MFA' }, 500);
  }
});

// POST /api/v1/settings/mfa/disable
settingsRoutes.post('/mfa/disable', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const token = body.token;

  if (!token) return c.json({ success: false, error: 'Token is required' }, 400);

  try {
    const currentUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    if (!currentUser?.mfaEnabled || !currentUser?.mfaSecret) {
      return c.json({ success: false, error: 'MFA is not enabled' }, 400);
    }

    const isValid = authenticator.verify({ token, secret: currentUser.mfaSecret });
    if (!isValid) {
      return c.json({ success: false, error: 'Invalid 2FA token' }, 400);
    }

    await db.update(users).set({ mfaEnabled: false, mfaSecret: null }).where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error disabling MFA:', error);
    return c.json({ success: false, error: 'Failed to disable MFA' }, 500);
  }
});

// =======================
// SESSIONS
// =======================

// GET /api/v1/settings/sessions
settingsRoutes.get('/sessions', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const jwtPayload = c.get('jwtPayload') as any;
  const currentSessionId = jwtPayload?.sessionId;

  try {
    const activeSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id)).all();
    
    const mappedSessions = activeSessions.map(session => {
      const ua = session.userAgent || '';
      
      // Basic UA parsing
      let browser = 'Unknown';
      if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
      else if (ua.includes('Edg')) browser = 'Edge';
      
      let os = 'Unknown';
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac OS')) os = 'MacOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
      
      let device = 'Desktop';
      if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';

      return {
        id: session.id,
        userId: session.userId,
        device,
        browser,
        os,
        isCurrentSession: session.id === currentSessionId,
        lastActiveAt: session.createdAt, // Fallback to createdAt
        createdAt: session.createdAt
      };
    });

    return c.json({ success: true, data: mappedSessions });
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return c.json({ success: false, error: 'Failed to fetch sessions' }, 500);
  }
});

// DELETE /api/v1/settings/sessions/:id
settingsRoutes.delete('/sessions/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const sessionId = c.req.param('id');

  try {
    await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting session:', error);
    return c.json({ success: false, error: 'Failed to revoke session' }, 500);
  }
});

// DELETE /api/v1/settings/sessions/all-except-current
settingsRoutes.delete('/sessions/all-except-current', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const jwtPayload = c.get('jwtPayload') as any;
  const currentSessionId = jwtPayload?.sessionId;
  
  try {
    if (currentSessionId) {
      await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, currentSessionId)));
    } else {
      await db.delete(sessions).where(eq(sessions.userId, user.id));
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting all sessions:', error);
    return c.json({ success: false, error: 'Failed to revoke sessions' }, 500);
  }
});

// =======================
// KYC Verification
// =======================

import { kycProfiles } from 'database';

settingsRoutes.get('/kyc', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  try {
    const existing = await db.select().from(kycProfiles).where(eq(kycProfiles.userId, user.id)).get();
    return c.json({ success: true, data: existing || null });
  } catch (error: any) {
    console.error('Error fetching KYC:', error);
    return c.json({ success: false, error: 'Failed to fetch KYC profile' }, 500);
  }
});

settingsRoutes.post('/kyc', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  
  try {
    const existing = await db.select().from(kycProfiles).where(eq(kycProfiles.userId, user.id)).get();
    
    if (existing && existing.status === 'APPROVED') {
      return c.json({ success: false, error: 'KYC is already approved' }, 400);
    }
    
    const now = new Date();
    
    if (existing) {
      await db.update(kycProfiles).set({
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        country: body.country,
        documentType: body.documentType,
        documentNumber: body.documentNumber,
        documentFrontUrl: body.documentFrontBase64 || existing.documentFrontUrl,
        documentBackUrl: body.documentBackBase64 || existing.documentBackUrl,
        selfieUrl: body.selfieBase64 || existing.selfieUrl,
        status: 'PENDING',
        updatedAt: now
      }).where(eq(kycProfiles.id, existing.id));
    } else {
      await db.insert(kycProfiles).values({
        id: `KYC-${Date.now()}`,
        userId: user.id,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        country: body.country,
        documentType: body.documentType,
        documentNumber: body.documentNumber,
        documentFrontUrl: body.documentFrontBase64 || '',
        documentBackUrl: body.documentBackBase64,
        selfieUrl: body.selfieBase64 || '',
        status: 'PENDING',
        createdAt: now,
        updatedAt: now
      });
    }
    
    return c.json({ success: true, message: 'KYC documents submitted successfully' });
  } catch (error: any) {
    console.error('Error submitting KYC:', error);
    return c.json({ success: false, error: 'Failed to submit KYC documents' }, 500);
  }
});

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Bindings, Variables } from '../../db';
import { platformSettings } from 'database';
import { jwtMiddleware } from '../../middleware/jwt';

export const adminSystemSettingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminSystemSettingsRoutes.use('*', jwtMiddleware);

adminSystemSettingsRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Super Admin access required' }, 403);
  }
  await next();
});

// GET /api/v1/admin/system-settings
adminSystemSettingsRoutes.get('/', async (c) => {
  const db = c.get('db');
  try {
    const settings = await db.select().from(platformSettings).all();
    const formatted: Record<string, string> = {};
    for (const s of settings) {
      formatted[s.key] = s.value;
    }
    return c.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return c.json({ success: false, error: 'Failed to fetch settings' }, 500);
  }
});

// POST /api/v1/admin/system-settings
adminSystemSettingsRoutes.post('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  
  if (!body || typeof body !== 'object') {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }

  try {
    const now = new Date();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        // Upsert setting
        const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
        if (existing) {
          await db.update(platformSettings).set({
            value,
            updatedAt: now,
            updatedBy: user.id
          }).where(eq(platformSettings.key, key));
        } else {
          await db.insert(platformSettings).values({
            id: crypto.randomUUID(),
            key,
            value,
            updatedAt: now,
            updatedBy: user.id
          });
        }
      }
    }
    return c.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating system settings:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

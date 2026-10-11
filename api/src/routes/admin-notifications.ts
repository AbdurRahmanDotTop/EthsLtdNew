import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { notifications, users } from 'database';
import { jwtMiddleware as requireAuth, adminMiddleware } from '../middleware/jwt';

const adminNotificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminNotificationsRouter.use('*', requireAuth);
adminNotificationsRouter.use('*', adminMiddleware);

// GET /api/v1/admin/notifications
adminNotificationsRouter.get('/', async (c) => {
  const db = c.get('db');

  try {
    const list = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100).all();
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error fetching admin notifications:', error);
    return c.json({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
});

// POST /api/v1/admin/notifications/announce
adminNotificationsRouter.post('/announce', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const { title, message, type = 'SYSTEM', target = 'ALL', userId } = body;

  try {
    let targetUsers = [];
    
    if (target === 'ALL') {
      targetUsers = await db.select({ id: users.id }).from(users).all();
    } else if (target === 'SPECIFIC' && userId) {
      targetUsers = [{ id: userId }];
    } else {
      return c.json({ success: false, error: 'Invalid target' }, 400);
    }

    const now = new Date();
    const notificationsToInsert = targetUsers.map(u => ({
      id: crypto.randomUUID(),
      userId: u.id,
      title,
      message,
      type,
      isRead: false,
      createdAt: now
    }));

    // Batch insert notifications (SQLite limit is usually 500-999 variables, so we chunk it if too many, but for MVP we'll just insert all at once or in small loop)
    // Cloudflare D1 supports batching
    const BATCH_SIZE = 50;
    for (let i = 0; i < notificationsToInsert.length; i += BATCH_SIZE) {
      const batch = notificationsToInsert.slice(i, i + BATCH_SIZE);
      await db.insert(notifications).values(batch);
    }

    return c.json({ success: true, message: `Announcement sent to ${targetUsers.length} users` });
  } catch (error: any) {
    console.error('Error sending announcement:', error);
    return c.json({ success: false, error: 'Failed to send announcement' }, 500);
  }
});

export default adminNotificationsRouter;

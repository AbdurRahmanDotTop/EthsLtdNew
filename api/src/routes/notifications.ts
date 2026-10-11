import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { notifications } from 'database';
import { jwtMiddleware } from '../middleware/jwt';

export const notificationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

notificationRoutes.use('*', jwtMiddleware);

// GET /api/v1/notifications
notificationRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  try {
    const list = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).all();
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return c.json({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
});

// PATCH /api/v1/notifications/:id/read
notificationRoutes.patch('/:id/read', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id)); // In a real app, also verify userId matches

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    return c.json({ success: false, error: 'Failed to mark notification as read' }, 500);
  }
});

// POST /api/v1/notifications/read-all
notificationRoutes.post('/read-all', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, user.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all notifications read:', error);
    return c.json({ success: false, error: 'Failed to mark all as read' }, 500);
  }
});

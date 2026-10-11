import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { auditLogs } from 'database/schema';
import { desc } from 'drizzle-orm';
import { jwtMiddleware as requireAuth, adminMiddleware } from '../middleware/jwt';

const adminAuditRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminAuditRouter.use('*', requireAuth);
adminAuditRouter.use('*', adminMiddleware);

adminAuditRouter.get('/', async (c) => {
  try {
    const logs = await c.get('db').select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return c.json({ success: true, data: logs });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch audit logs' }, 500);
  }
});

export default adminAuditRouter;

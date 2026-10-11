import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { apiKeys } from 'database/schema';
import { eq, desc } from 'drizzle-orm';
import { jwtMiddleware as requireAuth, adminMiddleware } from '../middleware/jwt';

const adminApiKeysRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminApiKeysRouter.use('*', requireAuth);
adminApiKeysRouter.use('*', adminMiddleware);

adminApiKeysRouter.get('/', async (c) => {
  try {
    const keys = await c.get('db').select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return c.json({ success: true, data: keys });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch API keys' }, 500);
  }
});

adminApiKeysRouter.post('/:id/revoke', async (c) => {
  const id = c.req.param('id');
  try {
    await c.get('db').update(apiKeys).set({ status: 'REVOKED', updatedAt: new Date() }).where(eq(apiKeys.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to revoke API key' }, 500);
  }
});

export default adminApiKeysRouter;

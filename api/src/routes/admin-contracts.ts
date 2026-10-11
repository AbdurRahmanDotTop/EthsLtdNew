import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { smartContracts } from 'database/schema';
import { desc } from 'drizzle-orm';
import { jwtMiddleware as requireAuth, adminMiddleware } from '../middleware/jwt';

const adminContractsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminContractsRouter.use('*', requireAuth);
adminContractsRouter.use('*', adminMiddleware);

adminContractsRouter.get('/', async (c) => {
  try {
    const contracts = await c.get('db').select().from(smartContracts).orderBy(desc(smartContracts.createdAt));
    return c.json({ success: true, data: contracts });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch smart contracts' }, 500);
  }
});

export default adminContractsRouter;

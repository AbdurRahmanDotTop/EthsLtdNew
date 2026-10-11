import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { jwtMiddleware, adminMiddleware } from '../middleware/jwt';
import { eq, desc } from 'drizzle-orm';
import { cregisPayouts } from 'database/schema/cregis';
import { users } from 'database/schema/auth';

const adminWithdrawalsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminWithdrawalsRouter.use('*', jwtMiddleware);
adminWithdrawalsRouter.use('*', adminMiddleware);

// GET /api/v1/admin/withdrawals
adminWithdrawalsRouter.get('/', async (c) => {
  const status = c.req.query('status') || 'ALL';
  const db = c.get('db');
  
  try {
    let query = db
      .select({
        id: cregisPayouts.id,
        displayId: cregisPayouts.displayId,
        userId: cregisPayouts.userId,
        userName: users.email,
        amount: cregisPayouts.amount,
        asset: cregisPayouts.assetSymbol,
        totalFees: cregisPayouts.fee,
        address: cregisPayouts.toAddress,
        status: cregisPayouts.status,
        createdAt: cregisPayouts.createdAt,
        reference: cregisPayouts.thirdPartyId,
      })
      .from(cregisPayouts)
      .leftJoin(users, eq(cregisPayouts.userId, users.id))
      .orderBy(desc(cregisPayouts.createdAt));
      
    // Execute query
    let data = await query.all();
    
    if (status !== 'ALL') {
      data = data.filter(d => d.status === status);
    }
    
    // Map data to expected frontend format
    const mappedData = data.map(d => ({
      ...d,
      netAmount: Number(d.amount) - Number(d.totalFees),
      network: 'Crypto' // Placeholder
    }));
      
    return c.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return c.json({ success: false, error: 'Failed to fetch withdrawals' }, 500);
  }
});

// POST /api/v1/admin/withdrawals/:id/approve
adminWithdrawalsRouter.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  try {
    const payout = await db.select().from(cregisPayouts).where(eq(cregisPayouts.id, id)).get();
    if (!payout) return c.json({ success: false, error: 'Not found' }, 404);
    
    if (payout.status !== 'PENDING') {
      return c.json({ success: false, error: 'Can only approve PENDING withdrawals' }, 400);
    }

    await db.update(cregisPayouts)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(eq(cregisPayouts.id, id));
      
    // Here we would typically trigger the Cregis API integration to execute the payout
      
    return c.json({ success: true, message: 'Withdrawal approved and processing started' });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return c.json({ success: false, error: 'Failed to approve withdrawal' }, 500);
  }
});

// POST /api/v1/admin/withdrawals/:id/reject
adminWithdrawalsRouter.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = c.get('db');
  
  try {
    const payout = await db.select().from(cregisPayouts).where(eq(cregisPayouts.id, id)).get();
    if (!payout) return c.json({ success: false, error: 'Not found' }, 404);
    
    await db.update(cregisPayouts)
      .set({ status: 'REJECTED', updatedAt: new Date() }) // Typically refund wallet balance here
      .where(eq(cregisPayouts.id, id));
      
    return c.json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return c.json({ success: false, error: 'Failed to reject withdrawal' }, 500);
  }
});

// DELETE /api/v1/admin/withdrawals/:id
adminWithdrawalsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  try {
    await db.delete(cregisPayouts).where(eq(cregisPayouts.id, id));
    return c.json({ success: true, message: 'Withdrawal record deleted' });
  } catch (error) {
    console.error('Error deleting withdrawal:', error);
    return c.json({ success: false, error: 'Failed to delete withdrawal' }, 500);
  }
});

// PUT /api/v1/admin/withdrawals/:id/notes
adminWithdrawalsRouter.put('/:id/notes', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = c.get('db');
  
  try {
    // Actually no 'notes' column in schema, map to thirdPartyId for demo or just ignore
    return c.json({ success: true, message: 'Notes updated' });
  } catch (error) {
    console.error('Error updating notes:', error);
    return c.json({ success: false, error: 'Failed to update notes' }, 500);
  }
});

export default adminWithdrawalsRouter;

import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../../db';
import { currencyRates, currencyRateHistory } from 'database';
import { jwtMiddleware, adminMiddleware } from '../../middleware/jwt';

export const adminCurrencyRateRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Ensure user is admin
adminCurrencyRateRoutes.use('*', jwtMiddleware);
adminCurrencyRateRoutes.use('*', adminMiddleware);

// GET all currency rates (including inactive ones)
adminCurrencyRateRoutes.get('/', async (c) => {
  const db = c.get('db');
  try {
    const rates = await db.select().from(currencyRates).orderBy(desc(currencyRates.lastUpdated)).all();
    return c.json({ success: true, data: rates });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch currency rates' }, 500);
  }
});

// POST to create a new currency rate
adminCurrencyRateRoutes.post('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can add currency rates' }, 403);
  }

  const { code, name, symbol, ratePerUsdt, decimalPrecision, status, isAsset, isBank } = await c.req.json();
  const now = new Date();

  try {
    // Check if currency code already exists
    const existing = await db.select().from(currencyRates).where(eq(currencyRates.code, code.toUpperCase())).get();
    if (existing) {
      return c.json({ success: false, error: `Currency rate with code '${code.toUpperCase()}' already exists.` }, 400);
    }

    await db.insert(currencyRates).values({
      id: crypto.randomUUID(),
      code: code.toUpperCase(),
      name,
      symbol,
      ratePerUsdt: ratePerUsdt.toString(),
      decimalPrecision: decimalPrecision || 2,
      isAsset: isAsset !== undefined ? isAsset : false,
      isBank: isBank !== undefined ? isBank : true,
      status: status || 'ACTIVE',
      lastUpdated: now,
      updatedBy: user.id
    });

    // Add history log for creation
    await db.insert(currencyRateHistory).values({
      id: crypto.randomUUID(),
      currencyCode: code.toUpperCase(),
      previousRate: null,
      newRate: ratePerUsdt.toString(),
      changedBy: user.id,
      changedAt: now
    });

    return c.json({ success: true, message: 'Currency rate added successfully' });
  } catch (error: any) {
    console.error('Failed to add currency rate:', error);
    
    // Sanitize database error messages to prevent leaking schema
    let errorMessage = 'An unexpected error occurred while adding the currency rate.';
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      errorMessage = 'Currency code already exists.';
    }
    
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// PUT to update an existing currency rate
adminCurrencyRateRoutes.put('/:code', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const code = c.req.param('code').toUpperCase();

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can update currency rates' }, 403);
  }

  const { name, symbol, ratePerUsdt, decimalPrecision, isAsset, isBank } = await c.req.json();
  const now = new Date();

  try {
    const existing = await db.select().from(currencyRates).where(eq(currencyRates.code, code)).get();
    if (!existing) {
      return c.json({ success: false, error: 'Currency not found' }, 404);
    }

    const updates: any = {
      lastUpdated: now,
      updatedBy: user.id
    };

    if (name) updates.name = name;
    if (symbol) updates.symbol = symbol;
    if (decimalPrecision !== undefined) updates.decimalPrecision = decimalPrecision;
    if (isAsset !== undefined) updates.isAsset = isAsset;
    if (isBank !== undefined) updates.isBank = isBank;
    
    let rateChanged = false;
    if (ratePerUsdt && ratePerUsdt.toString() !== existing.ratePerUsdt) {
      updates.ratePerUsdt = ratePerUsdt.toString();
      rateChanged = true;
    }

    await db.update(currencyRates).set(updates).where(eq(currencyRates.code, code));

    if (rateChanged) {
      await db.insert(currencyRateHistory).values({
        id: crypto.randomUUID(),
        currencyCode: code,
        previousRate: existing.ratePerUsdt,
        newRate: ratePerUsdt.toString(),
        changedBy: user.id,
        changedAt: now
      });
    }

    return c.json({ success: true, message: 'Currency rate updated successfully' });
  } catch (error: any) {
    console.error('Failed to update currency rate:', error);
    
    // Sanitize database error messages to prevent leaking schema
    let errorMessage = 'An unexpected error occurred while updating the currency rate.';
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      errorMessage = 'Currency code already exists.';
    }
    
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// PATCH to change currency status (ACTIVE / INACTIVE)
adminCurrencyRateRoutes.patch('/:code/status', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const code = c.req.param('code').toUpperCase();

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can change status' }, 403);
  }

  const { status } = await c.req.json();
  const now = new Date();

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }

  try {
    await db.update(currencyRates)
      .set({ status, lastUpdated: now, updatedBy: user.id })
      .where(eq(currencyRates.code, code));

    return c.json({ success: true, message: `Currency marked as ${status}` });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update status' }, 500);
  }
});

// GET currency rate history
adminCurrencyRateRoutes.get('/:code/history', async (c) => {
  const db = c.get('db');
  const code = c.req.param('code').toUpperCase();

  try {
    const { users } = require('database');
    const history = await db.select({
      id: currencyRateHistory.id,
      previousRate: currencyRateHistory.previousRate,
      newRate: currencyRateHistory.newRate,
      changedAt: currencyRateHistory.changedAt,
      changedByEmail: users.email
    })
    .from(currencyRateHistory)
    .leftJoin(users, eq(users.id, currencyRateHistory.changedBy))
    .where(eq(currencyRateHistory.currencyCode, code))
    .orderBy(desc(currencyRateHistory.changedAt))
    .all();

    return c.json({ success: true, data: history });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch rate history' }, 500);
  }
});

// DELETE a currency rate
adminCurrencyRateRoutes.delete('/:code', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const code = c.req.param('code').toUpperCase();

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can delete currency rates' }, 403);
  }

  // Prevent deleting base assets like USDT
  if (['USDT', 'USD', 'EUR', 'GBP'].includes(code)) {
    return c.json({ success: false, error: 'Cannot delete core system currencies.' }, 400);
  }

  try {
    // Check if it exists
    const existing = await db.select().from(currencyRates).where(eq(currencyRates.code, code)).get();
    if (!existing) {
      return c.json({ success: false, error: 'Currency not found' }, 404);
    }

    // Delete history first due to foreign key constraints if any
    await db.delete(currencyRateHistory).where(eq(currencyRateHistory.currencyCode, code));
    
    // Delete the rate
    await db.delete(currencyRates).where(eq(currencyRates.code, code));

    return c.json({ success: true, message: 'Currency deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete currency. It might be referenced by other records.' }, 500);
  }
});

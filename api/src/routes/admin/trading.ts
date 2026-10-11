import { Hono } from 'hono';
import { eq, desc, and, sql } from 'drizzle-orm';
import { Bindings, Variables } from '../../db';
import { markets, orders, trades, users, wallets, walletTransactions, positions } from 'database';
import { mt5Accounts } from 'database/schema/mt5';
import { jwtMiddleware } from '../../middleware/jwt';
import { closePositionAtomic } from '../../services/position-service';
import Decimal from 'decimal.js';

export const adminTradingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminTradingRoutes.use('*', jwtMiddleware);

adminTradingRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (!['SUPER_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN'].includes(user.role)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  await next();
});

adminTradingRoutes.get('/markets', async (c) => {
  const db = c.get('db');
  
  try {
    const allMarkets = await db.select().from(markets).all();
    
    // We fetch trades to calculate 24h volume
    const now = Date.now();
    const allTrades = await db.select().from(trades)
      .where(sql`created_at > ${now - 86400000}`)
      .all();
      
    const results = allMarkets.map(m => {
      let volume24h = 0;
      allTrades.forEach(t => {
        if (t.marketSymbol === m.symbol) {
          volume24h += parseFloat(t.amount) * parseFloat(t.price);
        }
      });
      return {
        ...m,
        volume24h
      };
    });
    
    return c.json({ success: true, data: results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.post('/markets', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const { symbol, baseAsset, quoteAsset, minPrice, maxPrice, tickSize, minAmount, stepSize, makerFee, takerFee } = body;
  
  if (!symbol || !baseAsset || !quoteAsset || !minPrice || !maxPrice || !tickSize || !minAmount || !stepSize) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }
  
  try {
    const newMarket = {
      id: crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      baseAsset: baseAsset.toUpperCase(),
      quoteAsset: quoteAsset.toUpperCase(),
      minPrice: String(minPrice),
      maxPrice: String(maxPrice),
      tickSize: String(tickSize),
      minAmount: String(minAmount),
      stepSize: String(stepSize),
      makerFee: makerFee ? String(makerFee) : '0.001',
      takerFee: takerFee ? String(takerFee) : '0.001',
      createdAt: new Date(),
    };
    
    await db.insert(markets).values(newMarket).run();
    return c.json({ success: true, data: newMarket });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.put('/markets/:symbol', async (c) => {
  const db = c.get('db');
  const symbol = c.req.param('symbol');
  const body = await c.req.json();
  const { minPrice, maxPrice, tickSize, minAmount, stepSize, makerFee, takerFee } = body;
  
  try {
    await db.update(markets)
      .set({ 
        minPrice: minPrice ? String(minPrice) : undefined,
        maxPrice: maxPrice ? String(maxPrice) : undefined,
        tickSize: tickSize ? String(tickSize) : undefined,
        minAmount: minAmount ? String(minAmount) : undefined,
        stepSize: stepSize ? String(stepSize) : undefined,
        makerFee: makerFee ? String(makerFee) : undefined,
        takerFee: takerFee ? String(takerFee) : undefined,
      })
      .where(eq(markets.symbol, symbol))
      .run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.patch('/markets/:symbol/status', async (c) => {
  const db = c.get('db');
  const symbol = c.req.param('symbol');
  const body = await c.req.json();
  const { status } = body;
  
  if (!['ACTIVE', 'PAUSED', 'DELISTED'].includes(status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }
  
  try {
    await db.update(markets)
      .set({ status })
      .where(eq(markets.symbol, symbol))
      .run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});


adminTradingRoutes.get('/orders', async (c) => {
  const db = c.get('db');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;
  const status = c.req.query('status');
  const market = c.req.query('market');
  
  try {
    const conditions: any[] = [];
    if (status && status !== 'ALL') {
       conditions.push(eq(orders.status, status as any));
    }
    
    const results = await db.select({
      order: orders,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName
      }
    }).from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt)).all();
    
    let filtered = results;
    if (market && market !== 'ALL') {
       filtered = filtered.filter(r => r.order.marketSymbol === market);
    }
    
    const paginated = filtered.slice(offset, offset + limit);
    
    const mapped = paginated.map(r => ({
      id: r.order.displayId || r.order.id,
      internalId: r.order.id,
      userId: r.user.id,
      userName: r.user.email,
      market: r.order.marketSymbol,
      side: r.order.side,
      type: r.order.type,
      price: r.order.price || 'Market',
      amount: r.order.amount,
      filledAmount: r.order.filledAmount,
      status: r.order.status,
      createdAt: r.order.createdAt
    }));
    
    return c.json({ 
      success: true, 
      data: mapped,
      total: filtered.length
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.post('/orders/:id/cancel', async (c) => {
  const db = c.get('db');
  const orderId = c.req.param('id');
  
  try {
    await db.transaction(async (tx: any) => {
      const order = await tx.select().from(orders).where(eq(orders.id, orderId)).get();
      if (!order) throw new Error('Order not found');
      
      if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
        throw new Error(`Cannot cancel order in ${order.status} state`);
      }
      
      const marketInfo = await tx.select().from(markets).where(eq(markets.symbol, order.marketSymbol)).get();
      if(!marketInfo) throw new Error('Market not found');

      const now = new Date();
      await tx.update(orders).set({ status: 'CANCELED', updatedAt: now }).where(eq(orders.id, order.id));
      
      // Refund locked balance
      const orderRemainingAmount = new Decimal(order.remainingAmount);
      const orderPrice = new Decimal(order.price || '0');
      
      const refundAsset = order.side === 'BUY' ? marketInfo.quoteAsset : marketInfo.baseAsset;
      const refundAmount = order.side === 'BUY' 
        ? orderRemainingAmount.times(orderPrice)
        : orderRemainingAmount;
      
      if (refundAmount.gt(0)) {
        let refundWallet = await tx.select().from(wallets)
          .where(and(eq(wallets.userId, order.userId), eq(wallets.assetSymbol, refundAsset)))
          .get();
        
        if (refundWallet) {
          const newBalance = new Decimal(refundWallet.balance).plus(refundAmount).toString();
          const newLocked = Decimal.max(0, new Decimal(refundWallet.lockedBalance).minus(refundAmount)).toString();
          await tx.update(wallets).set({
            balance: newBalance,
            lockedBalance: newLocked,
            updatedAt: now
          }).where(eq(wallets.id, refundWallet.id));

          await tx.insert(walletTransactions).values({
            id: crypto.randomUUID(),
            userId: order.userId,
            type: 'TRADE',
            assetSymbol: refundAsset,
            amount: refundAmount.toString(),
            fee: '0',
            status: 'COMPLETED',
            reference: `Admin Cancel: ${order.id}`,
            beforeBalance: refundWallet.balance,
            afterBalance: newBalance,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

adminTradingRoutes.get('/trades', async (c) => {
  const db = c.get('db');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;
  const market = c.req.query('market');
  
  try {
    let query = db.select().from(trades);
    
    const results = await query.orderBy(desc(trades.createdAt)).all();
    
    let filtered = results;
    if (market && market !== 'ALL') {
       filtered = filtered.filter((r: any) => r.marketSymbol === market);
    }
    
    const paginated = filtered.slice(offset, offset + limit);
    
    const mapped = paginated.map((t: any) => ({
      id: t.displayId || t.id,
      market: t.marketSymbol,
      price: t.price,
      amount: t.amount,
      quoteAmount: t.quoteAmount,
      buyFee: t.buyFee,
      sellFee: t.sellFee,
      createdAt: t.createdAt
    }));
    
    return c.json({ 
      success: true, 
      data: mapped,
      total: filtered.length
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.get('/positions', async (c) => {
  const db = c.get('db');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;
  const market = c.req.query('market');
  
  try {
    const conditions: any[] = [];
    if (market && market !== 'ALL') {
      conditions.push(eq(positions.marketSymbol, market));
    }
    
    const results = await db.select({
      position: positions,
      user: {
        id: users.id,
        email: users.email
      }
    }).from(positions)
      .innerJoin(users, eq(positions.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(positions.createdAt)).all();
      
    const paginated = results.slice(offset, offset + limit);
    
    const mapped = paginated.map((r: any) => ({
      ...r.position,
      userEmail: r.user.email
    }));
    
    return c.json({
      success: true,
      data: mapped,
      total: results.length
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

adminTradingRoutes.post('/positions/:id/close', async (c) => {
  const db = c.get('db');
  const positionId = c.req.param('id');
  const env = c.env as any; // Bindings
  
  try {
    const userRecord = await db.select({
      position: positions,
      user: {
        id: users.id,
        email: users.email,
      }
    }).from(positions)
      .innerJoin(users, eq(positions.userId, users.id))
      .where(eq(positions.id, positionId))
      .get();
    
    if (!userRecord) throw new Error('Position not found');
    const { position: pos, user } = userRecord;
    
    if (pos.status !== 'OPEN') throw new Error('Position already closed');
    
    // Attempt MT5 close if user has an MT5 account linked
    let positionClosed = false;
    try {
      const mt5Account = await db.select()
        .from(mt5Accounts)
        .where(eq(mt5Accounts.userId, pos.userId))
        .get();
      
      if (mt5Account) {
        const { MT5Service } = require('../../services/mt5-client');
        const mt5Service = new MT5Service({
          metaApiToken: env.MT5_API_KEY,
          metaApiAccountId: mt5Account.mt5Login
        });
        await mt5Service.closePosition(mt5Account.mt5Login, pos.id);
        positionClosed = true;
      }
    } catch (err: any) {
      console.warn(`Failed to close MT5 position ${pos.id}:`, err);
    }
    
    // Close locally using shared atomic service
    await db.transaction(async (tx: any) => {
      await closePositionAtomic(tx, pos.id, pos.userId, null, user.email || null);
    });
    
    return c.json({ success: true, message: positionClosed ? 'Position closed on MT5 and local DB' : 'Force closed locally (MT5 not linked or failed)' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

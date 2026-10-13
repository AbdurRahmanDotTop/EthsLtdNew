import { Hono } from 'hono';
import { Decimal } from 'decimal.js';
const runTx = async (db: any, cb: any) => {
  try {
    return await db.transaction(cb);
  } catch (e: any) {
    if (e.message && e.message.toLowerCase().includes('begin')) {
      console.warn('D1 transaction begin failed, falling back to sequential execution');
      return await cb(db);
    }
    throw e;
  }
};
import { eq, and, desc, or, inArray, sql } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { EmailService } from '../services/email';
import { 
  p2pAds, 
  p2pOrders, 
  wallets, 
  p2pMessages, 
  users, 
  ledgerAccounts, 
  ledgerTransactions, 
  ledgerEntries, 
  p2pDisputes, 
  p2pPaymentMethods,
  notifications 
} from 'database';
import { jwtMiddleware } from '../middleware/jwt';
import { generateBusinessId } from '../services/id-generator';

export const p2pRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Helper function to refund escrow for P2P orders
const refundP2PEscrow = async (tx: any, order: any, ad: any, now: Date) => {
  const cryptoAmount = new Decimal(order.cryptoAmount);
  if (ad.type === 'BUY' || ad.status === 'CANCELED') {
    // Return crypto to Seller's available balance from Escrow
    const sellerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.sellerId), eq(wallets.assetSymbol, ad.asset))).get();
    if (sellerWallet) {
      const finalBalance = new Decimal(sellerWallet.balance).plus(cryptoAmount).toString();
      const finalEscrow = new Decimal(sellerWallet.escrowBalance || '0').minus(cryptoAmount).toString();
      await tx.update(wallets).set({ balance: finalBalance, escrowBalance: finalEscrow, updatedAt: now }).where(eq(wallets.id, sellerWallet.id));
    }
  }
  if (ad.status !== 'CANCELED') {
    // Restore ad available amount
    const newAvailable = new Decimal(ad.availableAmount).plus(cryptoAmount).toString();
    await tx.update(p2pAds).set({ availableAmount: newAvailable, updatedAt: now }).where(eq(p2pAds.id, ad.id));
  }
};

// 1. GET /ads - Public listing of active P2P ads
p2pRoutes.get('/ads', async (c) => {
  const db = c.get('db');
  
  let adsWithUsers = await db
    .select({
      ad: p2pAds,
      user: users
    })
    .from(p2pAds)
    .leftJoin(users, eq(p2pAds.userId, users.id))
    .where(eq(p2pAds.status, 'ACTIVE'))
    .orderBy(desc(p2pAds.createdAt))
    .all();

  const userIds = [...new Set(adsWithUsers.map(a => a.ad.userId))];
  let merchantOrders: any[] = [];
  if (userIds.length > 0) {
    merchantOrders = await db.select().from(p2pOrders).where(
      or(
        inArray(p2pOrders.buyerId, userIds),
        inArray(p2pOrders.sellerId, userIds)
      )
    ).all();
  }

  const formattedAds = adsWithUsers.map(({ ad, user }) => {
    // Calculate real stats
    const userOrders = merchantOrders.filter(o => o.buyerId === ad.userId || o.sellerId === ad.userId);
    const totalOrders = userOrders.length;
    const completedOrders = userOrders.filter(o => o.status === 'COMPLETED').length;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 100;

    let parsedPaymentMethods: any[] = [];
    try {
      parsedPaymentMethods = JSON.parse(ad.paymentMethods);
    } catch {
      parsedPaymentMethods = [ad.paymentMethods];
    }

    return {
      ...ad,
      paymentMethods: parsedPaymentMethods,
      merchant: {
        id: ad.userId,
        displayName: user?.displayName || user?.firstName || `User_${ad.userId.substring(0,4)}`,
        username: user?.email ? user.email.split('@')[0] : `user_${ad.userId.substring(0,4)}`,
        verified: user?.status === 'ACTIVE',
        isMerchant: user?.isMerchant || false,
        completionRate: completionRate.toString(),
        totalOrders: totalOrders,
        positiveFeedback: user?.p2pPositiveFeedback || 0,
        negativeFeedback: user?.p2pNegativeFeedback || 0,
        joinedAt: user?.createdAt || new Date().toISOString(),
      }
    };
  });

  return c.json({ success: true, data: formattedAds });
});

// Secure all other routes
p2pRoutes.use('*', jwtMiddleware);

// 2. GET /my-ads - User's own ads
p2pRoutes.get('/my-ads', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const myAds = await db
    .select()
    .from(p2pAds)
    .where(eq(p2pAds.userId, user.id))
    .orderBy(desc(p2pAds.createdAt))
    .all();

  const formatted = myAds.map(ad => {
    let parsedMethods: any[] = [];
    try { parsedMethods = JSON.parse(ad.paymentMethods); } catch { parsedMethods = [ad.paymentMethods]; }
    return { ...ad, paymentMethods: parsedMethods };
  });

  return c.json({ success: true, data: formatted });
});

// 3. POST /ads - Create a new P2P ad
p2pRoutes.post('/ads', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const { type, asset, fiat, price, isFloating, priceMargin, totalAmount, minLimit, maxLimit, paymentWindow, paymentMethods, terms, autoReply, countryRestrictions } = body;

  const amountNum = new Decimal(totalAmount);

  // If user is SELLING crypto for fiat, they must have the crypto balance in wallet
  if (type === 'SELL') {
    let wallet = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, asset))).get();
    if (!wallet || new Decimal(wallet.balance).lessThan(amountNum)) {
      return c.json({ success: false, error: 'Insufficient crypto balance to create this ad.' }, 400);
    }
    
    // Lock the balance into escrowBalance
    const newBalance = new Decimal(wallet.balance).minus(amountNum).toString();
    const newEscrow = new Decimal(wallet.escrowBalance || '0').plus(amountNum).toString();
    const now = new Date();
    await db.update(wallets).set({ balance: newBalance, escrowBalance: newEscrow, updatedAt: now }).where(eq(wallets.id, wallet.id));
  }

  const now = new Date();
  const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
  const adDisplayId = await generateBusinessId(db, dbUser?.email, 'PADS');
  const adId = crypto.randomUUID();
  await db.insert(p2pAds).values({
    id: adId,
    displayId: adDisplayId,
    userId: user.id,
    type,
    asset,
    fiat,
    price: price.toString(),
    isFloating: isFloating || false,
    priceMargin: priceMargin ? priceMargin.toString() : null,
    totalAmount: totalAmount.toString(),
    availableAmount: totalAmount.toString(),
    minLimit: minLimit.toString(),
    maxLimit: maxLimit.toString(),
    paymentWindow: paymentWindow || 15,
    paymentMethods: typeof paymentMethods === 'string' ? paymentMethods : JSON.stringify(paymentMethods),
    terms: terms || '',
    autoReply: autoReply || null,
    countryRestrictions: countryRestrictions ? JSON.stringify(countryRestrictions) : null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ success: true, adId });
});

// 4. PUT /ads/:id - Update an eligible advertisement
p2pRoutes.put('/ads/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const adId = c.req.param('id');
  const body = await c.req.json();
  const { type, asset, fiat, priceType, price, totalAmount, minLimit, maxLimit, paymentWindow, paymentMethods, terms, autoReply, countryRestrictions } = body;

  try {
    const existingAd = await db.select().from(p2pAds).where(and(eq(p2pAds.id, adId), eq(p2pAds.userId, user.id))).get();
    if (!existingAd) return c.json({ success: false, error: 'Ad not found' }, 404);

    let newAvailableAmount = existingAd.availableAmount;
    let newTotalAmount = existingAd.totalAmount;

    if (totalAmount !== undefined && totalAmount !== existingAd.totalAmount) {
      const oldTotal = new Decimal(existingAd.totalAmount);
      const newTotal = new Decimal(totalAmount);
      const delta = newTotal.minus(oldTotal);
      
      newAvailableAmount = new Decimal(existingAd.availableAmount).plus(delta).toString();
      
      if (new Decimal(newAvailableAmount).lessThan(0)) {
         return c.json({ success: false, error: 'Cannot reduce total amount below already executed amount.' }, 400);
      }

      if (existingAd.type === 'SELL') {
        const wallet = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, existingAd.asset))).get();
        if (!wallet) return c.json({ success: false, error: 'Wallet not found' }, 404);
        
        if (delta.greaterThan(0)) {
          if (new Decimal(wallet.balance).lessThan(delta)) {
            return c.json({ success: false, error: 'Insufficient crypto balance to increase ad amount.' }, 400);
          }
          const finalBalance = new Decimal(wallet.balance).minus(delta).toString();
          const finalEscrow = new Decimal(wallet.escrowBalance || '0').plus(delta).toString();
          await db.update(wallets).set({ balance: finalBalance, escrowBalance: finalEscrow, updatedAt: new Date() }).where(eq(wallets.id, wallet.id)).run();
        } else if (delta.lessThan(0)) {
          const refund = delta.abs();
          if (new Decimal(wallet.escrowBalance || '0').lessThan(refund)) {
             return c.json({ success: false, error: 'Invalid escrow balance state.' }, 400);
          }
          const finalBalance = new Decimal(wallet.balance).plus(refund).toString();
          const finalEscrow = new Decimal(wallet.escrowBalance || '0').minus(refund).toString();
          await db.update(wallets).set({ balance: finalBalance, escrowBalance: finalEscrow, updatedAt: new Date() }).where(eq(wallets.id, wallet.id)).run();
        }
      }
      newTotalAmount = newTotal.toString();
    }

    await db.update(p2pAds).set({
      type: type || existingAd.type,
      asset: asset || existingAd.asset,
      fiat: fiat || existingAd.fiat,
      isFloating: priceType ? priceType === 'floating' : existingAd.isFloating,
      price: price ? String(price) : existingAd.price,
      totalAmount: newTotalAmount,
      availableAmount: newAvailableAmount,
      minLimit: minLimit ? String(minLimit) : existingAd.minLimit,
      maxLimit: maxLimit ? String(maxLimit) : existingAd.maxLimit,
      paymentWindow: paymentWindow || existingAd.paymentWindow,
      paymentMethods: paymentMethods ? (typeof paymentMethods === 'string' ? paymentMethods : JSON.stringify(paymentMethods)) : existingAd.paymentMethods,
      terms: terms !== undefined ? terms : existingAd.terms,
      autoReply: autoReply !== undefined ? autoReply : existingAd.autoReply,
      countryRestrictions: countryRestrictions ? JSON.stringify(countryRestrictions) : existingAd.countryRestrictions,
      updatedAt: new Date()
    }).where(eq(p2pAds.id, adId)).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to update ad' }, 500);
  }
});

// 5. PUT /ads/:id/status - Toggle active/paused or cancel ad
p2pRoutes.put('/ads/:id/status', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const adId = c.req.param('id');
  const { status } = await c.req.json();

  try {
    const existingAd = await db.select().from(p2pAds).where(and(eq(p2pAds.id, adId), eq(p2pAds.userId, user.id))).get();
    if (!existingAd) return c.json({ success: false, error: 'Ad not found' }, 404);

    if (status === 'CANCELED' && existingAd.status !== 'CANCELED' && existingAd.type === 'SELL') {
      const wallet = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, existingAd.asset))).get();
      if (wallet) {
        const amountToRefund = new Decimal(existingAd.availableAmount);
        if (amountToRefund.greaterThan(0)) {
          const finalBalance = new Decimal(wallet.balance).plus(amountToRefund).toString();
          const finalEscrow = new Decimal(wallet.escrowBalance || '0').minus(amountToRefund).toString();
          await db.update(wallets).set({ balance: finalBalance, escrowBalance: finalEscrow, updatedAt: new Date() }).where(eq(wallets.id, wallet.id)).run();
        }
      }
    }

    await db.update(p2pAds).set({ status, updatedAt: new Date() }).where(eq(p2pAds.id, adId)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to update ad status' }, 500);
  }
});

// 6. GET /orders - User's orders
p2pRoutes.get('/orders', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  const orderRows = await db.select({
      order: p2pOrders,
      ad: p2pAds
    })
    .from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .where(or(eq(p2pOrders.buyerId, user.id), eq(p2pOrders.sellerId, user.id)))
    .orderBy(desc(p2pOrders.createdAt)).all();
    
  const nowTime = new Date().getTime();
  const enrichedOrders = orderRows.map(row => {
    const role = row.order.buyerId === user.id ? 'BUYER' : 'SELLER';
    let status = row.order.status;
    if (['CREATED', 'PAYMENT_PENDING'].includes(status) && nowTime > new Date(row.order.expiresAt).getTime()) {
      status = 'EXPIRED';
    }
    return {
      ...row.order,
      status,
      role,
      asset: row.ad ? row.ad.asset : 'USDT',
      fiatCurrency: row.ad ? row.ad.fiat : 'USD',
      type: row.order.buyerId === user.id ? 'BUY' : 'SELL'
    };
  });
    
  return c.json({ success: true, data: enrichedOrders });
});

// 7. POST /orders - Create order from an ad
p2pRoutes.post('/orders', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const { adId, cryptoAmount, fiatAmount, paymentMethod } = body;

  if (!adId) return c.json({ success: false, error: 'adId is required.' }, 400);
  if (cryptoAmount === undefined || cryptoAmount === null || isNaN(Number(cryptoAmount)) || Number(cryptoAmount) <= 0) {
    return c.json({ success: false, error: 'A valid cryptoAmount is required.' }, 400);
  }
  if (fiatAmount === undefined || fiatAmount === null || isNaN(Number(fiatAmount)) || Number(fiatAmount) <= 0) {
    return c.json({ success: false, error: 'A valid fiatAmount is required.' }, 400);
  }
  if (!paymentMethod || typeof paymentMethod !== 'string' || paymentMethod.trim() === '') {
    return c.json({ success: false, error: 'Please select a payment method.' }, 400);
  }
  
  try {
    let finalOrderId = '';
    
    await runTx(db, async (tx: any) => {
      const ad = await tx.select().from(p2pAds).where(eq(p2pAds.id, adId)).get();
      if (!ad || ad.status !== 'ACTIVE') {
        throw new Error('Ad is no longer active.');
      }
      
      if (user.id === ad.userId) {
        throw new Error('Cannot take your own ad.');
      }

      const cryptoNum = new Decimal(cryptoAmount);
      const availableNum = new Decimal(ad.availableAmount);
      
      if (availableNum.lessThan(cryptoNum)) {
        throw new Error('Not enough crypto available in this ad.');
      }

      const buyerId = ad.type === 'SELL' ? user.id : ad.userId;
      const sellerId = ad.type === 'SELL' ? ad.userId : user.id;
      const now = new Date();

      // If BUY ad (creator buying crypto, taker selling), lock taker's crypto into escrow
      if (ad.type === 'BUY') {
        const wallet = await tx.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, ad.asset))).get();
        if (!wallet || new Decimal(wallet.balance).lessThan(cryptoNum)) {
          throw new Error('Insufficient crypto balance to fulfill this order.');
        }
        const newBalance = new Decimal(wallet.balance).minus(cryptoNum).toString();
        const newEscrow = new Decimal(wallet.escrowBalance || '0').plus(cryptoNum).toString();
        await tx.update(wallets).set({ balance: newBalance, escrowBalance: newEscrow, updatedAt: now }).where(eq(wallets.id, wallet.id));
      }

      // Update Ad available amount
      const newAvailable = availableNum.minus(cryptoNum).toString();
      await tx.update(p2pAds).set({ availableAmount: newAvailable, updatedAt: now }).where(eq(p2pAds.id, ad.id));

      const dbUser = await tx.select().from(users).where(eq(users.id, user.id)).get();
      const orderDisplayId = await generateBusinessId(tx, dbUser?.email, 'ORDE');
      const orderId = crypto.randomUUID();
      finalOrderId = orderId;
      const expiresAt = new Date(now.getTime() + (ad.paymentWindow * 60000));
      
      let paymentDetails = null;
      try {
        const parsedMethods = JSON.parse(ad.paymentMethods);
        if (Array.isArray(parsedMethods)) {
          const selectedMethodObj = parsedMethods.find((m: any) => m.type === paymentMethod || m === paymentMethod);
          if (selectedMethodObj && typeof selectedMethodObj === 'object' && selectedMethodObj.details) {
            paymentDetails = JSON.stringify(selectedMethodObj.details);
          }
        }
      } catch (e) {
        // Fallback
      }

      await tx.insert(p2pOrders).values({
        id: orderId,
        displayId: orderDisplayId,
        adId,
        buyerId,
        sellerId,
        cryptoAmount: cryptoAmount.toString(),
        fiatAmount: fiatAmount.toString(),
        price: ad.price,
        status: 'PAYMENT_PENDING',
        paymentMethod,
        paymentDetails,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      // Send initial auto-reply message if ad creator configured one
      if (ad.autoReply) {
        await tx.insert(p2pMessages).values({
          id: `msg_auto_${Date.now()}`,
          orderId,
          senderId: ad.userId,
          content: ad.autoReply,
          type: 'TEXT',
          createdAt: now,
        });
      }

      // System notification
      await tx.insert(notifications).values({
        id: `notif_${Date.now()}`,
        userId: ad.userId,
        title: 'New P2P Order',
        message: `A user has taken your P2P ad for ${fiatAmount} ${ad.fiat}. Order ${orderDisplayId} created.`,
        type: 'P2P',
        isRead: false,
        createdAt: now,
      });
    });

    // Email dispatch (asynchronous)
    const emailService = new EmailService(c.env, db);
    c.executionCtx.waitUntil((async () => {
      try {
        const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
        const orderData = await db.select().from(p2pOrders).where(eq(p2pOrders.id, finalOrderId)).get();
        if (orderData) {
          await emailService.sendAdminP2PAlert(orderData, appUrl);
        }
      } catch (e) {
        console.warn("Async email failed:", e);
      }
    })());

    return c.json({ success: true, orderId: finalOrderId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to create order.' }, 400);
  }
});

// 8. GET /orders/:id - Order details
p2pRoutes.get('/orders/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  let orderData = await db
    .select({
      order: p2pOrders,
      ad: p2pAds
    })
    .from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .where(eq(p2pOrders.id, orderId))
    .get();
    
  if (!orderData) return c.json({ success: false, error: 'Order not found.' }, 404);
  
  let order = orderData.order;
  let ad = orderData.ad;
  
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT_ADMIN';
  if (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin) {
    return c.json({ success: false, error: 'Unauthorized.' }, 403);
  }

  const now = new Date();
  // Lazy Expiry Enforcement
  if (['CREATED', 'PAYMENT_PENDING'].includes(order.status) && now.getTime() > new Date(order.expiresAt).getTime()) {
    try {
      await runTx(db, async (tx: any) => {
        const currentOrder = await tx.select().from(p2pOrders).where(eq(p2pOrders.id, order.id)).get();
        if (!currentOrder || !['CREATED', 'PAYMENT_PENDING'].includes(currentOrder.status)) return;
        
        if (ad) {
          await refundP2PEscrow(tx, currentOrder, ad, now);
        }
        
        await tx.update(p2pOrders).set({ status: 'EXPIRED', updatedAt: now }).where(eq(p2pOrders.id, order.id));
        order.status = 'EXPIRED';
      });
    } catch (e) {
      console.error('Failed to process lazy expiry:', e);
    }
  }
  
  const counterpartyId = order.buyerId === user.id ? order.sellerId : order.buyerId;
  const cp = await db.select().from(users).where(eq(users.id, counterpartyId)).get();
  
  const role = order.buyerId === user.id ? 'BUYER' : (order.sellerId === user.id ? 'SELLER' : 'ADMIN');
  const enrichedOrder = {
    ...order,
    role,
    asset: ad ? ad.asset : 'USDT',
    fiatCurrency: ad ? ad.fiat : 'USD',
    permissions: {
      canMarkPaid: role === 'BUYER' && order.status === 'PAYMENT_PENDING',
      canReleaseCrypto: (role === 'SELLER' || isAdmin) && (order.status === 'BUYER_MARKED_PAID' || order.status === 'SELLER_PAYMENT_REVIEW'),
      canCancel: role === 'BUYER' && order.status === 'PAYMENT_PENDING',
      canDispute: ['PAYMENT_PENDING', 'BUYER_MARKED_PAID', 'SELLER_PAYMENT_REVIEW'].includes(order.status)
    }
  };

  return c.json({ 
    success: true, 
    data: enrichedOrder, 
    merchant: cp ? {
      id: cp.id,
      displayName: cp.displayName || cp.firstName || `User_${cp.id.substring(0,4)}`,
      username: cp.email ? cp.email.split('@')[0] : `user_${cp.id.substring(0,4)}`,
      verified: cp.status === 'ACTIVE',
      completionRate: cp.p2pCompletionRate || "100",
      totalOrders: cp.p2pTotalOrders || 0,
      online: true,
      joinedAt: cp.createdAt
    } : null 
  });
});

// 9. POST /orders/:id/mark-paid
p2pRoutes.post('/orders/:id/mark-paid', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  const order = await db.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
  if (!order || order.status !== 'PAYMENT_PENDING') return c.json({ success: false, error: 'Invalid order state.' }, 400);
  if (order.buyerId !== user.id) return c.json({ success: false, error: 'Only buyer can mark as paid.' }, 403);
  if (new Date().getTime() > new Date(order.expiresAt).getTime()) return c.json({ success: false, error: 'Order has expired.' }, 400);
  
  const result = await db.update(p2pOrders).set({ status: 'BUYER_MARKED_PAID', updatedAt: new Date() }).where(and(eq(p2pOrders.id, order.id), eq(p2pOrders.status, 'PAYMENT_PENDING'))).returning();
  if (result.length === 0) return c.json({ success: false, error: 'Race condition detected.' }, 409);
  
  const now = new Date();
  await db.insert(p2pMessages).values({
    id: `sysmsg_${Date.now()}`,
    orderId,
    senderId: user.id,
    content: "Buyer has marked the order as paid. Seller, please verify actual funds in your receiving account before releasing crypto.",
    type: 'SYSTEM',
    createdAt: now,
  });

  await db.insert(notifications).values({
    id: `notif_${Date.now()}`,
    userId: order.sellerId,
    title: 'P2P Payment Marked Sent',
    message: `Buyer marked Order #${order.displayId || orderId} as paid. Please check your receiving account.`,
    type: 'TRADE',
    isRead: false,
    createdAt: now,
  });

  return c.json({ success: true });
});

// 10. POST /orders/:id/release - Release escrow
p2pRoutes.post('/orders/:id/release', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  try {
    await runTx(db, async (tx: any) => {
      const order = await tx.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
      if (!order || (order.status !== 'BUYER_MARKED_PAID' && order.status !== 'SELLER_PAYMENT_REVIEW')) {
        throw new Error('Order cannot be released in this state.');
      }
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT_ADMIN';
      if (order.sellerId !== user.id && !isAdmin) {
        throw new Error('Only seller or admin can release.');
      }
      
      const result = await tx.update(p2pOrders).set({ status: 'COMPLETED', updatedAt: new Date() }).where(and(eq(p2pOrders.id, order.id), or(eq(p2pOrders.status, 'BUYER_MARKED_PAID'), eq(p2pOrders.status, 'SELLER_PAYMENT_REVIEW')))).returning();
      if (result.length === 0) throw new Error('Race condition detected.');

      const ad = await tx.select().from(p2pAds).where(eq(p2pAds.id, order.adId)).get();
      if (!ad) throw new Error('Ad not found');

      const now = new Date();
      const cryptoAmount = new Decimal(order.cryptoAmount);
      
      // Deduct from Seller's escrow balance
      const sellerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.sellerId), eq(wallets.assetSymbol, ad.asset))).get();
      if (sellerWallet) {
        const finalEscrow = new Decimal(sellerWallet.escrowBalance || '0').minus(cryptoAmount).toString();
        await tx.update(wallets).set({ escrowBalance: finalEscrow, updatedAt: now }).where(eq(wallets.id, sellerWallet.id));
      }

      // Add to Buyer's available balance
      const buyerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.buyerId), eq(wallets.assetSymbol, ad.asset))).get();
      if (buyerWallet) {
        const finalBalance = new Decimal(buyerWallet.balance).plus(cryptoAmount).toString();
        await tx.update(wallets).set({ balance: finalBalance, updatedAt: now }).where(eq(wallets.id, buyerWallet.id));
      } else {
        await tx.insert(wallets).values({
          id: crypto.randomUUID(),
          userId: order.buyerId,
          assetSymbol: ad.asset,
          balance: cryptoAmount.toString(),
          lockedBalance: '0',
          escrowBalance: '0',
          createdAt: now,
          updatedAt: now,
        });
      }

      // Double-entry ledger
      const txId = crypto.randomUUID();
      const txDisplayId = await generateBusinessId(tx, user?.email, 'LTXN');
      await tx.insert(ledgerTransactions).values({
        id: txId,
        displayId: txDisplayId,
        idempotencyKey: `p2p-release-${order.id}`,
        referenceType: 'P2P_COMPLETED',
        referenceId: order.id,
        status: 'COMMITTED',
        createdAt: now,
      });

      // Update reputation counts
      const sellerUser = await tx.select().from(users).where(eq(users.id, order.sellerId)).get();
      const buyerUser = await tx.select().from(users).where(eq(users.id, order.buyerId)).get();
      
      if (sellerUser) {
        await tx.update(users).set({ 
          p2pTotalOrders: (sellerUser.p2pTotalOrders || 0) + 1,
          p2pCompletedOrders: (sellerUser.p2pCompletedOrders || 0) + 1
        }).where(eq(users.id, order.sellerId));
      }
      if (buyerUser) {
        await tx.update(users).set({ 
          p2pTotalOrders: (buyerUser.p2pTotalOrders || 0) + 1,
          p2pCompletedOrders: (buyerUser.p2pCompletedOrders || 0) + 1
        }).where(eq(users.id, order.buyerId));
      }
      
      await tx.insert(notifications).values({
        id: `notif_${Date.now()}_comp`,
        userId: order.buyerId,
        title: 'P2P Order Completed',
        message: `Crypto (${order.cryptoAmount} ${ad.asset}) has been released into your wallet for Order #${order.displayId || order.id}.`,
        type: 'P2P',
        isRead: false,
        createdAt: now,
      });
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Transaction failed.' }, 400);
  }
});

// 11. POST /orders/:id/cancel
p2pRoutes.post('/orders/:id/cancel', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  try {
    await runTx(db, async (tx: any) => {
      const order = await tx.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
      if (!order || !['CREATED', 'PAYMENT_PENDING'].includes(order.status)) {
        throw new Error('Cannot cancel this order in its current status.');
      }
      
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT_ADMIN';
      if (order.buyerId !== user.id && !isAdmin) {
        throw new Error('Only buyer or admin can cancel an order pending payment.');
      }

      const result = await tx.update(p2pOrders).set({ status: 'CANCELLED', updatedAt: new Date() }).where(and(eq(p2pOrders.id, order.id), inArray(p2pOrders.status, ['CREATED', 'PAYMENT_PENDING']))).returning();
      if (result.length === 0) throw new Error('Race condition detected.');

      const ad = await tx.select().from(p2pAds).where(eq(p2pAds.id, order.adId)).get();
      if (!ad) throw new Error('Ad not found');

      const now = new Date();
      await refundP2PEscrow(tx, order, ad, now);

      const counterpartyId = order.buyerId === user.id ? order.sellerId : order.buyerId;
      await tx.insert(notifications).values({
        id: `notif_${Date.now()}`,
        userId: counterpartyId,
        title: 'P2P Order Cancelled',
        message: `Order #${order.displayId || order.id} has been cancelled and escrow released.`,
        type: 'P2P',
        isRead: false,
        createdAt: now,
      });
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Cancellation failed.' }, 400);
  }
});

// 12. POST /orders/:id/dispute
p2pRoutes.post('/orders/:id/dispute', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  
  const order = await db.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
  if (!order || !['PAYMENT_PENDING', 'BUYER_MARKED_PAID', 'SELLER_PAYMENT_REVIEW'].includes(order.status)) {
    return c.json({ success: false, error: 'Order cannot be disputed in this state.' }, 400);
  }
  if (order.buyerId !== user.id && order.sellerId !== user.id) {
    return c.json({ success: false, error: 'Only order participants can open a dispute.' }, 403);
  }

  const result = await db.update(p2pOrders).set({ status: 'DISPUTED', updatedAt: new Date() }).where(and(eq(p2pOrders.id, order.id), inArray(p2pOrders.status, ['PAYMENT_PENDING', 'BUYER_MARKED_PAID', 'SELLER_PAYMENT_REVIEW']))).returning();
  if (result.length === 0) return c.json({ success: false, error: 'Race condition detected.' }, 409);

  const now = new Date();
  const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
  const disputeDisplayId = await generateBusinessId(db, dbUser?.email, 'DISP');
  const disputeId = crypto.randomUUID();
  await db.insert(p2pDisputes).values({
    id: disputeId,
    displayId: disputeDisplayId,
    orderId: order.id,
    openerId: user.id,
    reason: body.reason || 'Payment dispute',
    evidenceUrls: body.evidenceUrls ? JSON.stringify(body.evidenceUrls) : null,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(p2pMessages).values({
    id: `sysmsg_${Date.now()}`,
    orderId,
    senderId: user.id,
    content: "A DISPUTE has been officially opened. Escrow is frozen and an admin arbitrator has been notified.",
    type: 'SYSTEM',
    createdAt: now,
  });

  const counterpartyId = order.buyerId === user.id ? order.sellerId : order.buyerId;
  await db.insert(notifications).values({
    id: `notif_${Date.now()}_disp`,
    userId: counterpartyId,
    title: 'P2P Order Disputed',
    message: `A dispute has been raised for Order #${order.displayId || orderId}. Please upload proof in the order chat.`,
    type: 'TRADE',
    isRead: false,
    createdAt: now,
  });

  return c.json({ success: true, disputeId });
});

// 13. Order Messages (Chat)
p2pRoutes.get('/orders/:id/messages', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  const order = await db.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT_ADMIN';
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  const msgs = await db.select().from(p2pMessages)
    .where(eq(p2pMessages.orderId, orderId))
    .orderBy(p2pMessages.createdAt).all();
    
  return c.json({ success: true, data: msgs });
});

p2pRoutes.post('/orders/:id/messages', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  const body = await c.req.json();
  
  const order = await db.select().from(p2pOrders).where(eq(p2pOrders.id, orderId)).get();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT_ADMIN';
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  const msgId = `msg_${Date.now()}`;
  const now = new Date();
  await db.insert(p2pMessages).values({
    id: msgId,
    orderId,
    senderId: user.id,
    content: body.content,
    type: body.type || 'TEXT',
    attachmentUrl: body.attachmentUrl,
    createdAt: now,
  });
  
  const counterpartyId = order.buyerId === user.id ? order.sellerId : order.buyerId;
  await db.insert(notifications).values({
    id: `notif_${Date.now()}_msg`,
    userId: counterpartyId,
    title: 'New P2P Message',
    message: `New message on Order #${order.displayId || orderId}`,
    type: 'TRADE',
    isRead: false,
    createdAt: now,
  });
  
  return c.json({ success: true, messageId: msgId });
});

// 14. Payment Methods
p2pRoutes.get('/payment-methods', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const methods = await db.select().from(p2pPaymentMethods)
    .where(and(eq(p2pPaymentMethods.userId, user.id), eq(p2pPaymentMethods.isActive, true)))
    .orderBy(desc(p2pPaymentMethods.createdAt)).all();

  const formatted = methods.map(m => {
    let detailsObj = {};
    try { detailsObj = JSON.parse(m.details); } catch { detailsObj = { raw: m.details }; }
    return { ...m, details: detailsObj };
  });

  return c.json({ success: true, data: formatted });
});

p2pRoutes.post('/payment-methods', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const { type, name, details, isPrimary } = body;

  if (!type || !name || !details) {
    return c.json({ success: false, error: 'Type, name and details are required.' }, 400);
  }

  const now = new Date();
  const id = crypto.randomUUID();

  if (isPrimary) {
    await db.update(p2pPaymentMethods).set({ isPrimary: false }).where(eq(p2pPaymentMethods.userId, user.id)).run();
  }

  await db.insert(p2pPaymentMethods).values({
    id,
    userId: user.id,
    type,
    name,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    isActive: true,
    isPrimary: !!isPrimary,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ success: true, id });
});

p2pRoutes.delete('/payment-methods/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  await db.update(p2pPaymentMethods).set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(p2pPaymentMethods.id, id), eq(p2pPaymentMethods.userId, user.id))).run();

  return c.json({ success: true });
});

// 15. User Profile
p2pRoutes.get('/profile', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
  if (!dbUser) return c.json({ success: false, error: 'User not found' }, 404);

  const userOrders = await db.select().from(p2pOrders).where(
    or(eq(p2pOrders.buyerId, user.id), eq(p2pOrders.sellerId, user.id))
  ).all();

  const total = userOrders.length;
  const completed = userOrders.filter(o => o.status === 'COMPLETED').length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

  return c.json({
    success: true,
    data: {
      userId: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName || dbUser.firstName || dbUser.email.split('@')[0],
      isMerchant: dbUser.isMerchant || false,
      merchantTier: dbUser.merchantTier || 'STANDARD',
      totalOrders: total,
      completedOrders: completed,
      completionRate: `${rate}%`,
      positiveFeedback: dbUser.p2pPositiveFeedback || 0,
      negativeFeedback: dbUser.p2pNegativeFeedback || 0,
      joinedAt: dbUser.createdAt,
    }
  });
});

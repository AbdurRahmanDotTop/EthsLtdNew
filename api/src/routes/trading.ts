import { Hono } from 'hono';
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
import { eq, and, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { EmailService } from '../services/email';
import { markets, orders, trades, wallets, walletTransactions, currencyRates, positions } from 'database';
import { jwtMiddleware } from '../middleware/jwt';
import { generateBusinessId } from '../services/id-generator';
import { processOrderMatching } from '../services/matching-engine';
import { closePositionAtomic } from '../services/position-service';
import { broadcastPositionUpdate } from './ws';
import { users } from 'database';
import { getRealPrice } from '../utils/price';
import Decimal from 'decimal.js';

export const tradingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_MARKETS = [
  { symbol: 'BTC-USDT', baseAsset: 'BTC', quoteAsset: 'USDT', minPrice: '1', maxPrice: '1000000', tickSize: '0.01', minAmount: '0.00001', stepSize: '0.00001', makerFee: '0.001', takerFee: '0.001' },
  { symbol: 'ETH-USDT', baseAsset: 'ETH', quoteAsset: 'USDT', minPrice: '1', maxPrice: '100000', tickSize: '0.01', minAmount: '0.001', stepSize: '0.001', makerFee: '0.001', takerFee: '0.001' },
  { symbol: 'SOL-USDT', baseAsset: 'SOL', quoteAsset: 'USDT', minPrice: '0.1', maxPrice: '1000', tickSize: '0.01', minAmount: '0.1', stepSize: '0.1', makerFee: '0.001', takerFee: '0.001' },
];

// ========== PUBLIC ENDPOINTS (No Auth Required) ==========

tradingRoutes.get('/markets', async (c) => {
  const db = c.get('db');
  let allMarkets = await db.select().from(markets).where(eq(markets.status, 'ACTIVE')).all();
  
  if (allMarkets.length === 0) {
    // Seed markets
    const now = new Date();
    await db.insert(markets).values(DEFAULT_MARKETS.map(m => ({
      id: crypto.randomUUID(),
      ...m,
      createdAt: now
    })));
    allMarkets = await db.select().from(markets).where(eq(markets.status, 'ACTIVE')).all();
  }
  
  // Fetch real data from MEXC (more reliable on Cloudflare workers than Binance)
  let tickerData: Record<string, any> = {};
  try {
    const res = await fetch(`https://api.mexc.com/api/v3/ticker/24hr`);
    if (res.ok) {
      const data = await res.json() as any[];
      if (Array.isArray(data)) {
        data.forEach(item => {
          const origSymbol = allMarkets.find(m => m.symbol.replace('-', '') === item.symbol)?.symbol;
          if (origSymbol) {
             tickerData[origSymbol] = item;
          }
        });
      }
    } else {
      console.warn("MEXC API returned status", res.status);
    }
  } catch(e) {
    console.warn('MEXC API error:', e);
  }

  // Fallback to Binance 24hr if MEXC failed or partial
  if (Object.keys(tickerData).length === 0) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr`);
      if (res.ok) {
        const data = await res.json() as any[];
        if (Array.isArray(data)) {
          data.forEach(item => {
            const origSymbol = allMarkets.find(m => m.symbol.replace('-', '') === item.symbol)?.symbol;
            if (origSymbol) {
               tickerData[origSymbol] = {
                 lastPrice: item.lastPrice,
                 priceChangePercent: parseFloat(item.priceChangePercent) / 100,
                 highPrice: item.highPrice,
                 lowPrice: item.lowPrice,
                 volume: item.volume,
                 openPrice: item.openPrice
               };
            }
          });
        }
      }
    } catch(e) {
      console.warn('Binance API error:', e);
    }
  }

  // Format for frontend
  const formattedMarkets = await Promise.all(allMarkets.map(async m => {
    const bData = tickerData[m.symbol];
    if (bData) {
      const price = parseFloat(bData.lastPrice);
      return {
        id: m.symbol,
        symbol: m.symbol,
        name: m.symbol,
        baseAsset: m.baseAsset,
        quoteAsset: m.quoteAsset,
        price: price,
        priceChange24h: parseFloat(bData.priceChangePercent) * 100, 
        high24h: parseFloat(bData.highPrice),
        low24h: parseFloat(bData.lowPrice),
        volume24h: parseFloat(bData.volume),
        sparkline: [parseFloat(bData.openPrice), parseFloat(bData.lowPrice), parseFloat(bData.highPrice), price],
        isNew: false
      };
    } else {
      // Robust Fallback
      const fallbackPrice = await getRealPrice(m.symbol) || 0;
      return {
        id: m.symbol,
        symbol: m.symbol,
        name: m.symbol,
        baseAsset: m.baseAsset,
        quoteAsset: m.quoteAsset,
        price: fallbackPrice,
        priceChange24h: 0,
        high24h: fallbackPrice * 1.05,
        low24h: fallbackPrice * 0.95,
        volume24h: 0,
        sparkline: [fallbackPrice, fallbackPrice, fallbackPrice, fallbackPrice],
        isNew: false
      };
    }
  }));
  
  return c.json({ success: true, data: formattedMarkets });
});

tradingRoutes.get('/markets/:symbol/candles', async (c) => {
  const symbol = c.req.param('symbol');
  const interval = c.req.query('interval') || '15m';
  const mexcSymbol = symbol.replace('-', '').toUpperCase();

  // Try MEXC first
  try {
    const res = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${mexcSymbol}&interval=${interval}&limit=100`);
    if (res.ok) {
      const data = await res.json() as any[];
      if (Array.isArray(data) && data.length > 0) {
        const candles = data.map((k: any) => ({
          time: k[0] / 1000,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));
        return c.json({ success: true, data: candles });
      }
    }
  } catch(e) {
    console.error('MEXC API error (candles):', e);
  }

  // Fallback: try Binance
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${mexcSymbol}&interval=${interval}&limit=100`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const data = await res.json() as any[];
      if (Array.isArray(data) && data.length > 0) {
        const candles = data.map((k: any) => ({
          time: k[0] / 1000,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));
        return c.json({ success: true, data: candles });
      }
    }
  } catch(e) {
    console.error('Binance API error (candles fallback):', e);
  }

  return c.json({ success: true, data: [] });
});

tradingRoutes.get('/markets/:symbol/orderbook', async (c) => {
  const symbol = c.req.param('symbol');
  const db = c.get('db');

  try {
    const activeOrders = await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.marketSymbol, symbol),
          eq(orders.type, 'LIMIT')
        )
      )
      .all();

    const openOrders = activeOrders.filter((o: any) => 
      o.status === 'OPEN' || o.status === 'ACCEPTED' || o.status === 'PARTIALLY_FILLED'
    );

    const askMap = new Map<number, number>();
    const bidMap = new Map<number, number>();

    // 1. Fetch Real Market Depth (Level 2) from MEXC
    const mexcSymbol = symbol.replace('-', '').toUpperCase();
    try {
      const res = await fetch(`https://api.mexc.com/api/v3/depth?symbol=${mexcSymbol}&limit=20`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.asks) {
           data.asks.forEach((ask: any[]) => askMap.set(parseFloat(ask[0]), parseFloat(ask[1])));
        }
        if (data.bids) {
           data.bids.forEach((bid: any[]) => bidMap.set(parseFloat(bid[0]), parseFloat(bid[1])));
        }
      }
    } catch(e) {
      console.warn("MEXC Orderbook fetch failed, falling back to local orders only");
    }

    // 2. Overlay Local DB Orders
    for (const o of openOrders) {
      if (!o.price) continue;
      const price = parseFloat(o.price);
      const amount = parseFloat(o.remainingAmount);
      
      if (o.side === 'SELL') {
        askMap.set(price, (askMap.get(price) || 0) + amount);
      } else {
        bidMap.set(price, (bidMap.get(price) || 0) + amount);
      }
    }

    const asks = Array.from(askMap.entries())
      .map(([price, amount]) => ({ price, amount, total: price * amount }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 50);

    const bids = Array.from(bidMap.entries())
      .map(([price, amount]) => ({ price, amount, total: price * amount }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 50);

    return c.json({ success: true, data: { asks, bids } });
  } catch (error) {
    console.error('Orderbook error:', error);
    return c.json({ success: true, data: { asks: [], bids: [] } });
  }
});

tradingRoutes.get('/markets/:symbol/trades', async (c) => {
  const symbol = c.req.param('symbol');
  const db = c.get('db');
  
  try {
    const recentTrades = await db.select()
      .from(trades)
      .where(eq(trades.marketSymbol, symbol))
      .orderBy(desc(trades.createdAt))
      .limit(50)
      .all();

    const formattedTrades = recentTrades.map((t: any) => ({
      id: t.id,
      price: parseFloat(t.price),
      amount: parseFloat(t.amount),
      total: parseFloat(t.quoteAmount || '0') || parseFloat(t.price) * parseFloat(t.amount),
      time: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      isBuyerMaker: false
    }));

    return c.json({ success: true, data: formattedTrades });
  } catch (error) {
    console.error('Trades error:', error);
    return c.json({ success: true, data: [] });
  }
});

tradingRoutes.get('/exchange-rate', async (c) => {
  const db = c.get('db');
  const base = (c.req.query('base') || 'USDT').toUpperCase();
  const quote = (c.req.query('quote') || 'INR').toUpperCase();

  // 1. Check Global Currency Rates managed by Admin
  if (base === 'USDT') {
    try {
      const adminRate = await db.select().from(currencyRates)
        .where(and(eq(currencyRates.code, quote), eq(currencyRates.status, 'ACTIVE')))
        .get();
      
      if (adminRate && adminRate.ratePerUsdt) {
        return c.json({ success: true, data: { rate: parseFloat(adminRate.ratePerUsdt), source: 'Admin' } });
      }
    } catch (e) {
      console.warn('Admin currency rate fetch failed', e);
    }
  }

  // 2. Fallback to external markets
  if (base === 'USDT' && quote === 'INR') {
    try {
      const res = await fetch('https://api.wazirx.com/sapi/v1/ticker/24hr?symbol=usdtinr');
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.lastPrice) {
          return c.json({ success: true, data: { rate: parseFloat(data.lastPrice), source: 'WazirX' } });
        }
      }
    } catch (e) {
      console.warn('WazirX exchange rate fetch failed', e);
    }

    try {
      const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USDT');
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.data && data.data.rates && data.data.rates.INR) {
          return c.json({ success: true, data: { rate: parseFloat(data.data.rates.INR), source: 'Coinbase' } });
        }
      }
    } catch (e) {
      console.warn('Coinbase exchange rate fetch failed', e);
    }
    
    return c.json({ success: true, data: { rate: 90.00, source: 'Fallback' } });
  }

  return c.json({ success: false, error: 'Unsupported pair' }, 400);
});



// ========== AUTHENTICATED ENDPOINTS ==========
tradingRoutes.use('*', jwtMiddleware);

// GET /orders — Fetch user's orders (no fake matching!)
tradingRoutes.get('/orders', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  try {
    const userOrders = await db.select().from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .all();
      
    const formattedOrders = userOrders.map((o: any) => {
      let createdStr = "";
      try {
        if (o.createdAt instanceof Date) createdStr = o.createdAt.toISOString();
        else if (typeof o.createdAt === 'number') createdStr = new Date(o.createdAt).toISOString();
        else if (o.createdAt) createdStr = new Date(o.createdAt).toISOString();
      } catch (e) { createdStr = new Date().toISOString(); }

      return {
        id: o.id,
        market: o.marketSymbol || 'UNKNOWN',
        side: o.side || 'BUY',
        type: o.type || 'MARKET',
        price: o.price ? parseFloat(o.price) : undefined,
        amount: o.amount ? parseFloat(o.amount) : 0,
        filled: o.filledAmount ? parseFloat(o.filledAmount) : 0,
        remaining: o.remainingAmount ? parseFloat(o.remainingAmount) : 0,
        total: o.price && o.amount ? parseFloat(o.amount) * parseFloat(o.price) : undefined,
        status: o.status || 'CREATED',
        createdAt: createdStr || new Date().toISOString(),
      };
    });
      
    return c.json({ success: true, data: formattedOrders });
  } catch (error: any) {
    console.error("GET /orders error:", error);
    return c.json({ success: false, error: error.message, stack: error.stack }, 500);
  }
});

// GET /trades — Fetch user's trade history
tradingRoutes.get('/trades', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  // Query trades where this user is buyer or seller
  const allTrades = await db.select().from(trades).orderBy(desc(trades.createdAt)).limit(200).all();
  
  const userTrades = allTrades.filter((t: any) => 
    t.buyUserId === user.id || t.sellUserId === user.id
  );
  
  const formattedTrades = userTrades.map((t: any) => {
    const isBuyer = t.buyUserId === user.id;
    let createdStr = "";
    try {
      if (t.createdAt instanceof Date) createdStr = t.createdAt.toISOString();
      else if (typeof t.createdAt === 'number') createdStr = new Date(t.createdAt).toISOString();
      else if (t.createdAt) createdStr = new Date(t.createdAt).toISOString();
    } catch (e) { createdStr = new Date().toISOString(); }

    return {
      id: t.id,
      market: t.marketSymbol,
      side: isBuyer ? 'BUY' : 'SELL',
      price: parseFloat(t.price),
      amount: parseFloat(t.amount),
      total: parseFloat(t.quoteAmount || '0') || parseFloat(t.price) * parseFloat(t.amount),
      fee: isBuyer ? parseFloat(t.buyFee || '0') : parseFloat(t.sellFee || '0'),
      feeAsset: isBuyer ? t.marketSymbol.split('-')[0] : t.marketSymbol.split('-')[1],
      createdAt: createdStr || new Date().toISOString(),
    };
  });
  
  return c.json({ success: true, data: formattedTrades });
});

// POST /orders — Place a new spot order
tradingRoutes.post('/orders', async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const body = await c.req.json();
    const { market, side, type, amount, price, stopLoss, takeProfit, stopPrice, timeInForce, idempotencyKey, leverage: requestedLeverage } = body;
    
    // --- Idempotency check ---
    if (idempotencyKey) {
      const existing = await db.select().from(orders)
        .where(and(
          eq(orders.userId, user.id),
          eq(orders.idempotencyKey, idempotencyKey)
        ))
        .limit(1)
        .get();
      if (existing) {
        console.log(`[ORDER] Idempotent replay for key ${idempotencyKey}, returning existing order ${existing.id}`);
        const existingPosition = existing.positionId ? await db.select().from(positions).where(eq(positions.id, existing.positionId)).get() : null;
        return c.json({ success: true, orderId: existing.id, positionId: existing.positionId, order: existing, position: existingPosition, message: 'Order already processed' });
      }
    }

    // --- Validate market ---
    {
      const recentDuplicates = await db.select().from(orders)
        .where(and(
          eq(orders.userId, user.id),
          eq(orders.marketSymbol, market),
          eq(orders.side, side)
        ))
        .orderBy(desc(orders.createdAt))
        .limit(1)
        .all();
      if (recentDuplicates.length > 0) {
        const last = recentDuplicates[0];
        const lastTime = last.createdAt instanceof Date ? last.createdAt.getTime() : new Date(last.createdAt as any).getTime();
        const lastAmt = parseFloat(last.amount);
        const reqAmt = parseFloat(amount);
        if (Math.abs(lastAmt - reqAmt) < 0.000001 && Date.now() - lastTime < 3000) {
          console.warn(`Idempotency: Duplicate order blocked for user ${user.id}, returning existing order ${last.id}`);
          return c.json({ success: true, orderId: last.id, order: last, message: 'Order already processed' });
        }
      }
    }

    // --- Validate market ---
    const marketInfo = await db.select().from(markets).where(eq(markets.symbol, market)).get();
    if (!marketInfo) {
      return c.json({ success: false, error: 'Market not found' }, 400);
    }
    if (marketInfo.status !== 'ACTIVE') {
      return c.json({ success: false, error: 'Market is currently not active' }, 400);
    }

    // --- Validate & set price ---
    let fetchedPrice = await getRealPrice(market);
    console.log(`[ORDER] getRealPrice(${market}) returned: ${fetchedPrice}`);
    
    // Fallback: if getRealPrice fails, try MEXC 24hr ticker directly (known to work on CF Workers)
    if (!fetchedPrice || fetchedPrice <= 0 || isNaN(fetchedPrice)) {
      try {
        const mexcSymbol = market.replace('-', '').toUpperCase();
        const res = await fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${mexcSymbol}`);
        if (res.ok) {
          const data = await res.json() as any;
          if (data && data.lastPrice) {
            fetchedPrice = parseFloat(data.lastPrice);
            console.log(`[ORDER] Fallback MEXC 24hr price for ${market}: ${fetchedPrice}`);
          }
        }
      } catch (e) {
        console.error(`[ORDER] MEXC 24hr fallback also failed for ${market}:`, e);
      }
    }
    
    const orderPriceRaw = type === 'MARKET' ? fetchedPrice : parseFloat(price);
    
    if (!orderPriceRaw || orderPriceRaw <= 0 || isNaN(orderPriceRaw)) {
      console.error(`[ORDER] Price validation failed: fetchedPrice=${fetchedPrice}, orderPriceRaw=${orderPriceRaw}`);
      return c.json({ success: false, error: `Price unavailable for ${market}. Please try again in a moment.` }, 400);
    }

    const orderPrice = new Decimal(orderPriceRaw);
    const parsedAmount = new Decimal(amount);
    
    // --- Validate amount ---
    if (parsedAmount.lte(0)) {
      return c.json({ success: false, error: 'Amount must be greater than zero' }, 400);
    }
    
    const minAmount = new Decimal(marketInfo.minAmount === 'min_amount' ? '0' : (marketInfo.minAmount || '0'));
    if (parsedAmount.lt(minAmount)) {
      return c.json({ success: false, error: `Minimum order amount is ${marketInfo.minAmount}` }, 400);
    }

    // --- Validate price bounds for limit orders ---
    if (type === 'LIMIT') {
      const minPrice = new Decimal(marketInfo.minPrice === 'min_price' ? '0' : (marketInfo.minPrice || '0'));
      const maxPrice = new Decimal(marketInfo.maxPrice === 'max_price' ? '9999999' : (marketInfo.maxPrice || '9999999'));
      if (orderPrice.lt(minPrice) || orderPrice.gt(maxPrice)) {
        return c.json({ success: false, error: `Price must be between ${marketInfo.minPrice} and ${marketInfo.maxPrice}` }, 400);
      }
    }

    const rawContractSize = marketInfo.contractSize === 'contract_size' ? '1' : (marketInfo.contractSize || '1');
    const contractSize = new Decimal(rawContractSize);
    const totalValue = parsedAmount.times(contractSize).times(orderPrice);
    // For MT5 behaviour, spend amount is always calculated from quote asset (e.g., USDT)
    // regardless of BUY/SELL and market type, since margin is held in quote currency.
    let spendAsset = marketInfo.quoteAsset;
    const marketMaxLeverage = new Decimal(marketInfo.maxLeverage || '100');
    const leverage = Decimal.min(new Decimal(requestedLeverage || '100'), marketMaxLeverage);
    let spendAmount = totalValue.div(leverage); // leverage from market config
    
    console.log(`[ORDER] ${side} ${parsedAmount} ${market} @ ${orderPrice} | totalValue=${totalValue} margin=${spendAmount} asset=${spendAsset}`);
    
    const now = new Date();
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    const orderDisplayId = await generateBusinessId(db, dbUser?.email, 'ORDE');

    try {
      const quoteAmount = parsedAmount.times(orderPrice);
      const rawTakerFee = marketInfo.takerFee === 'taker_fee' ? '0' : (marketInfo.takerFee || '0');
      const takerFeeRate = new Decimal(rawTakerFee);
      const commissionFee = type === 'MARKET' ? quoteAmount.times(takerFeeRate) : new Decimal(0);
      const requiredBalance = spendAmount.plus(commissionFee);

      // ============================================
      // SINGLE ATOMIC TRANSACTION: wallet debit + order + position + trade
      // This ensures if ANY step fails, nothing is committed (no partial state)
      // ============================================
      await runTx(db, async (tx: any) => {
        // --- Balance Check (Inside Transaction) ---
        let spendWallet = await tx.select().from(wallets)
          .where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, spendAsset)))
          .get();
        
        if (!spendWallet || new Decimal(spendWallet.balance).lt(requiredBalance)) {
          throw new Error(`Insufficient ${spendAsset} balance. Requires ${requiredBalance.toFixed(4)}`);
        }
        
        // --- Reserve balance: move margin to locked, subtract commission permanently ---
        const newSpendBalance = new Decimal(spendWallet.balance).minus(requiredBalance).toString();
        const newLockedBalance = new Decimal(spendWallet.lockedBalance).plus(spendAmount).toString();
        await tx.update(wallets).set({
          balance: newSpendBalance,
          lockedBalance: newLockedBalance,
          updatedAt: now
        }).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, spendAsset)));
        
        // --- Record wallet transaction for margin lock + commission (MT5 deal-in) ---
        await tx.insert(walletTransactions).values({
          id: crypto.randomUUID(),
          displayId: null,
          userId: user.id,
          type: 'TRADING_DEBIT',
          assetSymbol: spendAsset,
          amount: requiredBalance.toString(),
          fee: commissionFee.toString(),
          status: 'COMPLETED',
          destination: null,
          network: null,
          reference: orderId,
          originalCurrency: null,
          originalAmount: spendWallet.balance,
          conversionRate: null,
          grossAmount: null,
          totalFees: null,
          netAmount: newSpendBalance,
          createdAt: now,
          updatedAt: now,
        });

        // --- Create Order Record ---
        const newOrderRecord: any = {
          id: orderId,
          displayId: orderDisplayId,
          userId: user.id,
          marketSymbol: market,
          side,
          type,
          price: orderPrice.toString(),
          stopPrice: stopPrice ? stopPrice.toString() : null,
          stopLoss: stopLoss ? stopLoss.toString() : null,
          takeProfit: takeProfit ? takeProfit.toString() : null,
          amount: parsedAmount.toString(),
          filledAmount: '0',
          remainingAmount: parsedAmount.toString(),
          status: type === 'MARKET' ? ('ROUTING' as const) : ('ACCEPTED' as const),
          timeInForce: timeInForce || 'GTC',
          idempotencyKey: idempotencyKey || null,
          createdAt: now,
          updatedAt: now,
        };

        await tx.insert(orders).values(newOrderRecord);

        // ============================================
        // MT5 Order Matching Flow
        // ============================================
        // For LIMIT orders: call matching engine to match against existing book
        // For MARKET orders: B-Book auto-fill (instant execution against system)
        let orderStatus = newOrderRecord.status;
        let positionId: string | null = null;
        let filledAmount = new Decimal(0);
        let avgFillPrice = orderPrice;

        if (type === 'LIMIT') {
          // Try to match against existing limit orders in the book
          const matchResult = await processOrderMatching(
            tx,
            { ...newOrderRecord },
            { 
              ...marketInfo,
              contractSize: rawContractSize,
            },
            user.id
          );

          // Update taker order status based on match result
          if (new Decimal(matchResult.remainingToFill).lte(0)) {
            orderStatus = 'FILLED';
          } else if (new Decimal(matchResult.totalFilledAmount).gt(0)) {
            orderStatus = 'PARTIALLY_FILLED';
          }

          // Update the order with match results
          await tx.update(orders).set({
            filledAmount: matchResult.totalFilledAmount,
            remainingAmount: matchResult.remainingToFill,
            status: orderStatus,
            updatedAt: new Date(),
          }).where(eq(orders.id, orderId));

          filledAmount = new Decimal(matchResult.totalFilledAmount);
          if (filledAmount.gt(0)) {
            avgFillPrice = new Decimal(matchResult.averagePrice);
          }
        } else if (type === 'MARKET') {
          // B-Book: MARKET orders auto-fill at current market price
          // (matching engine's B-Book logic handles this, but for CFD margin model
          // we use the simpler inline approach to ensure correct margin/PnL)
          filledAmount = parsedAmount;
          avgFillPrice = orderPrice;
          orderStatus = 'FILLED';

          await tx.update(orders).set({
            status: 'FILLED',
            filledAmount: parsedAmount.toString(),
            remainingAmount: '0',
            updatedAt: new Date(),
          }).where(eq(orders.id, orderId));

          // Create Trade History Record for B-Book (acting as counterparty)
          const tradeId = crypto.randomUUID();
          const tradeDisplayId = await generateBusinessId(tx, 'system', 'TRAD');
          
          await tx.insert(trades).values({
            id: tradeId,
            displayId: tradeDisplayId,
            marketSymbol: market,
            buyOrderId: orderId,
            sellOrderId: orderId,
            buyUserId: user.id,
            sellUserId: user.id,
            price: orderPrice.toString(),
            amount: parsedAmount.toString(),
            quoteAmount: quoteAmount.toString(),
            buyFee: side === 'BUY' ? commissionFee.toString() : '0',
            sellFee: side === 'SELL' ? commissionFee.toString() : '0',
            createdAt: new Date(),
          });
        }

        // ============================================
        // If the order has fills, create a position.
        // MARKET orders always fill (via B-Book).
        // LIMIT orders fill when matching engine finds liquidity.
        // ============================================
        if (filledAmount.gt(0)) {
          positionId = crypto.randomUUID();
          const marginRequired = avgFillPrice.times(filledAmount).div(leverage);

          // Link positionId on the order
          await tx.update(orders).set({ positionId }).where(eq(orders.id, orderId));

          // Create Position
          const positionDisplayId = await generateBusinessId(tx, dbUser?.email, 'POS');
          await tx.insert(positions).values({
            id: positionId,
            displayId: positionDisplayId,
            orderId,
            userId: user.id,
            marketSymbol: market,
            side: side === 'BUY' ? 'LONG' : 'SHORT',
            status: 'OPEN',
            leverage: leverage.toString(),
            marginType: 'ISOLATED',
            marginAmount: marginRequired.toString(),
            entryPrice: avgFillPrice.toString(),
            stopLoss: stopLoss ? stopLoss.toString() : null,
            takeProfit: takeProfit ? takeProfit.toString() : null,
            liquidationPrice: side === 'BUY' 
              ? avgFillPrice.times(0.99).toString() 
              : avgFillPrice.times(1.01).toString(),
            amount: filledAmount.toString(),
            commission: type === 'MARKET' ? commissionFee.toString() : '0',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(`[ORDER] Position ${positionId} created for ${side} ${filledAmount} ${market} @ ${avgFillPrice}`);
        } else if (type === 'LIMIT') {
          // LIMIT order not filled yet — funds stay locked until filled or canceled.
          // The cancel handler refunds the remaining locked balance.
        }
      }); // End of SINGLE atomic transaction
        
    } catch (error: any) {
      console.error('Order placement error:', error);
      return c.json({ success: false, error: error.message || 'Failed to place order' }, 400);
    }

    // Send email notification (fire-and-forget)
    const emailService = new EmailService(c.env, db);
    c.executionCtx.waitUntil((async () => {
      try {
        const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
        const orderData = await db.select().from(orders).where(eq(orders.id, orderId)).get();
        if (orderData) {
            await emailService.sendAdminTradeAlert(orderData, appUrl);
          await emailService.sendUserTransactionAlert(
            user.email,
            'Trade Order Created',
            `Your ${side} order for ${amount} ${marketInfo!.baseAsset} has been placed.`,
            [
              { key: 'Order ID', value: orderData.displayId },
              { key: 'Market', value: market },
              { key: 'Side', value: side },
              { key: 'Amount', value: `${amount} ${marketInfo!.baseAsset}` },
              { key: 'Price', value: type === 'MARKET' ? 'Market Price' : `${price} ${marketInfo!.quoteAsset}` },
              { key: 'Status', value: orderData.status }
            ],
            `${appUrl}/trade/${market.replace('-', '_')}`,
            'View Trade'
          );
        }
      } catch (e) {
        console.error("Failed to send trade email", e);
      }
    })());

    const finalOrder = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    const finalPosition = finalOrder?.positionId 
      ? await db.select().from(positions).where(eq(positions.id, finalOrder.positionId)).get()
      : null;
    
    // Broadcast position update over WebSocket
    if (finalPosition) {
      c.executionCtx.waitUntil(
        Promise.resolve(broadcastPositionUpdate(user.id, {
          action: 'CREATED',
          positionId: finalPosition.id,
          status: finalPosition.status,
        }))
      );
    }
    
    return c.json({ success: true, orderId, positionId: finalOrder?.positionId || null, order: finalOrder, position: finalPosition });
  } catch (outerError: any) {
    console.error('Unhandled order placement error:', outerError);
    return c.json({ success: false, error: 'An unexpected error occurred while processing your order.' }, 500);
  }
});

// DELETE /orders/:id — Cancel an open order
tradingRoutes.delete('/orders/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const orderId = c.req.param('id');
  
  try {
    await runTx(db, async (tx: any) => {
      const order = await tx.select().from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
        .get();
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Only pending/unfilled orders can be cancelled
      if (!['OPEN', 'ACCEPTED', 'ROUTING', 'PARTIALLY_FILLED'].includes(order.status)) {
        throw new Error('Only open or pending orders can be canceled');
      }
      
      const marketInfo = await tx.select().from(markets)
        .where(eq(markets.symbol, order.marketSymbol)).get();
      if(!marketInfo) throw new Error('Market not found');

      const now = new Date();
      await tx.update(orders).set({ status: 'CANCELED', updatedAt: now })
        .where(eq(orders.id, order.id));
      
      // Refund locked balance for the REMAINING (unfilled) portion
      const orderRemainingAmount = new Decimal(order.remainingAmount);
      const orderPrice = new Decimal(order.price || '0');
      
      const refundAsset = order.side === 'BUY' ? marketInfo.quoteAsset : marketInfo.baseAsset;
      const refundAmount = order.side === 'BUY' 
        ? orderRemainingAmount.times(orderPrice)  // BUY: locked in quote
        : orderRemainingAmount;                     // SELL: locked in base
      
      if (refundAmount.gt(0)) {
        let refundWallet = await tx.select().from(wallets)
          .where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, refundAsset)))
          .get();
        
        if (refundWallet) {
          const newBalance = new Decimal(refundWallet.balance).plus(refundAmount).toString();
          const newLocked = Decimal.max(0, new Decimal(refundWallet.lockedBalance).minus(refundAmount)).toString();
          await tx.update(wallets).set({
            balance: newBalance,
            lockedBalance: newLocked,
            updatedAt: now
          }).where(eq(wallets.id, refundWallet.id));

          // Create wallet transaction for the refund (all columns explicit for D1 safety)
          await tx.insert(walletTransactions).values({
            id: crypto.randomUUID(),
            displayId: null,
            userId: user.id,
            type: 'TRADING_CREDIT',
            assetSymbol: refundAsset,
            amount: refundAmount.toString(),
            fee: '0',
            status: 'COMPLETED',
            destination: null,
            network: null,
            reference: order.id,
            originalCurrency: null,
            originalAmount: refundWallet.balance,
            conversionRate: null,
            grossAmount: null,
            totalFees: null,
            netAmount: newBalance,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Failed to cancel order' }, 400);
  }
  
  return c.json({ success: true });
});


// GET /positions — Fetch user's open positions
tradingRoutes.get('/positions', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  const userPositions = await db.select().from(positions)
    .where(eq(positions.userId, user.id))
    .orderBy(desc(positions.createdAt))
    .all();
    
  // Fetch current market prices to calculate unrealized PNL
  // For production, this should use Redis/WebSocket feeds, but we fetch on demand here.
  let tickerData: Record<string, number> = {};
  let marketsData: Record<string, any> = {};
  
  for (const pos of userPositions) {
    if (!marketsData[pos.marketSymbol]) {
      const mInfo = await db.select().from(markets).where(eq(markets.symbol, pos.marketSymbol)).get();
      marketsData[pos.marketSymbol] = mInfo || { contractSize: '1' };
    }
    if (pos.status === 'OPEN' && !tickerData[pos.marketSymbol]) {
      tickerData[pos.marketSymbol] = await getRealPrice(pos.marketSymbol) || 0;
    }
  }

  const formattedPositions = userPositions.map((p: any) => {
    const currentPrice = tickerData[p.marketSymbol] || parseFloat(p.entryPrice);
    const entry = parseFloat(p.entryPrice);
    const amount = parseFloat(p.amount);
    const contractSize = parseFloat(marketsData[p.marketSymbol]?.contractSize || '1');
    
    let unrealizedPnl = 0;
    if (p.status === 'OPEN') {
      unrealizedPnl = p.side === 'LONG' 
        ? (currentPrice - entry) * amount * contractSize
        : (entry - currentPrice) * amount * contractSize;
    }
    
    let createdStr = "";
    try {
      if (p.createdAt instanceof Date) createdStr = p.createdAt.toISOString();
      else if (typeof p.createdAt === 'number') createdStr = new Date(p.createdAt).toISOString();
      else if (p.createdAt) createdStr = new Date(p.createdAt).toISOString();
    } catch (e) { createdStr = new Date().toISOString(); }

      return {
      id: p.id,
      ticket: p.displayId,
      orderId: p.orderId || null,
      market: p.marketSymbol,
      side: p.side,
      amount: amount,
      entryPrice: entry,
      currentPrice: currentPrice,
      stopLoss: p.stopLoss ? parseFloat(p.stopLoss) : null,
      takeProfit: p.takeProfit ? parseFloat(p.takeProfit) : null,
      margin: parseFloat(p.marginAmount),
      leverage: p.leverage ? parseFloat(p.leverage) : 100,
      unrealizedPnl: unrealizedPnl,
      realizedPnl: parseFloat(p.realizedPnl),
      swap: parseFloat(p.swap),
      commission: parseFloat(p.commission),
      status: p.status,
      closePrice: p.closePrice ? parseFloat(p.closePrice) : null,
      closedAt: p.closedAt ? (p.closedAt instanceof Date ? p.closedAt.toISOString() : new Date(p.closedAt).toISOString()) : null,
      createdAt: createdStr || new Date().toISOString(),
    };
  });
    
  return c.json({ success: true, data: formattedPositions });
});


// POST /positions/:id/close — Close an open position (Supports Partial Close)
tradingRoutes.post('/positions/:id/close', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const positionId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const requestedCloseAmount = body.amount ? new Decimal(body.amount) : null;

  try {
    await runTx(db, async (tx: any) => {
      await closePositionAtomic(
        tx,
        positionId,
        user.id,
        requestedCloseAmount,
        user.email || null
      );
    });
    
    // Broadcast position update over WebSocket
    c.executionCtx.waitUntil(
      Promise.resolve(broadcastPositionUpdate(user.id, {
        action: 'CLOSED',
        positionId,
      }))
    );
    
    return c.json({ success: true, message: 'Position closed successfully' });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
});

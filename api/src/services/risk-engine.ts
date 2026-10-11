import { Bindings, createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { positions, markets } from 'database/schema/trading';
import { getRealPrice } from '../utils/price';
import Decimal from 'decimal.js';
import { users } from 'database/schema/auth';
import { EmailService } from './email';
import { closePositionAtomic } from './position-service';

export async function runRiskEngine(env: Bindings, ctx?: any) {
  const db = createDb(env.DB);
  
  try {
    // 1. Fetch all OPEN positions
    const openPositions = await db.select().from(positions).where(eq(positions.status, 'OPEN')).all();
    if (!openPositions || openPositions.length === 0) return;

    // 2. Group by market to optimize price fetching
    const marketsToFetch = [...new Set(openPositions.map((p: any) => p.marketSymbol))];
    const prices: Record<string, Decimal> = {};
    
    for (const symbol of marketsToFetch) {
      const priceStr = await getRealPrice(symbol);
      if (priceStr) {
        prices[symbol] = new Decimal(priceStr);
      }
    }

    // 3. Evaluate each position
    for (const pos of openPositions) {
      const currentPrice = prices[pos.marketSymbol];
      if (!currentPrice) continue;

      const entry = new Decimal(pos.entryPrice);
      const amount = new Decimal(pos.amount);
      const margin = new Decimal(pos.marginAmount);

      // Fetch market info to get contractSize for consistent PnL calculation
      const marketInfo = await db.select().from(markets).where(eq(markets.symbol, pos.marketSymbol)).get();
      const contractSize = new Decimal(marketInfo?.contractSize || '1');

      let pnl = new Decimal(0);
      if (pos.side === 'LONG') {
        pnl = currentPrice.minus(entry).times(amount).times(contractSize);
      } else {
        pnl = entry.minus(currentPrice).times(amount).times(contractSize);
      }

      let shouldClose = false;
      let closeReason = '';

      // Check Stop Loss
      if (pos.stopLoss) {
        const sl = new Decimal(pos.stopLoss);
        if (pos.side === 'LONG' && currentPrice.lte(sl)) {
          shouldClose = true;
          closeReason = 'STOP_LOSS';
        } else if (pos.side === 'SHORT' && currentPrice.gte(sl)) {
          shouldClose = true;
          closeReason = 'STOP_LOSS';
        }
      }

      // Check Take Profit
      if (!shouldClose && pos.takeProfit) {
        const tp = new Decimal(pos.takeProfit);
        if (pos.side === 'LONG' && currentPrice.gte(tp)) {
          shouldClose = true;
          closeReason = 'TAKE_PROFIT';
        } else if (pos.side === 'SHORT' && currentPrice.lte(tp)) {
          shouldClose = true;
          closeReason = 'TAKE_PROFIT';
        }
      }

      // Check Liquidation (Stop-out level, assuming 50% for now)
      // Equity = Margin + PnL
      const equity = margin.plus(pnl);
      const marginLevel = equity.div(margin).times(100);
      
      if (!shouldClose && marginLevel.lte(50)) {
        shouldClose = true;
        closeReason = 'LIQUIDATION_STOP_OUT';
      }

      // Alert Engine: Margin Warning (Margin Call at 80%)
      if (!shouldClose && marginLevel.lte(80) && marginLevel.gt(50)) {
         console.log(`[AlertEngine] MARGIN CALL WARNING for position ${pos.id} on ${pos.marketSymbol}. Level: ${marginLevel.toFixed(2)}%`);
         // We should send an email to the user if we haven't recently. For now, we dispatch an email asynchronously.
         const emailService = new EmailService(env, db);
         const user = await db.select().from(users).where(eq(users.id, pos.userId)).get();
         if (user) {
            const emailPromise = emailService.sendUserTransactionAlert(
              user.email,
              'Margin Call Warning ⚠️',
              `Your position on ${pos.marketSymbol} has dropped to a margin level of ${marginLevel.toFixed(2)}%. Please add more funds to avoid liquidation at 50%.`,
              [
                { key: 'Position ID', value: pos.id },
                { key: 'Market', value: pos.marketSymbol },
                { key: 'Current PnL', value: pnl.toFixed(2) }
              ],
              `https://ethsltd.com/trading/${pos.marketSymbol}`,
              'Manage Position'
            ).catch(e => console.error(e));
            
            if (ctx?.waitUntil) {
               ctx.waitUntil(emailPromise);
            } else {
               await emailPromise;
            }
         }
      }

      // Execute Close using shared atomic close service (ensures consistent PnL calculation)
      if (shouldClose) {
        console.log(`[RiskEngine] Closing position ${pos.id} due to ${closeReason}. PnL: ${pnl.toString()}`);
        
        const userRec = await db.select().from(users).where(eq(users.id, pos.userId)).get();
        const userEmail = userRec?.email || null;

        await db.transaction(async (tx: any) => {
          await closePositionAtomic(tx, pos.id, pos.userId, null, userEmail);
        });
      }
    }
  } catch (err) {
    console.error('[RiskEngine] Error:', err);
  }
}

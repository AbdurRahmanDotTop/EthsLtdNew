import { eq, and } from 'drizzle-orm';
import { orders, trades, wallets, walletTransactions } from 'database';
import { generateBusinessId } from './id-generator';
import Decimal from 'decimal.js';

export interface MatchResult {
  remainingToFill: string;
  totalFilledAmount: string;
  totalQuoteSpent: string;
  averagePrice: string;
  tradesExecuted: number;
}

/**
 * Production-grade order matching engine.
 * 
 * IMPORTANT: This function does NOT create its own transaction.
 * The caller MUST pass a transaction context (`tx`) to ensure atomicity
 * across order matching, wallet settlement, and record creation.
 * 
 * Flow per match:
 * 1. Find opposite-side OPEN/PARTIALLY_FILLED limit orders (price-time priority)
 * 2. For each matchable order: calculate fill amount
 * 3. Update maker order status (FILLED or PARTIALLY_FILLED)
 * 4. Settle maker wallets (unlock spend, credit receive minus fee)
 * 5. Settle taker wallets (unlock spend, credit receive minus fee)
 * 6. Create trade record with both user IDs
 * 7. Create walletTransaction records for audit trail
 */
export async function processOrderMatching(
  tx: any,
  newOrder: any,
  marketInfo: any,
  takerUserId: string
): Promise<MatchResult> {
  const isBuy = newOrder.side === 'BUY';
  const oppositeSide = isBuy ? 'SELL' : 'BUY';

  // Find opposite side OPEN or PARTIALLY_FILLED LIMIT orders
  let matchingOrders = await tx.select()
    .from(orders)
    .where(
      and(
        eq(orders.marketSymbol, newOrder.marketSymbol),
        eq(orders.side, oppositeSide),
        eq(orders.type, 'LIMIT')
        // We filter status in JS below since drizzle doesn't support OR on enums easily in D1
      )
    )
    .all();

  // Filter to only ACCEPTED or PARTIALLY_FILLED
  matchingOrders = matchingOrders.filter(
    (o: any) => o.status === 'ACCEPTED' || o.status === 'PARTIALLY_FILLED'
  );

  // Sort by price priority, then time priority
  // Buy orders want lowest Ask (ascending), Sell orders want highest Bid (descending)
  matchingOrders.sort((a: any, b: any) => {
    const pA = new Decimal(a.price);
    const pB = new Decimal(b.price);
    const priceCompare = isBuy ? pA.cmp(pB) : pB.cmp(pA);
    if (priceCompare !== 0) return priceCompare;
    // Time priority: earlier orders first
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let remainingToFill = new Decimal(newOrder.remainingAmount);
  let totalFilledAmount = new Decimal(0);
  let totalQuoteSpent = new Decimal(0);
  let tradesExecuted = 0;

  const now = new Date();

  for (const makerOrder of matchingOrders) {
    if (remainingToFill.lte(0)) break;

    const makerPrice = new Decimal(makerOrder.price);

    // Price crossing check for limit orders
    if (newOrder.type === 'LIMIT') {
      const takerPrice = new Decimal(newOrder.price);
      if (isBuy && takerPrice.lt(makerPrice)) break; // taker bid < lowest ask
      if (!isBuy && takerPrice.gt(makerPrice)) break; // taker ask > highest bid
    }

    const makerRemaining = new Decimal(makerOrder.remainingAmount);
    const fillAmount = Decimal.min(remainingToFill, makerRemaining);
    const quoteAmount = fillAmount.times(makerPrice);

    // Update totals
    remainingToFill = remainingToFill.minus(fillAmount);
    totalFilledAmount = totalFilledAmount.plus(fillAmount);
    totalQuoteSpent = totalQuoteSpent.plus(quoteAmount);

    // --- Update Maker Order ---
    const newMakerRemaining = makerRemaining.minus(fillAmount);
    const newMakerFilled = new Decimal(makerOrder.filledAmount).plus(fillAmount);
    const makerStatus = newMakerRemaining.lte(0) ? 'FILLED' : 'PARTIALLY_FILLED';

    await tx.update(orders).set({
      remainingAmount: newMakerRemaining.toString(),
      filledAmount: newMakerFilled.toString(),
      status: makerStatus,
      updatedAt: now
    }).where(eq(orders.id, makerOrder.id));

    // --- Calculate Fees ---
    const makerFeeRate = new Decimal(marketInfo.makerFee);
    const takerFeeRate = new Decimal(marketInfo.takerFee);

    // Determine who is buyer and who is seller
    const buyOrderId = isBuy ? newOrder.id : makerOrder.id;
    const sellOrderId = isBuy ? makerOrder.id : newOrder.id;
    const buyUserId = isBuy ? takerUserId : makerOrder.userId;
    const sellUserId = isBuy ? makerOrder.userId : takerUserId;

    // Buyer receives base asset, pays fee in base asset
    // Seller receives quote asset, pays fee in quote asset
    const buyFee = fillAmount.times(takerFeeRate); // fee on base asset received
    const sellFee = quoteAmount.times(makerFeeRate); // fee on quote asset received

    // --- Create Trade Record ---
    const tradeId = crypto.randomUUID();
    const tradeDisplayId = await generateBusinessId(tx, 'system', 'TRAD');

    await tx.insert(trades).values({
      id: tradeId,
      displayId: tradeDisplayId,
      marketSymbol: newOrder.marketSymbol,
      buyOrderId,
      sellOrderId,
      buyUserId,
      sellUserId,
      price: makerPrice.toString(),
      amount: fillAmount.toString(),
      quoteAmount: quoteAmount.toString(),
      buyFee: buyFee.toString(),
      sellFee: sellFee.toString(),
      createdAt: now,
    });

    // --- Settle Maker Wallets ---
    await settleTradeWallets(tx, {
      userId: makerOrder.userId,
      side: makerOrder.side,
      baseAsset: marketInfo.baseAsset,
      quoteAsset: marketInfo.quoteAsset,
      fillAmount,
      quoteAmount,
      fee: makerOrder.side === 'BUY' ? fillAmount.times(makerFeeRate) : sellFee,
      tradeId,
      now,
    });

    // --- Settle Taker Wallets ---
    await settleTradeWallets(tx, {
      userId: takerUserId,
      side: newOrder.side,
      baseAsset: marketInfo.baseAsset,
      quoteAsset: marketInfo.quoteAsset,
      fillAmount,
      quoteAmount,
      fee: newOrder.side === 'BUY' ? buyFee : quoteAmount.times(takerFeeRate),
      tradeId,
      now,
    });

    tradesExecuted++;
  }

  // --- MT5 B-BOOK / MARKET AUTO-FILL ---
  // If it's a MARKET order and still has remaining amount (no limit orders matched),
  // we act as the counterparty (B-Book) to ensure instant MT5-like execution.
  if (newOrder.type === 'MARKET' && remainingToFill.gt(0)) {
    const fillAmount = remainingToFill;
    const executionPrice = new Decimal(newOrder.price); // Price was set from oracle in routes
    const quoteAmount = fillAmount.times(executionPrice);
    
    totalFilledAmount = totalFilledAmount.plus(fillAmount);
    totalQuoteSpent = totalQuoteSpent.plus(quoteAmount);
    remainingToFill = new Decimal(0);
    
    const takerFeeRate = new Decimal(marketInfo.takerFee);
    const buyFee = fillAmount.times(takerFeeRate);
    const sellFee = quoteAmount.times(takerFeeRate);

    const tradeId = crypto.randomUUID();
    const tradeDisplayId = await generateBusinessId(tx, 'system', 'TRAD');

    // Trade record against the "system" (no maker userId)
    await tx.insert(trades).values({
      id: tradeId,
      displayId: tradeDisplayId,
      marketSymbol: newOrder.marketSymbol,
      buyOrderId: isBuy ? newOrder.id : null,
      sellOrderId: isBuy ? null : newOrder.id,
      buyUserId: isBuy ? takerUserId : null,
      sellUserId: isBuy ? null : takerUserId,
      price: executionPrice.toString(),
      amount: fillAmount.toString(),
      quoteAmount: quoteAmount.toString(),
      buyFee: isBuy ? buyFee.toString() : '0',
      sellFee: isBuy ? '0' : sellFee.toString(),
      createdAt: now,
    });

    // Settle Taker Wallets only
    await settleTradeWallets(tx, {
      userId: takerUserId,
      side: newOrder.side,
      baseAsset: marketInfo.baseAsset,
      quoteAsset: marketInfo.quoteAsset,
      fillAmount,
      quoteAmount,
      fee: isBuy ? buyFee : quoteAmount.times(takerFeeRate),
      tradeId,
      now,
    });
    
    tradesExecuted++;
  }

  return {
    remainingToFill: remainingToFill.toString(),
    totalFilledAmount: totalFilledAmount.toString(),
    totalQuoteSpent: totalQuoteSpent.toString(),
    averagePrice: totalFilledAmount.gt(0)
      ? totalQuoteSpent.div(totalFilledAmount).toString()
      : '0',
    tradesExecuted,
  };
}

/**
 * Settle wallets for one side of a trade.
 * 
 * For a BUY:
 *   - Unlock quote asset from lockedBalance (the amount reserved at order time)
 *   - Credit base asset (fillAmount - fee)
 * 
 * For a SELL:
 *   - Unlock base asset from lockedBalance
 *   - Credit quote asset (quoteAmount - fee)
 */
async function settleTradeWallets(tx: any, params: {
  userId: string;
  side: 'BUY' | 'SELL';
  baseAsset: string;
  quoteAsset: string;
  fillAmount: Decimal;
  quoteAmount: Decimal;
  fee: Decimal;
  tradeId: string;
  now: Date;
}) {
  const { userId, side, baseAsset, quoteAsset, fillAmount, quoteAmount, fee, tradeId, now } = params;

  if (side === 'BUY') {
    // 1. Unlock the quote asset that was locked at order time
    const spendWallet = await tx.select().from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, quoteAsset)))
      .get();
    
    if (spendWallet) {
      const newLocked = Decimal.max(0, new Decimal(spendWallet.lockedBalance).minus(quoteAmount));
      await tx.update(wallets).set({
        lockedBalance: newLocked.toString(),
        updatedAt: now
      }).where(eq(wallets.id, spendWallet.id));

      // Create wallet transaction for the spend
      await createWalletTransaction(tx, {
        userId,
        type: 'TRADE',
        assetSymbol: quoteAsset,
        amount: quoteAmount.negated().toString(),
        fee: '0',
        status: 'COMPLETED',
        reference: tradeId,
        beforeBalance: spendWallet.balance,
        afterBalance: spendWallet.balance, // balance didn't change, it was already locked
        now,
      });
    }

    // 2. Credit base asset (received) minus fee
    const receiveNet = fillAmount.minus(fee);
    await creditWallet(tx, userId, baseAsset, receiveNet, now);

    // Create wallet transaction for the receive
    const receiveWallet = await tx.select().from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, baseAsset)))
      .get();

    await createWalletTransaction(tx, {
      userId,
      type: 'TRADE',
      assetSymbol: baseAsset,
      amount: receiveNet.toString(),
      fee: fee.toString(),
      status: 'COMPLETED',
      reference: tradeId,
      beforeBalance: new Decimal(receiveWallet?.balance || '0').minus(receiveNet).toString(),
      afterBalance: receiveWallet?.balance || receiveNet.toString(),
      now,
    });

  } else {
    // SELL side
    // 1. Unlock the base asset that was locked at order time
    const spendWallet = await tx.select().from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, baseAsset)))
      .get();

    if (spendWallet) {
      const newLocked = Decimal.max(0, new Decimal(spendWallet.lockedBalance).minus(fillAmount));
      await tx.update(wallets).set({
        lockedBalance: newLocked.toString(),
        updatedAt: now
      }).where(eq(wallets.id, spendWallet.id));

      await createWalletTransaction(tx, {
        userId,
        type: 'TRADE',
        assetSymbol: baseAsset,
        amount: fillAmount.negated().toString(),
        fee: '0',
        status: 'COMPLETED',
        reference: tradeId,
        beforeBalance: spendWallet.balance,
        afterBalance: spendWallet.balance,
        now,
      });
    }

    // 2. Credit quote asset (received) minus fee
    const receiveNet = quoteAmount.minus(fee);
    await creditWallet(tx, userId, quoteAsset, receiveNet, now);

    const receiveWallet = await tx.select().from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, quoteAsset)))
      .get();

    await createWalletTransaction(tx, {
      userId,
      type: 'TRADE',
      assetSymbol: quoteAsset,
      amount: receiveNet.toString(),
      fee: fee.toString(),
      status: 'COMPLETED',
      reference: tradeId,
      beforeBalance: new Decimal(receiveWallet?.balance || '0').minus(receiveNet).toString(),
      afterBalance: receiveWallet?.balance || receiveNet.toString(),
      now,
    });
  }
}

/**
 * Credit a wallet, creating it if it doesn't exist.
 */
async function creditWallet(tx: any, userId: string, assetSymbol: string, amount: Decimal, now: Date) {
  const wallet = await tx.select().from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, assetSymbol)))
    .get();

  if (wallet) {
    const newBalance = new Decimal(wallet.balance).plus(amount);
    await tx.update(wallets).set({
      balance: newBalance.toString(),
      updatedAt: now
    }).where(eq(wallets.id, wallet.id));
  } else {
    const walletId = crypto.randomUUID();
    await tx.insert(wallets).values({
      id: walletId,
      userId,
      assetSymbol,
      balance: amount.toString(),
      lockedBalance: '0',
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Create a wallet transaction record for audit trail.
 */
async function createWalletTransaction(tx: any, params: {
  userId: string;
  type: string;
  assetSymbol: string;
  amount: string;
  fee: string;
  status: string;
  reference: string;
  beforeBalance: string;
  afterBalance: string;
  now: Date;
}) {
  const txId = crypto.randomUUID();
  await tx.insert(walletTransactions).values({
    id: txId,
    userId: params.userId,
    type: params.type,
    assetSymbol: params.assetSymbol,
    amount: params.amount,
    fee: params.fee,
    status: params.status,
    reference: params.reference,
    beforeBalance: params.beforeBalance,
    afterBalance: params.afterBalance,
    createdAt: params.now,
    updatedAt: params.now,
  });
}

import { eq, and } from 'drizzle-orm';
import { positions, orders, markets, wallets, walletTransactions, trades } from 'database';
import Decimal from 'decimal.js';
import { generateBusinessId } from './id-generator';

export interface ClosePositionResult {
  pnl: string;
  releasedMargin: string;
  totalReturn: string;
  closePrice: string;
}

export async function closePositionAtomic(
  tx: any,
  positionId: string,
  userId: string,
  closeAmount: Decimal | null,
  userEmail: string | null
): Promise<ClosePositionResult> {
  const now = new Date();

  // 1. Fetch position
  const position = await tx.select().from(positions)
    .where(and(eq(positions.id, positionId), eq(positions.userId, userId)))
    .get();

  if (!position) throw new Error('Position not found');
  if (position.status !== 'OPEN') throw new Error('Position is already closed');

  // 2. Fetch market info
  const marketInfo = await tx.select().from(markets)
    .where(eq(markets.symbol, position.marketSymbol))
    .get();
  if (!marketInfo) throw new Error('Market info missing');

  // 3. Calculate amounts
  const totalAmount = new Decimal(position.amount);
  const totalMargin = new Decimal(position.marginAmount);
  const closeAmountFinal = (closeAmount && closeAmount.gt(0) && closeAmount.lt(totalAmount))
    ? closeAmount
    : totalAmount;
  const closeRatio = closeAmountFinal.div(totalAmount);
  const releasedMargin = totalMargin.times(closeRatio);

  // 4. Calculate PnL using real-time price and contractSize (consistent with trading route)
  const { getRealPrice } = await import('../utils/price');
  const currentPriceRaw = await getRealPrice(position.marketSymbol);
  if (!currentPriceRaw) throw new Error('Could not fetch market price for closing');

  const currentPrice = new Decimal(currentPriceRaw);
  const entry = new Decimal(position.entryPrice);
  const contractSize = new Decimal(marketInfo.contractSize || '1');

  let pnl: Decimal;
  if (position.side === 'LONG') {
    pnl = currentPrice.minus(entry).times(closeAmountFinal).times(contractSize);
  } else {
    pnl = entry.minus(currentPrice).times(closeAmountFinal).times(contractSize);
  }

  const totalReturn = releasedMargin.plus(pnl);

  // 5. Update position (CLOSED or reduced)
  if (closeAmountFinal.eq(totalAmount)) {
    // Full close
    await tx.update(positions).set({
      status: 'CLOSED',
      realizedPnl: new Decimal(position.realizedPnl).plus(pnl).toString(),
      closedAt: now,
      closePrice: currentPrice.toString(),
      amount: totalAmount.toString(),
      marginAmount: totalMargin.toString(),
      updatedAt: now,
    }).where(eq(positions.id, position.id));
  } else {
    // Partial close
    await tx.update(positions).set({
      amount: totalAmount.minus(closeAmountFinal).toString(),
      marginAmount: totalMargin.minus(releasedMargin).toString(),
      realizedPnl: new Decimal(position.realizedPnl).plus(pnl).toString(),
      updatedAt: now,
    }).where(eq(positions.id, position.id));
  }

  // 6. Update Wallet
  const quoteWallet = await tx.select().from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.assetSymbol, marketInfo.quoteAsset)))
    .get();

  if (quoteWallet) {
    const newLocked = Decimal.max(0, new Decimal(quoteWallet.lockedBalance).minus(releasedMargin));
    const newBalance = new Decimal(quoteWallet.balance).plus(totalReturn);

    await tx.update(wallets).set({
      lockedBalance: newLocked.toString(),
      balance: newBalance.toString(),
      updatedAt: now,
    }).where(eq(wallets.id, quoteWallet.id));

    // 7. Create wallet transaction for position close
    await tx.insert(walletTransactions).values({
      id: crypto.randomUUID(),
      userId,
      type: totalReturn.gte(0) ? 'TRADING_CREDIT' : 'TRADING_DEBIT',
      assetSymbol: marketInfo.quoteAsset,
      amount: totalReturn.abs().toString(),
      fee: '0',
      status: 'COMPLETED',
      destination: null,
      network: null,
      reference: `close_pos_${position.id}`,
      originalCurrency: null,
      originalAmount: quoteWallet.balance,
      conversionRate: null,
      grossAmount: null,
      totalFees: null,
      netAmount: newBalance.toString(),
      createdAt: now,
      updatedAt: now,
    });
  }

  // 8. Create closing trade history entry
  const tradeId = crypto.randomUUID();
  const tradeDisplayId = await generateBusinessId(tx, userEmail || 'system', 'TRAD');
  await tx.insert(trades).values({
    id: tradeId,
    displayId: tradeDisplayId,
    marketSymbol: position.marketSymbol,
    buyOrderId: position.side === 'LONG' ? null : null,
    sellOrderId: position.side === 'SHORT' ? null : null,
    buyUserId: position.side === 'LONG' ? userId : null,
    sellUserId: position.side === 'SHORT' ? userId : null,
    price: currentPrice.toString(),
    amount: closeAmountFinal.toString(),
    quoteAmount: closeAmountFinal.times(currentPrice).toString(),
    buyFee: '0',
    sellFee: '0',
    createdAt: now,
  });

  return {
    pnl: pnl.toString(),
    releasedMargin: releasedMargin.toString(),
    totalReturn: totalReturn.toString(),
    closePrice: currentPrice.toString(),
  };
}

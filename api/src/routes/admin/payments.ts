import { Hono } from 'hono';
import { eq, and, or, isNull } from 'drizzle-orm';
import { Bindings, Variables } from '../../db';
import {
  bank_accounts as bankAccounts,
  payment_methods as paymentMethods,
  real_manual_deposits as realManualDeposits,
  wallets,
  walletTransactions,
  ledgerTransactions,
  cregisDeposits,
  assetConversions,
} from 'database';
import { jwtMiddleware, adminMiddleware } from '../../middleware/jwt';
import { generateBusinessId } from '../../services/id-generator';
import Decimal from 'decimal.js';

export const adminPaymentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Ensure user is admin
adminPaymentRoutes.use('*', jwtMiddleware);
adminPaymentRoutes.use('*', adminMiddleware);

// ---------------------------------------------------------------------------
// SHARED DEPOSIT APPROVAL LOGIC
// ---------------------------------------------------------------------------
/**
 * Approve a deposit (manual or bank) atomically.
 *
 * Single Source of Truth: ALL financial values are read exclusively from the
 * stored deposit record — never recalculated from the live Global Currency Rate.
 * This ensures the user always receives exactly what they were shown at submission
 * time, regardless of rate changes that happen between submission and approval.
 *
 * 3-Step Transaction Flow (for non-USDT deposits):
 *   Step 1 — DEPOSIT    (+original_amount, original_currency)   → funding receipt
 *   Step 2 — CONVERSION (-original_amount, original_currency)   → marks conversion debit
 *   Step 3 — DEPOSIT    (+net_usdt, USDT)                       → final USDT credit
 *
 * For USDT deposits only Step 3 is created.
 *
 * Idempotency: the surrounding db.transaction + status === 'PENDING' check
 * ensures the wallet is credited exactly once even on double-click or retry.
 */
async function approveDepositById(
  db: any,
  depositId: string,
  adminId: string,
  network: 'Manual' | 'Bank',
) {
  const now = new Date();

  await db.transaction(async (tx: any) => {
    // ── 1. Fetch deposit (only PENDING can be approved) ──────────────────
    const deposit = await tx
      .select()
      .from(realManualDeposits)
      .where(eq(realManualDeposits.id, depositId))
      .get();

    if (!deposit || deposit.status !== 'PENDING') {
      throw new Error('Invalid deposit or already processed');
    }

    // ── 2. Read frozen authoritative values stored at deposit creation ────
    //   These MUST NOT be recalculated from the current live rate.
    const originalCurrency: string = deposit.original_currency || deposit.asset || 'USDT';
    const originalAmountStr: string = deposit.original_amount ?? deposit.amount.toString();
    const originalAmount = new Decimal(originalAmountStr);

    const conversionRateStr: string = deposit.conversion_rate ?? '1';
    const grossUsdtStr: string     = deposit.gross_usdt ?? originalAmountStr;
    const totalFeesStr: string     = deposit.total_fees ?? '0';
    const netUsdtStr: string       = deposit.net_usdt ?? deposit.expected_wallet_credit ?? grossUsdtStr;

    const netUsdt = new Decimal(netUsdtStr);

    if (netUsdt.lte(0)) {
      throw new Error('Net USDT credit is zero or negative — cannot approve');
    }

    // ── 3. Mark deposit as APPROVED ───────────────────────────────────────
    await tx
      .update(realManualDeposits)
      .set({ status: 'APPROVED', reviewed_by: adminId, reviewed_at: now, updated_at: now })
      .where(eq(realManualDeposits.id, depositId));

    // ── 4. Credit USDT wallet ─────────────────────────────────────────────
    const finalAsset = 'USDT';
    let wallet = await tx
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, deposit.user_id), eq(wallets.assetSymbol, finalAsset)))
      .get();

    if (!wallet) {
      const walletId  = crypto.randomUUID();
      const displayId = await generateBusinessId(tx, null, 'WALL');
      await tx.insert(wallets).values({
        id: walletId,
        displayId,
        userId: deposit.user_id,
        assetSymbol: finalAsset,
        balance: netUsdt.toString(),
        lockedBalance: '0',
        escrowBalance: '0',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const newBalance = new Decimal(wallet.balance).plus(netUsdt).toString();
      await tx
        .update(wallets)
        .set({ balance: newBalance, updatedAt: now })
        .where(eq(wallets.id, wallet.id));
    }

    // ── 5. Ledger transaction (audit trail) ───────────────────────────────
    const ltDisplayId  = await generateBusinessId(tx, null, 'LTXN');
    const ledgerTxId   = crypto.randomUUID();
    const idempotencyKey = `DEP_APPROVE_${deposit.id}`;

    await tx.insert(ledgerTransactions).values({
      id: ledgerTxId,
      displayId: ltDisplayId,
      idempotencyKey,
      referenceType: 'DEPOSIT',
      referenceId: deposit.id,
      status: 'COMMITTED',
      createdAt: now,
    });

    // ── 6. 3-Step Wallet Transaction History ──────────────────────────────
    if (originalCurrency !== 'USDT') {
      // Step 1 — Original Currency: +original_amount (Deposit / Received)
      const step1DisplayId = await generateBusinessId(tx, null, 'WTXN');
      await tx.insert(walletTransactions).values({
        id: crypto.randomUUID(),
        displayId: step1DisplayId,
        userId: deposit.user_id,
        type: 'DEPOSIT',
        assetSymbol: originalCurrency,
        amount: originalAmount.toString(),          // positive — funds received
        fee: '0',
        status: 'COMPLETED',
        network,
        reference: deposit.payment_reference,
        originalCurrency,
        originalAmount: originalAmountStr,
        conversionRate: conversionRateStr,
        grossAmount: grossUsdtStr,
        totalFees: totalFeesStr,
        netAmount: originalAmountStr,
        beforeBalance: '0', // Ephemeral step
        afterBalance: originalAmount.toString(),
        createdAt: now,
        updatedAt: now,
      });

      // Step 2 — Conversion Debit: -original_amount (Converted to USDT)
      const step2DisplayId = await generateBusinessId(tx, null, 'WTXN');
      await tx.insert(walletTransactions).values({
        id: crypto.randomUUID(),
        displayId: step2DisplayId,
        userId: deposit.user_id,
        type: 'CONVERSION',
        assetSymbol: originalCurrency,
        amount: originalAmount.negated().toString(), // negative — being converted
        fee: '0',
        status: 'COMPLETED',
        network: 'System',
        reference: `Converted ${originalAmountStr} ${originalCurrency} → ${netUsdtStr} USDT`,
        originalCurrency,
        originalAmount: originalAmountStr,
        conversionRate: conversionRateStr,
        grossAmount: grossUsdtStr,
        totalFees: totalFeesStr,
        netAmount: netUsdtStr,
        beforeBalance: originalAmount.toString(),
        afterBalance: '0',
        createdAt: now,
        updatedAt: now,
      });
    }

    const previousUsdtBalance = wallet ? wallet.balance : '0';
    const newUsdtBalance = new Decimal(previousUsdtBalance).plus(netUsdt).toString();

    // Step 3 — USDT Credit: +net_usdt (Deposit Completed)
    const step3DisplayId = await generateBusinessId(tx, null, 'WTXN');
    await tx.insert(walletTransactions).values({
      id: `TX-DEP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      displayId: step3DisplayId,
      userId: deposit.user_id,
      type: 'DEPOSIT',
      assetSymbol: finalAsset,
      amount: netUsdt.toString(),                  // positive — final credit
      fee: totalFeesStr,
      status: 'COMPLETED',
      network,
      reference: deposit.payment_reference,
      originalCurrency,
      originalAmount: originalAmountStr,
      conversionRate: conversionRateStr,
      grossAmount: grossUsdtStr,
      totalFees: totalFeesStr,
      netAmount: netUsdtStr,
      beforeBalance: previousUsdtBalance,
      afterBalance: newUsdtBalance,
      createdAt: now,
      updatedAt: now,
    });
  });
}

// ---------------------------------------------------------------------------
// PAYMENT METHOD CRUD
// ---------------------------------------------------------------------------

// Get payment settings
adminPaymentRoutes.get('/settings', async (c) => {
  const db      = c.get('db');
  const methods = await db.select().from(paymentMethods).all();
  return c.json({ success: true, paymentMethods: methods });
});

// Create payment method
adminPaymentRoutes.post('/methods', async (c) => {
  const db   = c.get('db');
  const body = await c.req.json();
  const now  = new Date();
  await db.insert(paymentMethods).values({ id: crypto.randomUUID(), ...body, created_at: now, updated_at: now });
  return c.json({ success: true });
});

// Update payment method
adminPaymentRoutes.put('/methods/:id', async (c) => {
  const db   = c.get('db');
  const id   = c.req.param('id');
  const body = await c.req.json();
  const now  = new Date();
  await db.update(paymentMethods).set({ ...body, updated_at: now }).where(eq(paymentMethods.id, id));
  return c.json({ success: true });
});

// Delete payment method
adminPaymentRoutes.delete('/methods/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// PENDING DEPOSITS
// ---------------------------------------------------------------------------

// Get pending deposits (manual + bank) and history for Cregis
adminPaymentRoutes.get('/pending-deposits', async (c) => {
  const db = c.get('db');
  const manual = await db.select().from(realManualDeposits).where(
    and(
      eq(realManualDeposits.status, 'PENDING'),
      or(eq(realManualDeposits.remarks, 'MANUAL'), isNull(realManualDeposits.remarks)),
    ),
  ).all();

  const bank = await db.select().from(realManualDeposits).where(
    and(
      eq(realManualDeposits.status, 'PENDING'),
      eq(realManualDeposits.remarks, 'BANK'),
    ),
  ).all();

  // For Cregis, show recent deposits regardless of status
  const cregis = await db.select().from(cregisDeposits).orderBy(cregisDeposits.createdAt).limit(100).all();

  return c.json({ success: true, manualDeposits: manual, bankDeposits: bank, cregisDeposits: cregis });
});

// ---------------------------------------------------------------------------
// MANUAL DEPOSIT ACTIONS
// ---------------------------------------------------------------------------

// Approve manual deposit
adminPaymentRoutes.post('/manual-deposits/:id/approve', async (c) => {
  const db   = c.get('db');
  const id   = c.req.param('id');
  const user = c.get('user');

  try {
    await approveDepositById(db, id, user.id, 'Manual');
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || 'Failed to approve deposit' }, 400);
  }
});

// Reject manual deposit
adminPaymentRoutes.post('/manual-deposits/:id/reject', async (c) => {
  const db   = c.get('db');
  const id   = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  const now  = new Date();

  const deposit = await db.select().from(realManualDeposits).where(eq(realManualDeposits.id, id)).get();
  if (!deposit || deposit.status !== 'PENDING') {
    return c.json({ success: false, error: 'Invalid deposit' }, 400);
  }

  const reason = body.notes || 'Rejected by Admin';
  await db.update(realManualDeposits).set({
    status: 'REJECTED',
    reviewed_by: user.id,
    reviewed_at: now,
    rejection_reason: reason,
    updated_at: now,
  }).where(eq(realManualDeposits.id, id));

  return c.json({ success: true });
});

// Delete manual deposit (SUPER_ADMIN only)
adminPaymentRoutes.delete('/manual-deposits/:id', async (c) => {
  const db    = c.get('db');
  const id    = c.req.param('id');
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') return c.json({ success: false, error: 'Unauthorized' }, 403);

  await db.delete(realManualDeposits).where(eq(realManualDeposits.id, id));
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// BANK DEPOSIT ACTIONS
// ---------------------------------------------------------------------------

// Approve bank deposit
adminPaymentRoutes.post('/bank-deposits/:id/approve', async (c) => {
  const db   = c.get('db');
  const id   = c.req.param('id');
  const user = c.get('user');

  try {
    await approveDepositById(db, id, user.id, 'Bank');
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || 'Failed to approve deposit' }, 400);
  }
});

// Reject bank deposit
adminPaymentRoutes.post('/bank-deposits/:id/reject', async (c) => {
  const db   = c.get('db');
  const id   = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  const now  = new Date();

  const deposit = await db.select().from(realManualDeposits).where(eq(realManualDeposits.id, id)).get();
  if (!deposit || deposit.status !== 'PENDING') {
    return c.json({ success: false, error: 'Invalid deposit' }, 400);
  }

  const reason = body.notes || 'Rejected by Admin';
  await db.update(realManualDeposits).set({
    status: 'REJECTED',
    reviewed_by: user.id,
    reviewed_at: now,
    rejection_reason: reason,
    updated_at: now,
  }).where(eq(realManualDeposits.id, id));

  return c.json({ success: true });
});

// Delete bank deposit (SUPER_ADMIN only)
adminPaymentRoutes.delete('/bank-deposits/:id', async (c) => {
  const db    = c.get('db');
  const id    = c.req.param('id');
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') return c.json({ success: false, error: 'Unauthorized' }, 403);

  await db.delete(realManualDeposits).where(eq(realManualDeposits.id, id));
  return c.json({ success: true });
});

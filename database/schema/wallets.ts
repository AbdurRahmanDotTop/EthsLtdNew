import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetSymbol: text('asset_symbol').notNull(),
  balance: text('balance').notNull().default('0'), // stored as string to maintain precision
  lockedBalance: text('locked_balance').notNull().default('0'), // locked for spot/margin trading
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const walletTransactions = sqliteTable('wallet_transactions', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['DEPOSIT', 'WITHDRAWAL', 'TRADE', 'TRANSFER', 'FEE', 'REWARD', 'ADJUSTMENT', 'CONVERSION', 'EXPERT_SERVICE', 'TRADING_CREDIT', 'TRADING_DEBIT'] }).notNull(),
  assetSymbol: text('asset_symbol').notNull(),
  amount: text('amount').notNull(),
  fee: text('fee').notNull().default('0'),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED'] }).notNull(),
  destination: text('destination'),
  network: text('network'),
  reference: text('reference'),
  
  // Breakdown tracking (especially for withdrawals/deposits where conversion/fees apply)
  originalCurrency: text('original_currency'),
  originalAmount: text('original_amount'),
  conversionRate: text('conversion_rate'),
  grossAmount: text('gross_amount'),
  totalFees: text('total_fees'),
  netAmount: text('net_amount'),
  
  beforeBalance: text('before_balance'),
  afterBalance: text('after_balance'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

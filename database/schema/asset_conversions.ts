import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const assetConversions = sqliteTable('asset_conversions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalAsset: text('original_asset').notNull(),
  originalAmount: text('original_amount').notNull(),
  conversionRate: text('conversion_rate').notNull(),
  grossUsdt: text('gross_usdt').notNull(),
  depositFee: text('deposit_fee').notNull().default('0'),
  netUsdt: text('net_usdt').notNull(),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED'] }).notNull().default('COMPLETED'),
  referenceId: text('reference_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

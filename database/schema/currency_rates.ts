import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const currencyRates = sqliteTable('currency_rates', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g., 'INR', 'USD'
  name: text('name').notNull(), // e.g., 'Indian Rupee'
  symbol: text('symbol').notNull(), // e.g., '₹', '$'
  ratePerUsdt: text('rate_per_usdt').notNull(), // Stored as text to maintain precision, e.g., '98.80'
  decimalPrecision: integer('decimal_precision').notNull().default(2),
  isAsset: integer('is_asset', { mode: 'boolean' }).notNull().default(false),
  isBank: integer('is_bank', { mode: 'boolean' }).notNull().default(true),
  status: text('status', { enum: ['ACTIVE', 'INACTIVE'] }).notNull().default('ACTIVE'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
  updatedBy: text('updated_by').notNull().references(() => users.id),
});

export const currencyRateHistory = sqliteTable('currency_rate_history', {
  id: text('id').primaryKey(),
  currencyCode: text('currency_code').notNull().references(() => currencyRates.code, { onDelete: 'cascade' }),
  previousRate: text('previous_rate'),
  newRate: text('new_rate').notNull(),
  changedBy: text('changed_by').notNull().references(() => users.id),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
});

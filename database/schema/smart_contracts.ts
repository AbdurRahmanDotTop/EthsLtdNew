import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const smartContracts = sqliteTable('smart_contracts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  chain: text('chain').notNull(),
  address: text('address').notNull().unique(),
  type: text('type', { enum: ['TOKEN', 'TREASURY', 'ROUTER', 'LIQUIDITY_POOL'] }).notNull(),
  status: text('status', { enum: ['ACTIVE', 'PAUSED', 'DEPRECATED'] }).notNull().default('ACTIVE'),
  balanceUsd: integer('balance_usd'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

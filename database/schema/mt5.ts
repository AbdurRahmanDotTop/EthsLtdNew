import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const mt5Accounts = sqliteTable('mt5_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5Login: text('mt5_login').notNull().unique(),
  mt5Password: text('mt5_password').notNull(),
  mt5Group: text('mt5_group').notNull(),
  balance: text('balance').notNull().default('0'), // Mirrored MT5 Balance
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const mt5SyncedDeals = sqliteTable('mt5_synced_deals', {
  dealId: text('deal_id').primaryKey(), // MT5 internal Deal ID
  userId: text('user_id').notNull().references(() => users.id),
  profit: text('profit').notNull(),
  status: text('status', { enum: ['PENDING', 'PROCESSED', 'FAILED'] }).notNull().default('PENDING'),
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull(),
});

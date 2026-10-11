import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const cregisDeposits = sqliteTable('cregis_deposits', {
  id: text('id').primaryKey(), // Internal UUID
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  cid: text('cid'), // Cregis Client ID for this project
  txid: text('txid'), // Cregis Transaction ID (idempotency key from provider)
  assetSymbol: text('asset_symbol').notNull(),
  amount: text('amount').notNull(),
  fromAddress: text('from_address'),
  toAddress: text('to_address'),
  status: text('status', { enum: ['PENDING', 'CONFIRMED', 'FAILED', 'REJECTED'] }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const cregisPayouts = sqliteTable('cregis_payouts', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  thirdPartyId: text('third_party_id').notNull().unique(), // Our idempotency key sent to Cregis
  txid: text('txid'), // Transaction ID returned by Cregis
  assetSymbol: text('asset_symbol').notNull(),
  amount: text('amount').notNull(),
  fee: text('fee').notNull().default('0'),
  toAddress: text('to_address').notNull(),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'REJECTED'] }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const bankTransfers = sqliteTable('bank_transfers', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  amount: text('amount').notNull(),
  currency: text('currency').notNull(), // usually USD or local fiat
  bankReference: text('bank_reference'),
  proofDocumentUrl: text('proof_document_url'),
  status: text('status', { enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'] }).notNull().default('PENDING'),
  rejectionReason: text('rejection_reason'),
  reviewedBy: text('reviewed_by'), // admin user id
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

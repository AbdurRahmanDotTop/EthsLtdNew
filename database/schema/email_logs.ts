import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const emailDeliveryLogs = sqliteTable('email_delivery_logs', {
  id: text('id').primaryKey(), // UUID
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  eventType: text('event_type').notNull(), // e.g. 'NEW_USER', 'DEPOSIT', 'VERIFICATION'
  status: text('status', { enum: ['SUCCESS', 'FAILED', 'PENDING'] }).notNull().default('PENDING'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

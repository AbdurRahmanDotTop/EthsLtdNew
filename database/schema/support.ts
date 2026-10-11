import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  category: text('category').notNull(),
  status: text('status', { enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'] }).notNull().default('OPEN'),
  priority: text('priority', { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }).notNull().default('MEDIUM'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const ticketMessages = sqliteTable('ticket_messages', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id), // Could be user or admin
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  isInternalNote: integer('is_internal_note', { mode: 'boolean' }).notNull().default(false),
  content: text('content').notNull(),
  attachmentBase64: text('attachment_base64'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(), // Usually a CUID or UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type', { enum: ['SYSTEM', 'TRADE', 'DEPOSIT', 'WITHDRAWAL', 'SECURITY'] }).notNull().default('SYSTEM'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

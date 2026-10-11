import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  target: text('target').notNull(),
  ipAddress: text('ip_address'),
  details: text('details'), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

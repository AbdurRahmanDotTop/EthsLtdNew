import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const riskAlerts = sqliteTable('risk_alerts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  severity: text('severity', { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  details: text('details').notNull(), // JSON string or text
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  resolvedBy: text('resolved_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

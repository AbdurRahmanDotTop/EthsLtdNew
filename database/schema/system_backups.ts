import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const systemBackups = sqliteTable('system_backups', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  type: text('type', { enum: ['FULL', 'PARTIAL', 'SCHEMA'] }).notNull().default('FULL'),
  sizeBytes: integer('size_bytes').notNull(),
  storedInR2: integer('stored_in_r2', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['SUCCESS', 'FAILED', 'LOCAL_ONLY'] }).notNull(),
  errorDetails: text('error_details'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

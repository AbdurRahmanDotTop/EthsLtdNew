import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  permissions: text('permissions').notNull(), // JSON string or comma separated
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['ACTIVE', 'REVOKED'] }).notNull().default('ACTIVE'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

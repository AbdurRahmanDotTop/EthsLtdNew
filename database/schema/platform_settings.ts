import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const platformSettings = sqliteTable('platform_settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(), // e.g., 'EXPERT_COMMISSION_PERCENTAGE'
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  updatedBy: text('updated_by'), // admin user id
});

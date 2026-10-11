import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const globalSequences = sqliteTable('global_sequences', {
  entityType: text('entity_type').primaryKey(),
  currentValue: integer('current_value').notNull().default(0),
});

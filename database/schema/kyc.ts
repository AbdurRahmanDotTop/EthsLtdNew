import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const kycProfiles = sqliteTable('kyc_profiles', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  country: text('country').notNull(),
  documentType: text('document_type', { enum: ['PASSPORT', 'ID_CARD', 'DRIVERS_LICENSE'] }).notNull(),
  documentNumber: text('document_number').notNull(),
  documentFrontUrl: text('document_front_url').notNull(),
  documentBackUrl: text('document_back_url'),
  selfieUrl: text('selfie_url').notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).notNull().default('PENDING'),
  reviewedBy: text('reviewed_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

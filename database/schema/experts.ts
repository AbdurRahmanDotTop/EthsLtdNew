import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const expertProfiles = sqliteTable('expert_profiles', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  experienceYears: integer('experience_years').notNull().default(0),
  languages: text('languages', { mode: 'json' }).$type<string[]>(),
  categories: text('categories', { mode: 'json' }).$type<string[]>(),
  rating: real('rating').notNull().default(0),
  completedServices: integer('completed_services').notNull().default(0),
  customersHelped: integer('customers_helped').notNull().default(0),
  verificationStatus: text('verification_status', { enum: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] }).notNull().default('PENDING'),
  availabilityStatus: text('availability_status', { enum: ['AVAILABLE', 'BUSY', 'OFFLINE'] }).notNull().default('OFFLINE'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const expertServices = sqliteTable('expert_services', {
  id: text('id').primaryKey(),
  expertId: text('expert_id').notNull().references(() => expertProfiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: text('price').notNull(), // Stored as string to maintain precision
  currency: text('currency').notNull().default('USD'),
  pricingType: text('pricing_type', { enum: ['FIXED', 'HOURLY', 'MONTHLY'] }).notNull().default('FIXED'),
  status: text('status', { enum: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'REJECTED', 'ARCHIVED'] }).notNull().default('DRAFT'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const expertBookings = sqliteTable('expert_bookings', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  expertId: text('expert_id').notNull().references(() => expertProfiles.id),
  serviceId: text('service_id').notNull().references(() => expertServices.id),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  status: text('status', { 
    enum: [
      'PENDING_PAYMENT', 'PAYMENT_HELD', 'PENDING_EXPERT', 
      'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 
      'COMPLETED', 'CANCELLED', 'REFUNDED', 
      'DISPUTED', 'SETTLED'
    ] 
  }).notNull().default('PENDING_PAYMENT'),
  price: text('price').notNull(),
  currency: text('currency').notNull(),
  platformFee: text('platform_fee').notNull().default('0'),
  expertEarnings: text('expert_earnings').notNull().default('0'),
  transactionId: text('transaction_id'), // Ledger/wallet transaction reference
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // For MONTHLY plans
  chatEnabled: integer('chat_enabled', { mode: 'boolean' }).notNull().default(true), // Admin/Expert chat toggle
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const expertReviews = sqliteTable('expert_reviews', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().unique().references(() => expertBookings.id),
  userId: text('user_id').notNull().references(() => users.id),
  expertId: text('expert_id').notNull().references(() => expertProfiles.id),
  rating: real('rating').notNull(),
  comment: text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const expertMessages = sqliteTable('expert_messages', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => expertBookings.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const p2pAds = sqliteTable('p2p_ads', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['BUY', 'SELL'] }).notNull(), // Buy ad means creator wants to buy crypto with fiat
  asset: text('asset').notNull(), // crypto asset (e.g., USDT)
  fiat: text('fiat').notNull(), // fiat asset (e.g., USD, INR)
  price: text('price').notNull(), // fiat price per crypto (or margin if floating)
  isFloating: integer('is_floating', { mode: 'boolean' }).notNull().default(false),
  priceMargin: text('price_margin'), // percentage e.g., '1.5' for 1.5% margin
  totalAmount: text('total_amount').notNull(), // total crypto available in ad
  availableAmount: text('available_amount').notNull(), // remaining crypto
  minLimit: text('min_limit').notNull(), // min fiat amount per trade
  maxLimit: text('max_limit').notNull(), // max fiat amount per trade
  paymentWindow: integer('payment_window').notNull().default(15), // time in minutes to complete payment
  paymentMethods: text('payment_methods').notNull(), // JSON string array of supported methods
  terms: text('terms'),
  autoReply: text('auto_reply'),
  countryRestrictions: text('country_restrictions'), // JSON array of allowed country codes
  status: text('status', { enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED'] }).notNull().default('ACTIVE'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const p2pOrders = sqliteTable('p2p_orders', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  adId: text('ad_id').notNull().references(() => p2pAds.id),
  buyerId: text('buyer_id').notNull().references(() => users.id),
  sellerId: text('seller_id').notNull().references(() => users.id),
  cryptoAmount: text('crypto_amount').notNull(),
  fiatAmount: text('fiat_amount').notNull(),
  price: text('price').notNull(),
  status: text('status', { enum: ['CREATED', 'PAYMENT_PENDING', 'BUYER_MARKED_PAID', 'SELLER_PAYMENT_REVIEW', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] }).notNull().default('CREATED'),
  paymentMethod: text('payment_method').notNull(), // The selected method for this trade
  paymentDetails: text('payment_details'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), // Usually 15-30 mins after creation
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const p2pMessages = sqliteTable('p2p_messages', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => p2pOrders.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  type: text('type', { enum: ['TEXT', 'IMAGE', 'SYSTEM'] }).notNull().default('TEXT'),
  attachmentUrl: text('attachment_url'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const p2pDisputes = sqliteTable('p2p_disputes', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  orderId: text('order_id').notNull().references(() => p2pOrders.id),
  openerId: text('opener_id').notNull().references(() => users.id), // The user who opened the dispute
  assignedAdminId: text('assigned_admin_id').references(() => users.id),
  reason: text('reason').notNull(),
  evidenceUrls: text('evidence_urls'), // JSON array of strings
  status: text('status', { enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED'] }).notNull().default('OPEN'),
  adminNotes: text('admin_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const p2pPaymentMethods = sqliteTable('p2p_payment_methods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // e.g., 'UPI', 'BANK_TRANSFER', 'PAYPAL'
  name: text('name').notNull(),
  details: text('details').notNull(), // JSON string containing account numbers, etc.
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const p2pFeedback = sqliteTable('p2p_feedback', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => p2pOrders.id),
  fromUserId: text('from_user_id').notNull().references(() => users.id),
  toUserId: text('to_user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['POSITIVE', 'NEGATIVE'] }).notNull(),
  comment: text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Usually a CUID or UUID
  displayId: text('display_id').unique(), // Business ID like johnsmith12-USER-250-20260818-174500
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  verificationToken: text('verification_token'),
  verificationExpiresAt: integer('verification_expires_at', { mode: 'timestamp' }),
  avatarUrl: text('avatar_url'),
  status: text('status', { enum: ['ACTIVE', 'FROZEN', 'BANNED', 'PENDING_VERIFICATION'] }).notNull().default('ACTIVE'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
  mfaSecret: text('mfa_secret'),
  role: text('role', { enum: ['USER', 'EXPERT', 'SUPER_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_ADMIN'] }).notNull().default('USER'),
  isMerchant: integer('is_merchant', { mode: 'boolean' }).notNull().default(false),
  merchantTier: text('merchant_tier').default('STANDARD'),
  p2pTotalOrders: integer('p2p_total_orders').default(0),
  p2pCompletedOrders: integer('p2p_completed_orders').default(0),
  p2pCompletionRate: text('p2p_completion_rate').default('100'),
  p2pPositiveFeedback: integer('p2p_positive_feedback').default(0),
  p2pNegativeFeedback: integer('p2p_negative_feedback').default(0),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

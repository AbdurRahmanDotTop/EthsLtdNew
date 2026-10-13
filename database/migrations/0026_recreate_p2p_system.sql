-- Re-create P2P system tables and columns
ALTER TABLE `wallets` ADD COLUMN `escrow_balance` text NOT NULL DEFAULT '0';
ALTER TABLE `users` ADD COLUMN `merchant_tier` text DEFAULT 'STANDARD';
ALTER TABLE `users` ADD COLUMN `p2p_total_orders` integer DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `p2p_completed_orders` integer DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `p2p_completion_rate` text DEFAULT '100';
ALTER TABLE `users` ADD COLUMN `p2p_positive_feedback` integer DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `p2p_negative_feedback` integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS `p2p_ads` (
  `id` text PRIMARY KEY NOT NULL,
  `display_id` text UNIQUE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `type` text NOT NULL,
  `asset` text NOT NULL,
  `fiat` text NOT NULL,
  `price` text NOT NULL,
  `is_floating` integer DEFAULT 0 NOT NULL,
  `price_margin` text,
  `total_amount` text NOT NULL,
  `available_amount` text NOT NULL,
  `min_limit` text NOT NULL,
  `max_limit` text NOT NULL,
  `payment_window` integer DEFAULT 15 NOT NULL,
  `payment_methods` text NOT NULL,
  `terms` text,
  `auto_reply` text,
  `country_restrictions` text,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `p2p_orders` (
  `id` text PRIMARY KEY NOT NULL,
  `display_id` text UNIQUE,
  `ad_id` text NOT NULL REFERENCES `p2p_ads`(`id`),
  `buyer_id` text NOT NULL REFERENCES `users`(`id`),
  `seller_id` text NOT NULL REFERENCES `users`(`id`),
  `crypto_amount` text NOT NULL,
  `fiat_amount` text NOT NULL,
  `price` text NOT NULL,
  `status` text DEFAULT 'CREATED' NOT NULL,
  `payment_method` text NOT NULL,
  `payment_details` text,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `p2p_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL REFERENCES `p2p_orders`(`id`) ON DELETE cascade,
  `sender_id` text NOT NULL REFERENCES `users`(`id`),
  `content` text NOT NULL,
  `type` text DEFAULT 'TEXT' NOT NULL,
  `attachment_url` text,
  `is_read` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `p2p_disputes` (
  `id` text PRIMARY KEY NOT NULL,
  `display_id` text UNIQUE,
  `order_id` text NOT NULL REFERENCES `p2p_orders`(`id`),
  `opener_id` text NOT NULL REFERENCES `users`(`id`),
  `assigned_admin_id` text REFERENCES `users`(`id`),
  `reason` text NOT NULL,
  `evidence_urls` text,
  `status` text DEFAULT 'OPEN' NOT NULL,
  `admin_notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `p2p_payment_methods` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `type` text NOT NULL,
  `name` text NOT NULL,
  `details` text NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `is_primary` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `p2p_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL REFERENCES `p2p_orders`(`id`),
  `from_user_id` text NOT NULL REFERENCES `users`(`id`),
  `to_user_id` text NOT NULL REFERENCES `users`(`id`),
  `type` text NOT NULL,
  `comment` text,
  `created_at` integer NOT NULL
);

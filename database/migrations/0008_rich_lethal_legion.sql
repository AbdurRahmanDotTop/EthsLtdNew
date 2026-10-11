CREATE TABLE `p2p_disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`opener_id` text NOT NULL,
	`assigned_admin_id` text,
	`reason` text NOT NULL,
	`evidence_urls` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`admin_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `p2p_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opener_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p2p_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`type` text NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `p2p_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p2p_payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`details` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_p2p_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`mode` text DEFAULT 'REAL' NOT NULL,
	`crypto_amount` text NOT NULL,
	`fiat_amount` text NOT NULL,
	`price` text NOT NULL,
	`status` text DEFAULT 'CREATED' NOT NULL,
	`payment_method` text NOT NULL,
	`payment_details` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `p2p_ads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_p2p_orders`("id", "ad_id", "buyer_id", "seller_id", "mode", "crypto_amount", "fiat_amount", "price", "status", "payment_method", "payment_details", "expires_at", "created_at", "updated_at") SELECT "id", "ad_id", "buyer_id", "seller_id", "mode", "crypto_amount", "fiat_amount", "price", "status", "payment_method", "payment_details", "expires_at", "created_at", "updated_at" FROM `p2p_orders`;--> statement-breakpoint
DROP TABLE `p2p_orders`;--> statement-breakpoint
ALTER TABLE `__new_p2p_orders` RENAME TO `p2p_orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `users` ADD `is_merchant` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `p2p_total_orders` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `p2p_completion_rate` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `p2p_positive_feedback` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `p2p_negative_feedback` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wallets` ADD `escrow_balance` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `is_floating` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `price_margin` text;--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `payment_window` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `auto_reply` text;--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `country_restrictions` text;
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_symbol` text NOT NULL,
	`balance` text DEFAULT '0' NOT NULL,
	`locked_balance` text DEFAULT '0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kyc_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`country` text NOT NULL,
	`document_type` text NOT NULL,
	`document_number` text NOT NULL,
	`document_front_url` text NOT NULL,
	`document_back_url` text,
	`selfie_url` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` text,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`asset_symbol` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`direction` text NOT NULL,
	`amount` text NOT NULL,
	`asset_symbol` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `ledger_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_transactions_idempotency_key_unique` ON `ledger_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `markets` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`base_asset` text NOT NULL,
	`quote_asset` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`min_price` text NOT NULL,
	`max_price` text NOT NULL,
	`tick_size` text NOT NULL,
	`min_amount` text NOT NULL,
	`step_size` text NOT NULL,
	`maker_fee` text DEFAULT '0.001' NOT NULL,
	`taker_fee` text DEFAULT '0.001' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_symbol_unique` ON `markets` (`symbol`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_symbol` text NOT NULL,
	`side` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`price` text,
	`amount` text NOT NULL,
	`filled_amount` text DEFAULT '0' NOT NULL,
	`remaining_amount` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_symbol`) REFERENCES `markets`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`market_symbol` text NOT NULL,
	`maker_order_id` text NOT NULL,
	`taker_order_id` text NOT NULL,
	`price` text NOT NULL,
	`amount` text NOT NULL,
	`maker_fee` text NOT NULL,
	`taker_fee` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`market_symbol`) REFERENCES `markets`(`symbol`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maker_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taker_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p2p_ads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`asset` text NOT NULL,
	`fiat` text NOT NULL,
	`price` text NOT NULL,
	`total_amount` text NOT NULL,
	`available_amount` text NOT NULL,
	`min_limit` text NOT NULL,
	`max_limit` text NOT NULL,
	`payment_methods` text NOT NULL,
	`terms` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p2p_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`content` text NOT NULL,
	`attachment_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `p2p_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p2p_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`crypto_amount` text NOT NULL,
	`fiat_amount` text NOT NULL,
	`price` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`payment_method` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `p2p_ads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

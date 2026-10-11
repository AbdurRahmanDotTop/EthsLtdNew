CREATE TABLE `binary_options` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_symbol` text NOT NULL,
	`mode` text DEFAULT 'REAL' NOT NULL,
	`direction` text NOT NULL,
	`amount` text NOT NULL,
	`entry_price` text NOT NULL,
	`settle_price` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`payout_multiplier` text DEFAULT '1.8' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_symbol`) REFERENCES `markets`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_symbol` text NOT NULL,
	`mode` text DEFAULT 'REAL' NOT NULL,
	`side` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`leverage` text DEFAULT '1' NOT NULL,
	`margin_type` text DEFAULT 'ISOLATED' NOT NULL,
	`margin_amount` text NOT NULL,
	`entry_price` text NOT NULL,
	`liquidation_price` text NOT NULL,
	`amount` text NOT NULL,
	`realized_pnl` text DEFAULT '0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_symbol`) REFERENCES `markets`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`market_symbol` text NOT NULL,
	`mode` text DEFAULT 'REAL' NOT NULL,
	`maker_order_id` text NOT NULL,
	`taker_order_id` text NOT NULL,
	`price` text NOT NULL,
	`amount` text NOT NULL,
	`maker_fee` text NOT NULL,
	`taker_fee` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`market_symbol`) REFERENCES `markets`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_trades`("id", "market_symbol", "mode", "maker_order_id", "taker_order_id", "price", "amount", "maker_fee", "taker_fee", "created_at") SELECT "id", "market_symbol", "mode", "maker_order_id", "taker_order_id", "price", "amount", "maker_fee", "taker_fee", "created_at" FROM `trades`;--> statement-breakpoint
DROP TABLE `trades`;--> statement-breakpoint
ALTER TABLE `__new_trades` RENAME TO `trades`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `markets` ADD `type` text DEFAULT 'SPOT' NOT NULL;--> statement-breakpoint
ALTER TABLE `markets` ADD `max_leverage` text DEFAULT '100' NOT NULL;
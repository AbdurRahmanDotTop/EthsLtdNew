CREATE TABLE `mt5_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mt5_login` text NOT NULL,
	`mt5_password` text NOT NULL,
	`mt5_group` text NOT NULL,
	`balance` text DEFAULT '0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mt5_accounts_mt5_login_unique` ON `mt5_accounts` (`mt5_login`);
--> statement-breakpoint
CREATE TABLE `mt5_synced_deals` (
	`deal_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profit` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`processed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `stop_loss` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `take_profit` text;
--> statement-breakpoint
ALTER TABLE `positions` ADD COLUMN `stop_loss` text;
--> statement-breakpoint
ALTER TABLE `positions` ADD COLUMN `take_profit` text;

CREATE TABLE `global_sequences` (
	`entity_type` text PRIMARY KEY NOT NULL,
	`current_value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_display_id_unique` ON `users` (`display_id`);--> statement-breakpoint
ALTER TABLE `bank_transfers` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transfers_display_id_unique` ON `bank_transfers` (`display_id`);--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_transactions_display_id_unique` ON `wallet_transactions` (`display_id`);--> statement-breakpoint
ALTER TABLE `wallets` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_display_id_unique` ON `wallets` (`display_id`);--> statement-breakpoint
ALTER TABLE `ledger_transactions` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_transactions_display_id_unique` ON `ledger_transactions` (`display_id`);--> statement-breakpoint
ALTER TABLE `binary_options` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `binary_options_display_id_unique` ON `binary_options` (`display_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_display_id_unique` ON `orders` (`display_id`);--> statement-breakpoint
ALTER TABLE `positions` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `positions_display_id_unique` ON `positions` (`display_id`);--> statement-breakpoint
ALTER TABLE `trades` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `trades_display_id_unique` ON `trades` (`display_id`);--> statement-breakpoint
ALTER TABLE `p2p_ads` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `p2p_ads_display_id_unique` ON `p2p_ads` (`display_id`);--> statement-breakpoint
ALTER TABLE `p2p_disputes` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `p2p_disputes_display_id_unique` ON `p2p_disputes` (`display_id`);--> statement-breakpoint
ALTER TABLE `p2p_orders` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `p2p_orders_display_id_unique` ON `p2p_orders` (`display_id`);--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `real_manual_deposits_display_id_unique` ON `real_manual_deposits` (`display_id`);
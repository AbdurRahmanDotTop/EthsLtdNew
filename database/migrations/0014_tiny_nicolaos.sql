ALTER TABLE `wallet_transactions` ADD `original_currency` text;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `original_amount` text;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `conversion_rate` text;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `gross_amount` text;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `total_fees` text;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `net_amount` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `original_currency` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `original_amount` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `conversion_rate` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `gross_usdt` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `deposit_fee` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `other_fees` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `total_fees` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `net_usdt` text;--> statement-breakpoint
ALTER TABLE `real_manual_deposits` ADD `expected_wallet_credit` text;
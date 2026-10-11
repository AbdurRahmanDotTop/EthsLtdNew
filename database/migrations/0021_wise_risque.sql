ALTER TABLE `wallet_transactions` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `wallets` DROP COLUMN `type`;--> statement-breakpoint
ALTER TABLE `ledger_accounts` DROP COLUMN `environment`;--> statement-breakpoint
ALTER TABLE `ledger_entries` DROP COLUMN `environment`;--> statement-breakpoint
ALTER TABLE `ledger_transactions` DROP COLUMN `environment`;--> statement-breakpoint
ALTER TABLE `binary_options` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `positions` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `trades` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `p2p_ads` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `p2p_messages` DROP COLUMN `mode`;--> statement-breakpoint
ALTER TABLE `p2p_orders` DROP COLUMN `mode`;
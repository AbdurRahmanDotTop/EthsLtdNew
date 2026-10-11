DROP TABLE `p2p_messages`;--> statement-breakpoint
DROP TABLE `p2p_feedback`;--> statement-breakpoint
DROP TABLE `p2p_disputes`;--> statement-breakpoint
DROP TABLE `p2p_orders`;--> statement-breakpoint
DROP TABLE `p2p_ads`;--> statement-breakpoint
DROP TABLE `p2p_payment_methods`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `p2p_total_orders`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `p2p_completion_rate`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `p2p_positive_feedback`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `p2p_negative_feedback`;--> statement-breakpoint
ALTER TABLE `wallets` DROP COLUMN `escrow_balance`;
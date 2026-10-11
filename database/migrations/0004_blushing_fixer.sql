ALTER TABLE `p2p_ads` ADD `mode` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_messages` ADD `mode` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_messages` ADD `type` text DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_orders` ADD `mode` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `p2p_orders` ADD `payment_details` text;
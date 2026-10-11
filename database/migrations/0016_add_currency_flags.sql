ALTER TABLE `currency_rates` ADD `is_asset` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `currency_rates` ADD `is_bank` integer DEFAULT true NOT NULL;
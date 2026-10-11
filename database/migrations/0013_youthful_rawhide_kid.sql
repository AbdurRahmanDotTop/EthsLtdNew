ALTER TABLE `cregis_deposits` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cregis_deposits_display_id_unique` ON `cregis_deposits` (`display_id`);--> statement-breakpoint
ALTER TABLE `cregis_payouts` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cregis_payouts_display_id_unique` ON `cregis_payouts` (`display_id`);--> statement-breakpoint
ALTER TABLE `expert_bookings` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `expert_bookings_display_id_unique` ON `expert_bookings` (`display_id`);--> statement-breakpoint
ALTER TABLE `expert_profiles` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `expert_profiles_display_id_unique` ON `expert_profiles` (`display_id`);--> statement-breakpoint
ALTER TABLE `kyc_profiles` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `kyc_profiles_display_id_unique` ON `kyc_profiles` (`display_id`);--> statement-breakpoint
ALTER TABLE `tickets` ADD `display_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_display_id_unique` ON `tickets` (`display_id`);
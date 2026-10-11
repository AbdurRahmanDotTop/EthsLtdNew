CREATE TABLE `currency_rate_history` (
	`id` text PRIMARY KEY NOT NULL,
	`currency_code` text NOT NULL,
	`previous_rate` text,
	`new_rate` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`currency_code`) REFERENCES `currency_rates`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `currency_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`rate_per_usdt` text NOT NULL,
	`decimal_precision` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`last_updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `currency_rates_code_unique` ON `currency_rates` (`code`);
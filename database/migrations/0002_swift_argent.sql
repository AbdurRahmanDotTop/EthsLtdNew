CREATE TABLE `wallet_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`asset_symbol` text NOT NULL,
	`amount` text NOT NULL,
	`fee` text DEFAULT '0' NOT NULL,
	`status` text NOT NULL,
	`destination` text,
	`network` text,
	`reference` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;
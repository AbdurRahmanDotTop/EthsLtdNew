CREATE TABLE `expert_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expert_id` text NOT NULL,
	`service_id` text NOT NULL,
	`scheduled_at` integer,
	`status` text DEFAULT 'PENDING_PAYMENT' NOT NULL,
	`price` text NOT NULL,
	`currency` text NOT NULL,
	`platform_fee` text DEFAULT '0' NOT NULL,
	`expert_earnings` text DEFAULT '0' NOT NULL,
	`transaction_id` text,
	`expires_at` integer,
	`chat_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expert_id`) REFERENCES `expert_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `expert_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expert_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`content` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `expert_bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expert_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bio` text,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`languages` text,
	`categories` text,
	`rating` real DEFAULT 0 NOT NULL,
	`completed_services` integer DEFAULT 0 NOT NULL,
	`customers_helped` integer DEFAULT 0 NOT NULL,
	`verification_status` text DEFAULT 'PENDING' NOT NULL,
	`availability_status` text DEFAULT 'OFFLINE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expert_profiles_user_id_unique` ON `expert_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `expert_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expert_id` text NOT NULL,
	`rating` real NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `expert_bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expert_id`) REFERENCES `expert_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expert_reviews_booking_id_unique` ON `expert_reviews` (`booking_id`);--> statement-breakpoint
CREATE TABLE `expert_services` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`pricing_type` text DEFAULT 'FIXED' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`expert_id`) REFERENCES `expert_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_settings_key_unique` ON `platform_settings` (`key`);
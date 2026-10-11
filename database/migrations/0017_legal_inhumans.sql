CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`permissions` text NOT NULL,
	`last_used_at` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`ip_address` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `risk_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`user_id` text,
	`details` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `smart_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`chain` text NOT NULL,
	`address` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`balance_usd` integer,
	`last_checked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smart_contracts_address_unique` ON `smart_contracts` (`address`);
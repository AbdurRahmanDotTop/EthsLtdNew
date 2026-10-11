CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text DEFAULT 'REAL' NOT NULL,
	`bank_name` text NOT NULL,
	`account_holder` text NOT NULL,
	`account_number` text NOT NULL,
	`ifsc` text,
	`swift` text,
	`branch` text,
	`currency` text NOT NULL,
	`country` text,
	`instructions` text,
	`active` integer DEFAULT true NOT NULL,
	`default_account` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `real_manual_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`deposit_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`asset` text NOT NULL,
	`payment_reference` text NOT NULL,
	`transaction_hash` text,
	`proof_file_url` text,
	`remarks` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text DEFAULT 'REAL' NOT NULL,
	`method` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`maintenance_mode` integer DEFAULT false NOT NULL,
	`display_order` integer NOT NULL,
	`min_amount` real NOT NULL,
	`max_amount` real,
	`fee_type` text DEFAULT 'ZERO' NOT NULL,
	`fee_value` real DEFAULT 0 NOT NULL,
	`supported_assets` text,
	`supported_networks` text,
	`instructions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);

CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'SYSTEM' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD `mode` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `wallets` ADD `type` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `mode` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `mode` text DEFAULT 'REAL' NOT NULL;
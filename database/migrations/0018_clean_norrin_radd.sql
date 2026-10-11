CREATE TABLE `system_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`type` text DEFAULT 'FULL' NOT NULL,
	`size_bytes` integer NOT NULL,
	`stored_in_r2` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`error_details` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

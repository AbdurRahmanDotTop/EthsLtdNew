CREATE TABLE IF NOT EXISTS `email_delivery_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);

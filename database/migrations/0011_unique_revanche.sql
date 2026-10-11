CREATE TABLE `asset_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_asset` text NOT NULL,
	`original_amount` text NOT NULL,
	`conversion_rate` text NOT NULL,
	`gross_usdt` text NOT NULL,
	`deposit_fee` text DEFAULT '0' NOT NULL,
	`net_usdt` text NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`reference_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

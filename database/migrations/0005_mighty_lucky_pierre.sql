CREATE TABLE `bank_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`bank_reference` text,
	`proof_document_url` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`rejection_reason` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cregis_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cid` text,
	`txid` text,
	`asset_symbol` text NOT NULL,
	`amount` text NOT NULL,
	`from_address` text,
	`to_address` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cregis_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`third_party_id` text NOT NULL,
	`txid` text,
	`asset_symbol` text NOT NULL,
	`amount` text NOT NULL,
	`fee` text DEFAULT '0' NOT NULL,
	`to_address` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cregis_payouts_third_party_id_unique` ON `cregis_payouts` (`third_party_id`);--> statement-breakpoint
ALTER TABLE `ledger_accounts` ADD `environment` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `environment` text DEFAULT 'REAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_transactions` ADD `environment` text DEFAULT 'REAL' NOT NULL;
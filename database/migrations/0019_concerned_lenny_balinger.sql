ALTER TABLE `ticket_messages` ADD `is_internal_note` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD `attachment_base64` text;
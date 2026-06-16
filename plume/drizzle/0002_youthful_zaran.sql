ALTER TABLE `contacts` ADD `entreprise` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `dedup_key` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contacts_user_dedup` ON `contacts` (`user_id`,`dedup_key`);
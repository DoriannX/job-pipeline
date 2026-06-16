ALTER TABLE `contacts` ADD `entreprise` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `dedup_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `contacts` SET `dedup_key` = CASE
  WHEN trim(lower(coalesce(json_extract(`handles`, '$.email'), ''))) <> ''
    THEN 'email:' || trim(lower(json_extract(`handles`, '$.email')))
  ELSE 'name:' || trim(lower(`nom`)) || '|' || trim(lower(coalesce(`entreprise`, '')))
END WHERE `dedup_key` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contacts_user_dedup` ON `contacts` (`user_id`,`dedup_key`);
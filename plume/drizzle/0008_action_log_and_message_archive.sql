CREATE TABLE `action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`prev_state` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `archived_at` integer;
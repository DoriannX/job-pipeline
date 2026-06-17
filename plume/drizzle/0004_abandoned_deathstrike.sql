CREATE TABLE `seed_voix` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`texte` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

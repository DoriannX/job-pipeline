CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nom` text NOT NULL,
	`canal_prefere` text,
	`handles` text,
	`notes` text,
	`dernier_contact_at` integer,
	`source` text DEFAULT 'manuel' NOT NULL,
	`imported_at` integer,
	`legal_basis` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

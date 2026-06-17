CREATE TABLE `generation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`generated` text NOT NULL,
	`sent` text NOT NULL,
	`edit_distance` real NOT NULL,
	`raw_intent` text NOT NULL,
	`prompt_version` integer NOT NULL,
	`model_id` text NOT NULL,
	`voice_examples_ref` text,
	`sanitize_version` integer NOT NULL,
	`tokens_input` integer NOT NULL,
	`tokens_output` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`canal` text NOT NULL,
	`texte` text NOT NULL,
	`texte_genere` text,
	`statut` text DEFAULT 'brouillon' NOT NULL,
	`genere_par_ia` integer DEFAULT false NOT NULL,
	`envoye_at` integer,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);

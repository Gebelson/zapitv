CREATE TABLE `processed_sync_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`mutation_type` text NOT NULL,
	`canonical_id` text NOT NULL,
	`processed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `processed_sync_mutations_profile_id_idx` ON `processed_sync_mutations` (`profile_id`);--> statement-breakpoint
CREATE INDEX `processed_sync_mutations_expires_at_idx` ON `processed_sync_mutations` (`expires_at`);
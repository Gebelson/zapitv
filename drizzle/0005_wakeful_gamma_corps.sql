CREATE TABLE `profile_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`added_at` integer NOT NULL,
	`is_removed` integer DEFAULT 0 NOT NULL,
	`removed_at` integer,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_favorites_key_idx` ON `profile_favorites` (`profile_id`,`canonical_id`);--> statement-breakpoint
CREATE INDEX `profile_favorites_profile_status_idx` ON `profile_favorites` (`profile_id`,`is_removed`,`updated_at`);--> statement-breakpoint
CREATE TABLE `profile_my_list` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`added_at` integer NOT NULL,
	`is_removed` integer DEFAULT 0 NOT NULL,
	`removed_at` integer,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_mylist_key_idx` ON `profile_my_list` (`profile_id`,`canonical_id`);--> statement-breakpoint
CREATE INDEX `profile_mylist_profile_status_idx` ON `profile_my_list` (`profile_id`,`is_removed`,`updated_at`);--> statement-breakpoint
CREATE TABLE `profile_playback_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`content_type` text NOT NULL,
	`season` integer DEFAULT 0 NOT NULL,
	`episode` integer DEFAULT 0 NOT NULL,
	`position_sec` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`is_completed` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`device_name` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_progress_key_idx` ON `profile_playback_progress` (`profile_id`,`canonical_id`,`season`,`episode`);--> statement-breakpoint
CREATE INDEX `profile_progress_profile_updated_idx` ON `profile_playback_progress` (`profile_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `profile_watch_history` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`content_type` text NOT NULL,
	`season` integer DEFAULT 0 NOT NULL,
	`episode` integer DEFAULT 0 NOT NULL,
	`title` text,
	`poster_url` text,
	`year` integer,
	`watched_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_history_key_idx` ON `profile_watch_history` (`profile_id`,`canonical_id`,`season`,`episode`);--> statement-breakpoint
CREATE INDEX `profile_history_profile_watched_idx` ON `profile_watch_history` (`profile_id`,`watched_at`);
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`setting_key` text NOT NULL,
	`previous_version` integer NOT NULL,
	`next_version` integer NOT NULL,
	`actor_uid` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_setting_time_idx` ON `admin_audit` (`setting_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`title` text,
	`air_date` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_media_season_number_idx` ON `episodes` (`media_id`,`season_number`,`episode_number`);--> statement-breakpoint
CREATE TABLE `global_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`description` text,
	`poster_url` text,
	`backdrop_url` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_type_title_idx` ON `media` (`type`,`title`);--> statement-breakpoint
CREATE INDEX `media_type_year_idx` ON `media` (`type`,`year`);--> statement-breakpoint
CREATE TABLE `media_external_ids` (
	`media_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	PRIMARY KEY(`media_id`, `provider`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_external_provider_id_idx` ON `media_external_ids` (`provider`,`external_id`);
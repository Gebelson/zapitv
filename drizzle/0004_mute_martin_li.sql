CREATE TABLE `device_link_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code_hash` text NOT NULL,
	`user_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_id` text,
	`device_name` text DEFAULT 'Smart TV' NOT NULL,
	`device_type` text DEFAULT 'smart_tv' NOT NULL,
	`client_ip` text,
	`user_agent` text,
	`poll_count` integer DEFAULT 0 NOT NULL,
	`last_polled_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`approved_at` integer,
	`consumed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_link_challenges_device_code_hash_idx` ON `device_link_challenges` (`device_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_link_challenges_user_code_idx` ON `device_link_challenges` (`user_code`);--> statement-breakpoint
CREATE INDEX `device_link_challenges_status_expires_idx` ON `device_link_challenges` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `linked_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`device_name` text NOT NULL,
	`device_type` text NOT NULL,
	`client_ip` text,
	`user_agent` text,
	`last_active_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `linked_devices_user_id_idx` ON `linked_devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `linked_devices_session_id_idx` ON `linked_devices` (`session_id`);
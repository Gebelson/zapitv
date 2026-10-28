CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`attempt_at` integer NOT NULL,
	`success` integer DEFAULT 0 NOT NULL,
	`ip_address` text
);
--> statement-breakpoint
CREATE INDEX `login_attempts_identifier_time_idx` ON `login_attempts` (`identifier`,`attempt_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE TABLE `watchparty_rooms` (
	`room_id` text PRIMARY KEY NOT NULL,
	`host_peer_id` text NOT NULL,
	`host_nickname` text NOT NULL,
	`media_json` text,
	`transmission_mode` text DEFAULT 'host_broadcast' NOT NULL,
	`lifecycle_state` text DEFAULT 'LOBBY' NOT NULL,
	`intro_start_timestamp` integer,
	`intro_duration` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_closed` integer DEFAULT 0 NOT NULL,
	`participants_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `watchparty_rooms_updated_idx` ON `watchparty_rooms` (`updated_at`);--> statement-breakpoint
CREATE TABLE `watchparty_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`sender_peer_id` text NOT NULL,
	`target_peer_id` text,
	`type` text NOT NULL,
	`data_json` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `watchparty_signals_room_time_idx` ON `watchparty_signals` (`room_id`,`timestamp`);
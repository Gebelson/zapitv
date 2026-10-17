CREATE TABLE `source_evidence_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL,
	`media_type` text NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`provider_id` text NOT NULL,
	`source_ref` text NOT NULL,
	`format` text NOT NULL,
	`issued_at` integer NOT NULL,
	`outcome` text
);
--> statement-breakpoint
CREATE INDEX `source_evidence_tickets_issued_idx` ON `source_evidence_tickets` (`issued_at`);--> statement-breakpoint
CREATE TABLE `source_reliability` (
	`canonical_id` text NOT NULL,
	`media_type` text NOT NULL,
	`season` integer DEFAULT 0 NOT NULL,
	`episode` integer DEFAULT 0 NOT NULL,
	`provider_id` text NOT NULL,
	`source_ref` text NOT NULL,
	`format` text NOT NULL,
	`audio_language` text,
	`quality` text,
	`successes` integer DEFAULT 0 NOT NULL,
	`startup_failures` integer DEFAULT 0 NOT NULL,
	`playback_failures` integer DEFAULT 0 NOT NULL,
	`last_success_at` integer,
	`last_failure_at` integer,
	`average_startup_ms` integer,
	`status` text DEFAULT 'provisional' NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`canonical_id`, `media_type`, `season`, `episode`, `provider_id`, `source_ref`)
);
--> statement-breakpoint
CREATE INDEX `source_reliability_lookup_idx` ON `source_reliability` (`canonical_id`,`media_type`,`season`,`episode`,`expires_at`);
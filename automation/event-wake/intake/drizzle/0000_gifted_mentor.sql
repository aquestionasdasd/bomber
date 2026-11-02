CREATE TABLE `discord_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`content_hash` text NOT NULL,
	`received_at` integer NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discord_requests_author_time` ON `discord_requests` (`author_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `discord_requests_time` ON `discord_requests` (`received_at`);
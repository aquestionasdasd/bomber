CREATE TABLE `discord_request_results` (
	`request_id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`source_commit` text,
	`shared_commit` text,
	`deployment_id` text,
	`receipt_hash` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `discord_requests`(`id`) ON UPDATE no action ON DELETE cascade
);

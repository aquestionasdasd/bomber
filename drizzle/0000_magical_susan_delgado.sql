CREATE TABLE `online_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`team` text NOT NULL,
	`ready` integer NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`room_code`) REFERENCES `online_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `online_members_room_team` ON `online_members` (`room_code`,`team`,`left_at`);--> statement-breakpoint
CREATE TABLE `online_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`sender_id` text NOT NULL,
	`to_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `online_rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `online_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `online_messages_room_seq` ON `online_messages` (`room_code`,`seq`);--> statement-breakpoint
CREATE INDEX `online_messages_rate` ON `online_messages` (`room_code`,`sender_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `online_messages_expiry` ON `online_messages` (`expires_at`);--> statement-breakpoint
CREATE TABLE `online_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`status` text NOT NULL,
	`settings` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`host_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `online_rooms_expiry` ON `online_rooms` (`expires_at`);
CREATE TABLE `disposition_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`disposition_id` int NOT NULL,
	`user_id` int NOT NULL,
	`aktivitas` varchar(100) NOT NULL,
	`keterangan` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `disposition_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `disposition_histories` ADD CONSTRAINT `disposition_histories_disposition_id_dispositions_id_fk` FOREIGN KEY (`disposition_id`) REFERENCES `dispositions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disposition_histories` ADD CONSTRAINT `disposition_histories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `dispositions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letter_id` int NOT NULL,
	`parent_disposition_id` int,
	`nomor_disposisi` varchar(50) NOT NULL,
	`tanggal_disposisi` timestamp NOT NULL DEFAULT (now()),
	`from_user_id` int NOT NULL,
	`target_type` varchar(20) NOT NULL,
	`to_department_id` int,
	`to_user_id` int,
	`instruksi` text NOT NULL,
	`catatan_tambahan` text,
	`prioritas` varchar(20) NOT NULL DEFAULT 'Biasa',
	`batas_waktu` date,
	`status_tindak_lanjut` varchar(30) NOT NULL DEFAULT 'Belum Diproses',
	`catatan_tindak_lanjut` text,
	`tanggal_selesai` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `dispositions_id` PRIMARY KEY(`id`),
	CONSTRAINT `dispositions_nomor_disposisi_unique` UNIQUE(`nomor_disposisi`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `150` TO `name`;--> statement-breakpoint
ALTER TABLE `dispositions` ADD CONSTRAINT `dispositions_letter_id_incoming_letters_id_fk` FOREIGN KEY (`letter_id`) REFERENCES `incoming_letters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispositions` ADD CONSTRAINT `dispositions_parent_disposition_id_dispositions_id_fk` FOREIGN KEY (`parent_disposition_id`) REFERENCES `dispositions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispositions` ADD CONSTRAINT `dispositions_from_user_id_users_id_fk` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispositions` ADD CONSTRAINT `dispositions_to_department_id_departments_id_fk` FOREIGN KEY (`to_department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispositions` ADD CONSTRAINT `dispositions_to_user_id_users_id_fk` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `outgoing_letter_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letter_id` int NOT NULL,
	`user_id` int NOT NULL,
	`aktivitas` varchar(100) NOT NULL,
	`keterangan` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outgoing_letter_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outgoing_letters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomor_agenda` varchar(50) NOT NULL,
	`nomor_surat` varchar(100) NOT NULL,
	`tanggal_surat` date NOT NULL,
	`tanggal_dikirim` date NOT NULL,
	`pembuat_surat` varchar(150) NOT NULL,
	`tujuan_surat` varchar(255) NOT NULL,
	`perihal` varchar(255) NOT NULL,
	`jenis_surat` varchar(100) NOT NULL,
	`file_path` varchar(255) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`keterangan` text,
	`status_surat` varchar(50) NOT NULL DEFAULT 'Tercatat',
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `outgoing_letters_id` PRIMARY KEY(`id`),
	CONSTRAINT `outgoing_letters_nomor_agenda_unique` UNIQUE(`nomor_agenda`)
);
--> statement-breakpoint
ALTER TABLE `outgoing_letter_histories` ADD CONSTRAINT `outgoing_letter_histories_letter_id_outgoing_letters_id_fk` FOREIGN KEY (`letter_id`) REFERENCES `outgoing_letters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outgoing_letter_histories` ADD CONSTRAINT `outgoing_letter_histories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outgoing_letters` ADD CONSTRAINT `outgoing_letters_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
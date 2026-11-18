CREATE TABLE `incoming_letter_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letter_id` int NOT NULL,
	`user_id` int NOT NULL,
	`aktivitas` varchar(100) NOT NULL,
	`keterangan` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incoming_letter_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incoming_letters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomor_agenda` varchar(50) NOT NULL,
	`nomor_surat` varchar(100),
	`tanggal_surat` date NOT NULL,
	`tanggal_diterima` date NOT NULL,
	`pengirim` varchar(150) NOT NULL,
	`perihal` varchar(255) NOT NULL,
	`jenis_surat` varchar(100) NOT NULL,
	`sumber_surat` varchar(50),
	`keterangan` text,
	`file_path` varchar(255) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'Draft',
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `incoming_letters_id` PRIMARY KEY(`id`),
	CONSTRAINT `incoming_letters_nomor_agenda_unique` UNIQUE(`nomor_agenda`)
);
--> statement-breakpoint
ALTER TABLE `incoming_letter_histories` ADD CONSTRAINT `incoming_letter_histories_letter_id_incoming_letters_id_fk` FOREIGN KEY (`letter_id`) REFERENCES `incoming_letters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incoming_letter_histories` ADD CONSTRAINT `incoming_letter_histories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incoming_letters` ADD CONSTRAINT `incoming_letters_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
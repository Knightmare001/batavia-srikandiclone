CREATE TABLE `disposition_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`disposition_id` int NOT NULL,
	`user_id` int NOT NULL,
	`status_tindak_lanjut` varchar(30) NOT NULL DEFAULT 'Belum Diproses',
	`catatan_tindak_lanjut` text,
	`tanggal_selesai` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disposition_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `disposition_assignments_disposition_user_unique` UNIQUE(`disposition_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `disposition_assignments` ADD CONSTRAINT `disposition_assignments_disposition_id_dispositions_id_fk` FOREIGN KEY (`disposition_id`) REFERENCES `dispositions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disposition_assignments` ADD CONSTRAINT `disposition_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `disposition_assignments` (`disposition_id`, `user_id`, `status_tindak_lanjut`, `catatan_tindak_lanjut`, `tanggal_selesai`)
SELECT d.`id`, u.`id`, d.`status_tindak_lanjut`, d.`catatan_tindak_lanjut`, d.`tanggal_selesai`
FROM `dispositions` d
INNER JOIN `users` u ON u.`deleted_at` IS NULL
INNER JOIN `roles` r ON r.`id` = u.`role_id` AND r.`name` = 'pegawai'
INNER JOIN `departments` unit ON unit.`id` = u.`department_id` AND unit.`deleted_at` IS NULL
WHERE d.`deleted_at` IS NULL
  AND d.`parent_disposition_id` IS NULL
  AND ((d.`target_type` = 'department' AND d.`to_department_id` = u.`department_id`) OR d.`target_type` = 'all');

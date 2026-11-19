-- Consolidate legacy Wakasek and Guru/Staf roles into pegawai.
INSERT INTO `departments` (`name`) VALUES ('Pegawai') ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);--> statement-breakpoint
INSERT INTO `roles` (`name`, `description`) VALUES ('pegawai', 'Pegawai Sekolah') ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);--> statement-breakpoint
UPDATE `users` SET `department_id` = (SELECT `id` FROM `departments` WHERE `name` = 'Pegawai' LIMIT 1) WHERE `department_id` IS NULL AND `role_id` IN (SELECT `id` FROM `roles` WHERE `name` IN ('kepala_unit', 'guru_staf'));--> statement-breakpoint
-- Preserve old role-targeted records as legacy broadcast records before removing the role target field.
UPDATE `dispositions` SET `target_type` = 'all', `to_department_id` = NULL, `to_user_id` = NULL WHERE `target_type` = 'role';--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'pegawai' LIMIT 1) WHERE `role_id` IN (SELECT `id` FROM `roles` WHERE `name` IN ('kepala_unit', 'guru_staf'));--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'pegawai' LIMIT 1) WHERE `role_id` IN (SELECT `id` FROM `roles` WHERE `name` NOT IN ('admin', 'tu', 'kepala_sekolah', 'pegawai'));--> statement-breakpoint
DELETE FROM `roles` WHERE `name` NOT IN ('admin', 'tu', 'kepala_sekolah', 'pegawai');--> statement-breakpoint
ALTER TABLE `departments` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `dispositions` DROP COLUMN `to_role`;

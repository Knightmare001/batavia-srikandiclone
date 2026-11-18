import { mysqlTable, varchar, text, timestamp, int, date } from "drizzle-orm/mysql-core";

// 1. Roles Table
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Departments Table
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Users Table
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  nip: varchar("nip", { length: 30 }).unique(),
  name: varchar("150", { length: 150 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  roleId: int("role_id")
    .notNull()
    .references(() => roles.id),
  departmentId: int("department_id").references(() => departments.id),
  jabatan: varchar("jabatan", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Incoming letters and their audit trail.
export const incomingLetters = mysqlTable("incoming_letters", {
  id: int("id").autoincrement().primaryKey(),
  nomorAgenda: varchar("nomor_agenda", { length: 50 }).notNull().unique(),
  nomorSurat: varchar("nomor_surat", { length: 100 }),
  tanggalSurat: date("tanggal_surat", { mode: "string" }).notNull(),
  tanggalDiterima: date("tanggal_diterima", { mode: "string" }).notNull(),
  pengirim: varchar("pengirim", { length: 150 }).notNull(),
  perihal: varchar("perihal", { length: 255 }).notNull(),
  jenisSurat: varchar("jenis_surat", { length: 100 }).notNull(),
  sumberSurat: varchar("sumber_surat", { length: 50 }),
  keterangan: text("keterangan"),
  filePath: varchar("file_path", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  createdBy: int("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const incomingLetterHistories = mysqlTable("incoming_letter_histories", {
  id: int("id").autoincrement().primaryKey(),
  letterId: int("letter_id")
    .notNull()
    .references(() => incomingLetters.id, { onDelete: "cascade" }),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  aktivitas: varchar("aktivitas", { length: 100 }).notNull(),
  keterangan: varchar("keterangan", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type IncomingLetter = typeof incomingLetters.$inferSelect;
export type NewIncomingLetter = typeof incomingLetters.$inferInsert;

export type IncomingLetterHistory = typeof incomingLetterHistories.$inferSelect;


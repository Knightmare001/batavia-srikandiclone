import { db } from "./db";
import { systemAuditLogs } from "./schema";

export async function writeAuditLog(input: {
  userId: number;
  roleName: string;
  modul: string;
  aktivitas: string;
  deskripsi?: string | null;
  ipAddress?: string | null;
}) {
  await db.insert(systemAuditLogs).values(input);
}

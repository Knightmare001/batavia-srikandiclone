import { ClientError } from "../../../exceptions/clientError";

export type InitialDispositionPayload = {
  letter_id: number; target_type: "department" | "user" | "all";
  to_department_id?: number | null; to_user_id?: number | null; instruksi: string;
  prioritas: "Biasa" | "Penting" | "Segera"; batas_waktu?: string | null; catatan_tambahan?: string | null;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClientError("Request body must be an object");
  return value as Record<string, unknown>;
}
function positiveId(value: unknown, name: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ClientError(`${name} must be a positive integer`);
  return id;
}
function optionalText(value: unknown, name: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") throw new ClientError(`${name} must be a string`);
  return value.trim() || null;
}
function validDate(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ClientError(`${name} must be a valid YYYY-MM-DD date`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ClientError(`${name} must be a valid YYYY-MM-DD date`);
  if (value < new Date().toISOString().slice(0, 10)) throw new ClientError(`${name} cannot be in the past`);
  return value;
}

export function validateInitialPayload(value: unknown): InitialDispositionPayload {
  const b = object(value);
  const targetType = b.target_type;
  if (!["department", "user", "all"].includes(String(targetType))) throw new ClientError("target_type must be department, user, or all");
  const departmentId = b.to_department_id == null ? null : positiveId(b.to_department_id, "to_department_id");
  const userId = b.to_user_id == null ? null : positiveId(b.to_user_id, "to_user_id");
  if (targetType === "department" && !departmentId) throw new ClientError("to_department_id is required for department target");
  if (targetType === "user" && !userId) throw new ClientError("to_user_id is required for user target");
  if (targetType === "all" && (departmentId || userId)) throw new ClientError("all target cannot specify a department or user");
  if (typeof b.instruksi !== "string" || !b.instruksi.trim()) throw new ClientError("instruksi is required");
  const prioritas = b.prioritas ?? "Biasa";
  if (!["Biasa", "Penting", "Segera"].includes(String(prioritas))) throw new ClientError("prioritas must be Biasa, Penting, or Segera");
  return { letter_id: positiveId(b.letter_id, "letter_id"), target_type: targetType as InitialDispositionPayload["target_type"], to_department_id: departmentId, to_user_id: userId, instruksi: b.instruksi.trim(), prioritas: prioritas as InitialDispositionPayload["prioritas"], batas_waktu: validDate(b.batas_waktu, "batas_waktu"), catatan_tambahan: optionalText(b.catatan_tambahan, "catatan_tambahan") };
}

export function validateForwardPayload(value: unknown) {
  const b = object(value);
  if (typeof b.instruksi_lanjutan !== "string" || !b.instruksi_lanjutan.trim()) throw new ClientError("instruksi_lanjutan is required");
  return { to_user_id: positiveId(b.to_user_id, "to_user_id"), instruksi: b.instruksi_lanjutan.trim(), batas_waktu: validDate(b.batas_waktu, "batas_waktu"), catatan_tambahan: optionalText(b.catatan_tambahan, "catatan_tambahan") };
}

export function validateFollowUpPayload(value: unknown) {
  const b = object(value);
  if (!["Belum Diproses", "Diproses", "Selesai"].includes(String(b.status))) throw new ClientError("status must be Belum Diproses, Diproses, or Selesai");
  const note = optionalText(b.catatan_tindak_lanjut, "catatan_tindak_lanjut");
  if (b.status === "Selesai" && !note) throw new ClientError("catatan_tindak_lanjut is required when completing a disposition");
  return { status: b.status as "Belum Diproses" | "Diproses" | "Selesai", catatan_tindak_lanjut: note };
}

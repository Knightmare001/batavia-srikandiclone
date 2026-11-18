import { ClientError } from "../../../exceptions/clientError";
import { validateUploadedDocument } from "../../incomingLetters/validator/schema";

export interface OutgoingLetterPayload {
  nomor_surat: string;
  tanggal_surat: string;
  tanggal_dikirim: string;
  pembuat_surat: string;
  tujuan_surat: string;
  perihal: string;
  jenis_surat: string;
  keterangan?: string | null;
}

const required = ["nomor_surat", "tanggal_surat", "tanggal_dikirim", "pembuat_surat", "tujuan_surat", "perihal", "jenis_surat"] as const;
const fields = new Set([...required, "keterangan"]);
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateOutgoingLetterPayload(value: unknown, partial = false): asserts value is Partial<OutgoingLetterPayload> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClientError("Request body is invalid");
  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) if (!fields.has(key as never)) throw new ClientError(`${key} is not an allowed field`);
  if (!partial && required.some((key) => typeof body[key] !== "string" || !String(body[key]).trim())) throw new ClientError("All required surat keluar fields must be provided");
  for (const key of required) {
    if (body[key] !== undefined && (typeof body[key] !== "string" || !body[key].trim())) throw new ClientError(`${key} is required`);
  }
  for (const key of ["tanggal_surat", "tanggal_dikirim"] as const) if (body[key] !== undefined && !validDate(body[key])) throw new ClientError(`${key} must use a valid YYYY-MM-DD date`);
  for (const key of [...required.filter((field) => !field.startsWith("tanggal_")), "keterangan"] as const) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") throw new ClientError(`${key} must be a string`);
  }
  const limits: Record<string, number> = { nomor_surat: 100, pembuat_surat: 150, tujuan_surat: 255, perihal: 255, jenis_surat: 100, keterangan: 65535 };
  for (const [key, limit] of Object.entries(limits)) if (typeof body[key] === "string" && (body[key] as string).length > limit) throw new ClientError(`${key} exceeds ${limit} characters`);
}

export { validateUploadedDocument };

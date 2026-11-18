import { ClientError } from "../../../exceptions/clientError";

export interface IncomingLetterPayload {
  nomor_surat?: string;
  tanggal_surat: string;
  tanggal_diterima: string;
  pengirim: string;
  perihal: string;
  jenis_surat: string;
  sumber_surat?: string;
  keterangan?: string;
}

const requiredFields = ["tanggal_surat", "tanggal_diterima", "pengirim", "perihal", "jenis_surat"] as const;
const allowedFields = new Set([
  "nomor_surat",
  "tanggal_surat",
  "tanggal_diterima",
  "pengirim",
  "perihal",
  "jenis_surat",
  "sumber_surat",
  "keterangan",
]);
const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateIncomingLetterPayload(payload: any, partial = false): asserts payload is IncomingLetterPayload {
  if (!payload || typeof payload !== "object") {
    throw new ClientError("Request body is invalid");
  }

  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field)) throw new ClientError(`${field} is not an allowed field`);
  }

  if (!partial && requiredFields.some((field) => typeof payload[field] !== "string" || !payload[field].trim())) {
    throw new ClientError("tanggal_surat, tanggal_diterima, pengirim, perihal, and jenis_surat are required");
  }

  for (const field of ["tanggal_surat", "tanggal_diterima"] as const) {
    if (payload[field] !== undefined && !isValidDate(payload[field])) {
      throw new ClientError(`${field} must use a valid YYYY-MM-DD date`);
    }
  }

  for (const field of ["nomor_surat", "pengirim", "perihal", "jenis_surat", "sumber_surat", "keterangan"] as const) {
    if (payload[field] !== undefined && typeof payload[field] !== "string") {
      throw new ClientError(`${field} must be a string`);
    }
  }

  if (
    partial &&
    (["tanggal_surat", "tanggal_diterima", "pengirim", "perihal", "jenis_surat"] as const).some(
      (field) => payload[field] !== undefined && typeof payload[field] === "string" && !payload[field].trim()
    )
  ) {
    throw new ClientError("required fields cannot be empty");
  }

  for (const [field, maxLength] of [
    ["nomor_surat", 100],
    ["pengirim", 150],
    ["perihal", 255],
    ["jenis_surat", 100],
    ["sumber_surat", 50],
    ["keterangan", 65535],
  ] as const) {
    if (typeof payload[field] === "string" && payload[field].length > maxLength) {
      throw new ClientError(`${field} exceeds ${maxLength} characters`);
    }
  }
}

export function validateUploadedDocument(file: Express.Multer.File) {
  const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (!allowedExtensions.has(extension) || file.mimetype !== mimeByExtension[extension]) {
    throw new ClientError("file_surat must be a PDF, DOC, or DOCX document");
  }

  const isPdf = extension === ".pdf" && file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isDoc = extension === ".doc" && file.buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isDocx =
    extension === ".docx" &&
    file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    file.buffer.includes(Buffer.from("[Content_Types].xml")) &&
    file.buffer.includes(Buffer.from("word/document.xml"));

  if (!isPdf && !isDoc && !isDocx) {
    throw new ClientError("file_surat content does not match a supported PDF or Word document");
  }
  return extension;
}

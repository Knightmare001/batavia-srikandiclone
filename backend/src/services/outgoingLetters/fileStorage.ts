import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { validateUploadedDocument } from "./validator/schema";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/uploads/outgoing");

export async function storeOutgoingDocument(file: Express.Multer.File) {
  const extension = validateUploadedDocument(file);
  const fileName = basename(file.originalname.replaceAll("\\", "/"));
  if (fileName.length > 255) throw new ClientError("file_surat filename exceeds 255 characters");
  const stored = `${randomUUID()}${extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, stored), file.buffer, { flag: "wx", mode: 0o640 });
  return { filePath: stored, fileName };
}

export async function readOutgoingDocument(filePath: string) {
  if (basename(filePath) !== filePath) throw new NotFoundError("Document not found");
  const fullPath = resolve(directory, filePath);
  if (!fullPath.startsWith(`${directory}${sep}`)) throw new NotFoundError("Document not found");
  try { return await readFile(fullPath); } catch { throw new NotFoundError("Document not found"); }
}

export async function removeOutgoingDocument(filePath: string) {
  if (!filePath || basename(filePath) !== filePath) return;
  const fullPath = resolve(directory, filePath);
  if (!fullPath.startsWith(`${directory}${sep}`)) return;
  await unlink(fullPath).catch(() => undefined);
}

export function outgoingDocumentMime(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case ".pdf": return "application/pdf";
    case ".doc": return "application/msword";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default: return "application/octet-stream";
  }
}

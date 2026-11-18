import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { validateUploadedDocument } from "./validator/schema";

const uploadsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/uploads");

export async function storeIncomingLetterDocument(file: Express.Multer.File) {
  const extension = validateUploadedDocument(file);
  const storedName = `${randomUUID()}${extension}`;
  const originalName = basename(file.originalname.replaceAll("\\", "/"));
  if (originalName.length > 255) {
    throw new ClientError("file_surat filename exceeds 255 characters");
  }
  await mkdir(uploadsDirectory, { recursive: true });
  const fullPath = resolve(uploadsDirectory, storedName);
  await writeFile(fullPath, file.buffer, { flag: "wx", mode: 0o640 });
  return { filePath: storedName, fileName: originalName, fullPath };
}

export async function readIncomingLetterDocument(filePath: string) {
  if (basename(filePath) !== filePath) {
    throw new NotFoundError("Document not found");
  }
  const fullPath = resolve(uploadsDirectory, filePath);
  if (!fullPath.startsWith(`${uploadsDirectory}${sep}`)) {
    throw new NotFoundError("Document not found");
  }
  try {
    return await readFile(fullPath);
  } catch {
    throw new NotFoundError("Document not found");
  }
}

export async function removeIncomingLetterDocument(filePath: string) {
  if (!filePath || basename(filePath) !== filePath) return;
  const fullPath = resolve(uploadsDirectory, filePath);
  if (!fullPath.startsWith(`${uploadsDirectory}${sep}`)) return;
  await unlink(fullPath).catch(() => undefined);
}

export function getIncomingLetterDocumentMime(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

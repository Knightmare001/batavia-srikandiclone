import multer from "multer";
import { ClientError } from "../../exceptions/clientError";

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const incomingLetterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!extension || !supportedMimeTypes.has(file.mimetype)) {
      return callback(new ClientError("file_surat must be a PDF, DOC, or DOCX document"));
    }
    return callback(null, true);
  },
});

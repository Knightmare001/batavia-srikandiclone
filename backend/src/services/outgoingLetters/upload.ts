import multer from "multer";
import { ClientError } from "../../exceptions/clientError";

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const outgoingLetterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension =
      file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    if (
      !mimeByExtension[extension] ||
      mimeByExtension[extension] !== file.mimetype
    )
      return callback(
        new ClientError("file_surat must be a PDF, DOC, or DOCX document"),
      );
    callback(null, true);
  },
});

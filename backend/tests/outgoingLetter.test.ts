import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeRoles } from "../src/middleware/authMiddleware";
import {
  validateOutgoingLetterPayload,
  validateUploadedDocument,
} from "../src/services/outgoingLetters/validator/schema";

const validPayload = {
  nomor_surat: "050/SMK/XI/2026",
  tanggal_surat: "2026-11-18",
  tanggal_dikirim: "2026-11-19",
  pembuat_surat: "Wakasek Kurikulum",
  tujuan_surat: "Seluruh Guru",
  perihal: "Undangan Rapat Evaluasi",
  jenis_surat: "Undangan",
};

describe("Outgoing letter validation and access", () => {
  it("accepts complete metadata and rejects invalid dates or unknown fields", () => {
    assert.doesNotThrow(() => validateOutgoingLetterPayload(validPayload));
    assert.throws(
      () =>
        validateOutgoingLetterPayload({
          ...validPayload,
          tanggal_surat: "2026-02-30",
        }),
      /tanggal_surat must use a valid/,
    );
    assert.throws(
      () =>
        validateOutgoingLetterPayload({
          ...validPayload,
          nomor_agenda: "SK-999/2026",
        }),
      /not an allowed field/,
    );
  });

  it("validates PDF and Word file signatures", () => {
    const file = (originalname: string, mimetype: string, buffer: Buffer) =>
      ({ originalname, mimetype, buffer }) as Express.Multer.File;
    assert.equal(
      validateUploadedDocument(
        file("letter.pdf", "application/pdf", Buffer.from("%PDF-1.7")),
      ),
      ".pdf",
    );
    assert.equal(
      validateUploadedDocument(
        file(
          "letter.doc",
          "application/msword",
          Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        ),
      ),
      ".doc",
    );
    assert.throws(
      () =>
        validateUploadedDocument(
          file("letter.pdf", "application/pdf", Buffer.from("not a PDF")),
        ),
      /content does not match/,
    );
  });

  it("restricts mutations to TU and admin roles", () => {
    const guard = authorizeRoles("tu", "admin");
    let status = 200;
    let nextCalled = false;
    const response = {
      status(code: number) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    } as never;
    guard({ authUser: { id: 1, role: "pegawai" } } as never, response, (() => {
      nextCalled = true;
    }) as never);
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
    guard({ authUser: { id: 2, role: "tu" } } as never, response, (() => {
      nextCalled = true;
    }) as never);
    assert.equal(nextCalled, true);
  });
});

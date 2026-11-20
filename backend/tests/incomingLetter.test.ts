import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateIncomingLetterPayload,
  validateUploadedDocument,
} from "../src/services/incomingLetters/validator/schema";
import { authorizeRoles } from "../src/middleware/authMiddleware";
import { createAccessToken, verifyAccessToken } from "../src/lib/jwt";

process.env.JWT_SECRET ??= "test-secret-with-at-least-32-characters";

const validPayload = {
  tanggal_surat: "2026-11-10",
  tanggal_diterima: "2026-11-12",
  pengirim: "Wakasek Sarpras",
  perihal: "Laporan kerusakan",
  jenis_surat: "Laporan",
};

describe("Incoming letter validation", () => {
  it("accepts complete metadata and rejects missing required fields", () => {
    assert.doesNotThrow(() => validateIncomingLetterPayload(validPayload));
    assert.throws(
      () => validateIncomingLetterPayload({ ...validPayload, pengirim: "" }),
      /are required/,
    );
  });

  it("rejects invalid calendar dates and overlong values", () => {
    assert.throws(
      () =>
        validateIncomingLetterPayload({
          ...validPayload,
          tanggal_surat: "2026-02-30",
        }),
      /valid YYYY-MM-DD/,
    );
    assert.throws(
      () =>
        validateIncomingLetterPayload({
          ...validPayload,
          perihal: "x".repeat(256),
        }),
      /exceeds 255/,
    );
  });

  it("accepts PDF and Word signatures and rejects mismatched content", () => {
    const pdf = {
      originalname: "letter.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 test document"),
    } as Express.Multer.File;
    assert.equal(validateUploadedDocument(pdf), ".pdf");

    const doc = {
      originalname: "letter.doc",
      mimetype: "application/msword",
      buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    } as Express.Multer.File;
    assert.equal(validateUploadedDocument(doc), ".doc");

    const docx = {
      originalname: "letter.docx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from("[Content_Types].xml word/document.xml"),
      ]),
    } as Express.Multer.File;
    assert.equal(validateUploadedDocument(docx), ".docx");

    const fakePdf = {
      ...pdf,
      buffer: Buffer.from("not a PDF"),
    } as Express.Multer.File;
    assert.throws(
      () => validateUploadedDocument(fakePdf),
      /content does not match/,
    );
  });
});

describe("Incoming letter authorization", () => {
  it("issues tokens with user and role claims", async () => {
    const token = await createAccessToken(7, "tu");
    const payload = await verifyAccessToken(token);
    assert.equal(payload.sub, "7");
    assert.equal(payload.role, "tu");
    assert.ok(payload.exp);
  });

  it("allows only TU and admin roles to mutate letters", () => {
    for (const role of ["tu", "admin"]) {
      let calledNext = false;
      const response = { status: () => response, json: () => response } as any;
      authorizeRoles("tu", "admin")(
        { authUser: { id: 1, role } } as any,
        response,
        () => (calledNext = true),
      );
      assert.equal(calledNext, true);
    }

    let status = 0;
    const response = {
      status(code: number) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    } as any;
    authorizeRoles("tu", "admin")(
      { authUser: { id: 2, role: "pegawai" } } as any,
      response,
      () => {},
    );
    assert.equal(status, 403);
  });
});

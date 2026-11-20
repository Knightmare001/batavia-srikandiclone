import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAdvanceDisposition } from "../src/services/dispositions/dispositionService";
import { validateFollowUpPayload } from "../src/services/dispositions/validator/schema";

describe("Guru disposition follow-up", () => {
  it("allows forward progress and disallows rollback or edits after completion", () => {
    assert.equal(canAdvanceDisposition("Belum Diproses", "Diproses"), true);
    assert.equal(canAdvanceDisposition("Belum Diproses", "Selesai"), false);
    assert.equal(canAdvanceDisposition("Diproses", "Selesai"), true);
    assert.equal(canAdvanceDisposition("Diproses", "Belum Diproses"), false);
    assert.equal(canAdvanceDisposition("Selesai", "Diproses"), false);
    assert.equal(canAdvanceDisposition("Selesai", "Selesai"), false);
  });

  it("requires a completion report", () => {
    assert.throws(
      () => validateFollowUpPayload({ status: "Selesai" }),
      /catatan_tindak_lanjut is required/,
    );
    assert.deepEqual(
      validateFollowUpPayload({
        status: "Selesai",
        catatan_tindak_lanjut: "Pemeriksaan selesai",
      }),
      {
        status: "Selesai",
        catatan_tindak_lanjut: "Pemeriksaan selesai",
      },
    );
  });
});

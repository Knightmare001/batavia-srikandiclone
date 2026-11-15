import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateLoginPayload, validateUserPayload } from "../src/services/users/validator/schema";
import { InvariantError } from "../src/exceptions/clientError";

describe("User Validator Tests", () => {
  it("should fail when body is empty", () => {
    assert.throws(() => validateUserPayload({}), InvariantError);
  });

  it("should fail on invalid email format", () => {
    assert.throws(
      () => validateUserPayload({ email: "not-an-email", password: "password123" }),
      /Validation error: Invalid email format/
    );
  });

  it("should fail on short password", () => {
    assert.throws(
      () => validateUserPayload({ email: "valid@gmail.com", password: "short" }),
      /Password must be at least 8 characters long/
    );
  });

  it("should fail on password without numbers", () => {
    assert.throws(
      () => validateUserPayload({ email: "valid@gmail.com", password: "onlylettershere" }),
      /Password must contain both letters and numbers/
    );
  });

  it("should fail on invalid roleId", () => {
    assert.throws(
      () => validateUserPayload({ email: "valid@gmail.com", password: "validPassword123", roleId: -1, nip: "12345678" }),
      /RoleId must be a valid positive number/
    );
  });

  it("should pass on valid payload", () => {
    assert.doesNotThrow(() =>
      validateUserPayload({
        email: "admin@gmail.com",
        password: "admin123",
        name: "Admin User",
        roleId: 1,
        nip: "198501012010011001",
      })
    );
  });

  it("should reject registration without a valid NIP", () => {
    assert.throws(
      () => validateUserPayload({ email: "admin@gmail.com", password: "admin123", roleId: 1 }),
      /Validation error: Invalid nip format/
    );
    assert.throws(
      () => validateUserPayload({ email: "admin@gmail.com", password: "admin123", roleId: 1, nip: "abc" }),
      /Validation error: Invalid nip format/
    );
  });

  it("should reject an empty or invalid login payload", () => {
    assert.throws(() => validateLoginPayload({}), /Request body cannot be empty/);
    assert.throws(
      () => validateLoginPayload({ nip: "1234567", password: "Password123" }),
      /Validation error: Invalid nip format/
    );
    assert.throws(
      () => validateLoginPayload({ nip: "12345678", password: "short" }),
      /Password must be at least 8 characters long/
    );
  });
});

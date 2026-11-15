import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateUserPayload } from "../src/services/users/validator/schema";
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
      () => validateUserPayload({ email: "valid@gmail.com", password: "validPassword123", roleId: -1 }),
      /RoleId must be a valid positive number/
    );
  });

  it("should pass on valid payload", () => {
    assert.doesNotThrow(() =>
      validateUserPayload({ email: "admin@gmail.com", password: "admin123", name: "Admin User", roleId: 1 })
    );
  });
});

import { InvariantError } from "../../../exceptions/clientError";

export interface CreateUserPayload {
  name?: string;
  email: string;
  password: string;
  departmentId?: number;
  nip: string;
  jabatan?: string;
}

export interface LoginPayload {
  nip: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIP_REGEX = /^\d{8,18}$/;

function validateNip(nip: unknown): asserts nip is string {
  if (typeof nip !== "string" || !NIP_REGEX.test(nip.trim())) {
    throw new InvariantError("Validation error: Invalid nip format");
  }
}

function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8) {
    throw new InvariantError("Password must be at least 8 characters long");
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new InvariantError("Password must contain both letters and numbers");
  }
}

export function validateUserPayload(payload: any): asserts payload is CreateUserPayload {
  // 1. Validate request body exists
  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    throw new InvariantError("Request body cannot be empty");
  }

  const { email, password, name, nip } = payload;

  // 2. Validate email
  if (!email || typeof email !== "string" || email.trim() === "") {
    throw new InvariantError("Email is required");
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    throw new InvariantError("Validation error: Invalid email format");
  }

  // 3. Validate password
  if (!password || typeof password !== "string") {
    throw new InvariantError("Password is required");
  }

  validatePassword(password);

  // NIP is required for account registration and login.
  validateNip(nip);

  // Public registration cannot choose a privileged role.
  if (payload.roleId !== undefined) {
    throw new InvariantError("Role assignment is not allowed during registration");
  }

  // Validate name if provided
  if (name !== undefined && typeof name !== "string") {
    throw new InvariantError("Name must be a string");
  }
}

export function validateLoginPayload(payload: any): asserts payload is LoginPayload {
  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    throw new InvariantError("Request body cannot be empty");
  }

  validateNip(payload.nip);

  if (!payload.password || typeof payload.password !== "string") {
    throw new InvariantError("Password is required");
  }
  validatePassword(payload.password);
}


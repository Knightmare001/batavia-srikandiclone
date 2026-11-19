import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UserService } from "../src/services/users/userService";

process.env.JWT_SECRET ??= "test-secret-with-at-least-32-characters";

describe("UserService Integration Logic Tests", () => {
  it("should throw error if email already exists", async () => {
    const mockRepo = {
      findByNip: async () => null,
      findByEmail: async () => ({
        id: 1,
        email: "admin@gmail.com",
        name: "Admin",
        passwordHash: "xxx",
        roleId: 1,
        departmentId: null,
        nip: null,
        jabatan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
      findRoleById: async () => null,
      findRoleByName: async () => null,
      insertUser: async () => null,
    };

    const service = new UserService(mockRepo as any);
    await assert.rejects(
      service.createUser({ email: "admin@gmail.com", password: "password123", nip: "198501012010011001" }),
      /email already exists/
    );
  });

  it("should successfully hash password and return created user contract", async () => {
    let insertedData: any = null;
    const mockRepo = {
      findByNip: async () => null,
      findByEmail: async () => null,
      findRoleById: async () => null,
      findRoleByName: async () => ({ id: 5, name: "pegawai", description: "", createdAt: new Date() }),
      hasActiveDepartment: async () => true,
      insertUser: async (data: any) => {
        insertedData = data;
        return {
          id: 2,
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          roleId: data.roleId,
          departmentId: data.departmentId,
          nip: data.nip,
          jabatan: data.jabatan,
          createdAt: new Date("2026-11-08T10:00:00Z"),
          updatedAt: new Date("2026-11-08T10:00:00Z"),
          deletedAt: null,
        };
      },
    };

    const service = new UserService(mockRepo);
    const result = await service.createUser({
      name: "Budi Santoso",
      email: "budi@sekolah.sch.id",
      password: "Password123!",
      nip: "198501012010011002",
      departmentId: 1,
    });

    assert.equal(result.id, 2);
    assert.equal(result.email, "budi@sekolah.sch.id");
    assert.ok(result.created_at);
    assert.ok(result.updated_at);
    assert.notEqual(insertedData.passwordHash, "Password123!");
    assert.match(insertedData.passwordHash, /^\$2[ab]\$/);
  });

  it("should reject a NIP that is already registered", async () => {
    const mockRepo = {
      findByEmail: async () => null,
      findByNip: async () => ({ id: 1 }),
    };

    await assert.rejects(
      new UserService(mockRepo as any).createUser({
        email: "new-user@school.test",
        password: "Password123",
        nip: "198501012010011001",
      }),
      /nip already exists/
    );
  });

  it("should login and return only the public user profile", async () => {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.default.hash("Password123!", 4);
    const mockRepo = {
      findByNip: async () => ({
        id: 1,
        nip: "198501012010011001",
        email: "admin@gmail.com",
        name: "admin",
        passwordHash,
        roleId: 1,
        departmentId: null,
        jabatan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
      findRoleById: async () => ({ id: 1, name: "admin", description: "", createdAt: new Date() }),
    };

    const result = await new UserService(mockRepo as any).loginUser({
      nip: "198501012010011001",
      password: "Password123!",
    });

    assert.equal(result.nip, "198501012010011001");
    assert.equal(result.name, "admin");
    assert.equal(result.email, "admin@gmail.com");
    assert.equal(typeof result.access_token, "string");
    assert.equal("passwordHash" in result, false);
  });

  it("should return the same authentication error for unknown NIP and wrong password", async () => {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.default.hash("Password123!", 4);
    const unknownNipService = new UserService({ findByNip: async () => null } as any);
    const wrongPasswordService = new UserService({
      findByNip: async () => ({
        id: 1,
        nip: "198501012010011001",
        email: "admin@gmail.com",
        name: "admin",
        passwordHash,
        roleId: 1,
        departmentId: null,
        jabatan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
      findRoleById: async () => ({ id: 1, name: "admin", description: "", createdAt: new Date() }),
    } as any);

    await assert.rejects(
      unknownNipService.loginUser({ nip: "198501012010011002", password: "Password123!" }),
      (error: any) => error.statusCode === 401 && error.message === "nip atau password salah"
    );
    await assert.rejects(
      wrongPasswordService.loginUser({ nip: "198501012010011001", password: "WrongPass123" }),
      (error: any) => error.statusCode === 401 && error.message === "nip atau password salah"
    );
  });
});

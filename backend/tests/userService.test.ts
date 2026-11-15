import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UserService } from "../src/services/users/userService";

describe("UserService Integration Logic Tests", () => {
  it("should throw error if email already exists", async () => {
    const mockRepo = {
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
      service.createUser({ email: "admin@gmail.com", password: "password123" }),
      /email already exists/
    );
  });

  it("should successfully hash password and return created user contract", async () => {
    let insertedData: any = null;
    const mockRepo = {
      findByEmail: async () => null,
      findRoleById: async (id: number) => ({ id, name: "guru_staf", description: "", createdAt: new Date() }),
      findRoleByName: async () => null,
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
      roleId: 2,
    });

    assert.equal(result.id, 2);
    assert.equal(result.email, "budi@sekolah.sch.id");
    assert.ok(result.created_at);
    assert.ok(result.updated_at);
    assert.notEqual(insertedData.passwordHash, "Password123!");
    assert.match(insertedData.passwordHash, /^\$2[ab]\$/);
  });
});

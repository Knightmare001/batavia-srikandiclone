import "dotenv/config";
import bcrypt from "bcrypt";
import { db, poolConnection } from "./db";
import { roles, departments, users } from "./schema";
import { and, eq, inArray, like, not } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // 1. Seed Roles
    const initialRoles = [
      { name: "admin", description: "System Administrator" },
      { name: "tu", description: "Tata Usaha" },
      { name: "kepala_sekolah", description: "Kepala Sekolah" },
      { name: "pegawai", description: "Pegawai Sekolah" },
    ];

    for (const role of initialRoles) {
      const existing = await db.select().from(roles).where(eq(roles.name, role.name));
      if (existing.length === 0) {
        await db.insert(roles).values(role);
        console.log(`✓ Seeded role: ${role.name}`);
      }
    }

    // 2. Seed Departments
    const initialDepartments = [
      { name: "Tata Usaha" },
      { name: "Kurikulum" },
      { name: "Kesiswaan" },
      { name: "Sarpras" },
      { name: "Humas" },
      { name: "BK" },
      { name: "Perpustakaan" },
    ];

    for (const dept of initialDepartments) {
      const existing = await db.select().from(departments).where(eq(departments.name, dept.name));
      if (existing.length === 0) {
        await db.insert(departments).values(dept);
        console.log(`✓ Seeded department: ${dept.name}`);
      }
    }

    // 3. Seed Default Admin
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin"));
    const [tuDept] = await db.select().from(departments).where(eq(departments.name, "Tata Usaha"));

    if (adminRole) {
      const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@gmail.com"));
      if (existingAdmin.length === 0) {
        const passwordHash = await bcrypt.hash("admin123", 10);
        await db.insert(users).values({
          name: "admin",
          email: "admin@gmail.com",
          nip: "198501012010011001",
          passwordHash,
          roleId: adminRole.id,
          departmentId: tuDept ? tuDept.id : null,
          jabatan: "Administrator",
        });
        console.log("✓ Seeded default admin user (NIP: 198501012010011001, email: admin@gmail.com, pass: admin123)");
      } else {
        if (!existingAdmin[0]?.nip) {
          await db
            .update(users)
            .set({ nip: "198501012010011001" })
            .where(eq(users.id, existingAdmin[0]!.id));
          console.log("✓ Added default NIP to existing admin user.");
        }
        console.log("ℹ Default admin already exists.");
      }
    }

    // 4. Keep exactly one demo account per non-admin role. Old demo users are
    // deactivated instead of deleted so existing audit and letter history stays intact.
    const demoAccounts = [
      { role: "tu", name: "Demo Tata Usaha", email: "demo.tu@example.test", nip: "199001010000000002", department: "Tata Usaha", jabatan: "Tata Usaha" },
      { role: "kepala_sekolah", name: "Demo Kepala Sekolah", email: "demo.kepala-sekolah@example.test", nip: "199001010000000003", department: "Tata Usaha", jabatan: "Kepala Sekolah" },
      { role: "pegawai", name: "Demo Pegawai", email: "demo.pegawai@example.test", nip: "199001010000000004", department: "Kurikulum", jabatan: "Guru" },
    ];
    const demoEmails = demoAccounts.map((account) => account.email);
    await db.update(users).set({ deletedAt: new Date() }).where(and(like(users.email, "demo.%@example.test"), not(inArray(users.email, demoEmails))));
    const initialPasswordHash = await bcrypt.hash("CobaAkun2026!", 10);
    for (const account of demoAccounts) {
      const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, account.role));
      const [department] = await db.select({ id: departments.id }).from(departments).where(eq(departments.name, account.department));
      if (!role || !department) throw new Error(`Missing role or Unit Kerja for ${account.email}`);
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, account.email));
      const values = { name: account.name, nip: account.nip, email: account.email, passwordHash: initialPasswordHash, roleId: role.id, departmentId: department.id, jabatan: account.jabatan, deletedAt: null };
      if (existing) {
        await db.update(users).set(values).where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values(values);
      }
      console.log(`  ${account.role}: NIP ${account.nip}, ${account.email}`);
    }
    console.log("✓ Seeded one demo account for each non-admin role (shared initial password: CobaAkun2026!)");

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await poolConnection.end();
  }
}

// Run direct if invoked from CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}


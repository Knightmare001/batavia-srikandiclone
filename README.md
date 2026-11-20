# Belajar Vibecoding - Express + Drizzle + MariaDB (Node.js)

Sistem Informasi Kearsipan Dinamis & Persuratan Sekolah (arsip surat masuk/keluar, disposisi berjenjang, dan audit trail log) berbasis **Node.js**, **Express.js**, **Drizzle ORM**, dan **MariaDB**.

---

## 🚀 Tech Stack
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: Express.js
- **ORM & Migrations**: Drizzle ORM (`drizzle-kit`)
- **Database**: MariaDB (`mysql2` connection pool)
- **Language**: TypeScript

---

## 📁 Struktur Direktori (Modular Feature & Service Architecture)

```text
├── backend/
│   ├── data/                      # Data mentah atau seeder asset
│   ├── migrations/                # Hasil generate migration SQL Drizzle
│   ├── src/
│   │   ├── exceptions/            # Custom application errors (ClientError, InvariantError, dll)
│   │   ├── lib/                   # Database instance (db.ts), Schema (schema.ts), Seeder (seed.ts)
│   │   ├── middleware/            # Error handling & middleware global
│   │   ├── routes/                # Central route registry (index.ts)
│   │   ├── services/
│   │   │   └── users/             # Domain Fitur Users
│   │   │       ├── controller/    # userController.ts
│   │   │       ├── routes/        # register-user & login-user
│   │   │       ├── validator/     # schema.ts (validasi body, email, password, role)
│   │   │       ├── userService.ts # Logic duplikasi & hashing bcrypt
│   │   │       └── userRepository.ts # Query Drizzle ORM
│   │   │   └── incomingLetters/      # Modul surat masuk, upload, dan audit trail
│   │   ├── utils/                 # Utility helpers
│   │   └── server.ts              # Entry point server Express
│   └── tests/                     # Unit & integration testing
├── frontend/                      # Client application
├── drizzle.config.ts              # Konfigurasi Drizzle Kit
├── package.json                   # Dependencies & run scripts
└── tsconfig.json
```

---

## 🛠️ Panduan Menjalankan Project

### Instalasi pertama kali

Pastikan sudah terpasang **Node.js 26** (sesuai `engines` di `package.json`) dan **MariaDB**. Nyalakan MariaDB, lalu buat database kosong:

```sql
CREATE DATABASE belajar_vibecoding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Di direktori utama proyek, salin file konfigurasi dan pasang dependensi backend:

```bash
cp .env.example .env
npm install
```

Buka `.env` dan sesuaikan `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, serta `DB_NAME` dengan MariaDB lokal. Pastikan `JWT_SECRET` diganti dengan string acak minimal 32 karakter. Contoh konfigurasi lokal:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mariadb_anda
DB_NAME=belajar_vibecoding
JWT_SECRET=ganti_dengan_secret_acak_minimal_32_karakter
```

Jangan commit `.env` atau membagikan kredensial database dan secret JWT.

Buat tabel sesuai schema dan isi role, unit kerja, serta akun awal:

```bash
npm run db:push
npm run db:seed
```

`db:push` menerapkan schema langsung ke database. `db:generate` dan `db:migrate` tersedia untuk alur migration berbasis berkas jika diperlukan.

### Menjalankan aplikasi saat pengembangan

Terminal pertama, dari direktori utama, jalankan backend:

```bash
npm run dev
```

Terminal kedua, jalankan frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Buka URL Vite yang tampil di terminal (umumnya `http://localhost:5173`). Frontend mengakses backend di `http://localhost:3000/api/v1`; ubah `VITE_API_URL` di `frontend/.env.local` jika alamat backend berbeda. Backend tersedia di `http://localhost:3000`, dan health check dapat diperiksa di `http://localhost:3000/health`.

### Akun awal

Seeder membuat akun admin dan akun demo untuk tiap role. Masuk menggunakan NIP dan kata sandi berikut:

| Role | NIP | Kata sandi awal |
| --- | --- | --- |
| Admin | `198501012010011001` | `admin123` |
| Tata Usaha | `199001010000000002` | `CobaAkun2026!` |
| Kepala Sekolah | `199001010000000003` | `CobaAkun2026!` |
| Pegawai | `199001010000000004` | `CobaAkun2026!` |

Akun demo ditujukan untuk pengembangan lokal. Ganti kata sandi awal sebelum memakai aplikasi di lingkungan bersama atau produksi.

### Perintah berguna

Jalankan dari direktori utama, kecuali perintah frontend:

```bash
npm run typecheck       # periksa tipe TypeScript backend
npm run db:studio       # buka Drizzle Studio
```

Untuk build frontend produksi:

```bash
cd frontend
npm run build
npm run preview
```

---

## 📡 Dokumentasi Endpoint

### Health Check
`GET /health`
```json
{
  "status": "ok",
  "runtime": "nodejs",
  "timestamp": "2026-11-08T16:30:00.000Z",
  "services": {
    "server": "healthy",
    "database": "connected"
  }
}
```

### Registrasi User Baru
`POST /api/v1/auth/register-user`

**Request Body:**
```json
{
  "name": "Budi Santoso",
  "email": "budi@sekolah.sch.id",
  "password": "Password123!",
  "departmentId": 1,
  "nip": "198501012010011001",
  "jabatan": "Staf Tata Usaha"
}
```

**Response Sukses (`201 Created`):**
```json
{
  "message": "success created account",
  "data": {
    "id": 2,
    "email": "budi@sekolah.sch.id",
    "created_at": "2026-11-08T16:30:00.000Z",
    "updated_at": "2026-11-08T16:30:00.000Z"
  }
}
```

**Response Gagal - Email Sudah Ada (`400 Bad Request`):**
```json
{
  "message": "email already exists",
  "data": null
}
```

### Login User
`POST /api/v1/auth/login-user`

**Request Body:**
```json
{
  "nip": "198501012010011001",
  "password": "admin123"
}
```

**Response Sukses (`200 OK`):**
```json
{
  "message": "success Login account",
  "data": {
    "nip": "198501012010011001",
    "name": "admin",
    "email": "admin@gmail.com",
    "access_token": "<JWT>"
  }
}
```

Jika NIP tidak ditemukan atau password salah, endpoint mengembalikan `401` dengan pesan `nip atau password salah`.

Gunakan `access_token` sebagai `Authorization: Bearer <access_token>` untuk endpoint yang memerlukan autentikasi. Role sistem: `admin`, `tu`, `kepala_sekolah`, dan `pegawai`. Pegawai wajib ditempatkan pada Unit Kerja; Admin mengelola Unit Kerja secara dinamis.

### Surat Masuk
Semua endpoint berikut memerlukan bearer token. Mutasi hanya dapat dilakukan oleh role `tu` atau `admin`.

- `GET /api/v1/surat-masuk?search=&status=&tahun=&page=1&limit=10`
- `GET /api/v1/surat-masuk/:id`
- `POST /api/v1/surat-masuk` (multipart: metadata dan `file_surat`; PDF, DOC, atau DOCX, maksimum 10 MB)
- `PUT /api/v1/surat-masuk/:id` (multipart, file baru opsional)
- `DELETE /api/v1/surat-masuk/:id` (soft delete)
- `POST /api/v1/surat-masuk/:id/teruskan`
- `GET /api/v1/surat-masuk/:id/dokumen`
- `GET /api/v1/surat-masuk/:id/riwayat`

Nomor agenda dibuat per tahun tanggal diterima dengan format `SM-001/YYYY`. Setiap create, update, delete, dan penerusan dicatat pada `incoming_letter_histories`.

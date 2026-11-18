# 📋 Issue: Perancangan Skema Database & Modul Surat Keluar (Pencatatan, Upload Dokumen, dan Pengarsipan)

## 📌 Ringkasan Masalah & Tujuan
Modul ini bertujuan untuk mengelola alur **Pencatatan dan Pengarsipan Surat Keluar** di lingkungan sekolah. Berbeda dengan Surat Masuk yang memerlukan alur disposisi berjenjang dan tindak lanjut, Surat Keluar berfokus pada:
1. **Pencatatan Metadata & Upload Dokumen**: Staf Tata Usaha (TU) mencatat surat keluar resmi yang dibuat oleh Kepala Sekolah, Wakasek, atau unit kerja lainnya serta mengunggah file berkas digitalnya (PDF/Word).
2. **Penomoran Agenda Otomatis**: Sistem membuat nomor agenda unik secara otomatis dengan format `SK-{nomor_urut_3_digit}/{tahun}` (contoh: `SK-001/2026`).
3. **Pencarian, Filter & Pratinjau Dokumen**: Semua pengguna internal yang terotentikasi dapat mencari arsip surat keluar, melihat detail, dan membaca dokumen secara *inline* di browser tanpa harus mengunduh file secara manual.
4. **Keamanan & Otorisasi**: Pengelolaan mutasi data (Create/POST, Edit/PUT, Delete/DELETE) dibatasi secara ketat **khusus role Tata Usaha (`tu`) dan Administrator (`admin`)**.

---

## 🗄️ Bagian 1: Rancangan Skema Database (Drizzle ORM)

Untuk mengakomodasi penyimpanan data surat keluar dan riwayat audit perubahannya, dirancang 2 tabel baru:

### 1. Tabel `outgoing_letters` (Surat Keluar)
Tabel utama penyimpan metadata dan berkas surat keluar:
- **`id`**: `int`, primary key, auto increment.
- **`nomor_agenda`**: `varchar(50)`, not null, unique.
  - *Format*: Dibuat otomatis oleh sistem dengan pola `SK-XXX/YYYY` (misal: `SK-001/2026`).
  - *Integritas*: Gunakan database named lock (`GET_LOCK`) untuk menjamin nomor urut tidak mengalami tabrakan/duplikasi (*race condition*).
- **`nomor_surat`**: `varchar(100)`, not null (nomor registrasi resmi dokumen sekolah, misal: `050/SMK/XI/2026`).
- **`tanggal_surat`**: `date`, not null (tanggal penerbitan yang tertera pada surat).
- **`tanggal_dikirim`**: `date`, not null (tanggal surat dikirimkan kepada penerima).
- **`pembuat_surat`**: `varchar(150)`, not null (pihak yang membuat/mengajukan surat, misal: *Wakasek Kurikulum*, *Kepala Sekolah*).
- **`tujuan_surat`**: `varchar(255)`, not null (instansi atau pihak penerima surat, misal: *Seluruh Guru*, *Dinas Pendidikan Prov.*).
- **`perihal`**: `varchar(255)`, not null (pokok pembahasan surat).
- **`jenis_surat`**: `varchar(100)`, not null (kategori dokumen, misal: *Undangan, Permohonan, Edaran, Keterangan*).
- **`file_path`**: `varchar(255)`, not null (lokasi penyimpanan dokumen di filesystem server).
- **`file_name`**: `varchar(255)`, not null (nama file asli yang diunggah).
- **`keterangan`**: `text`, nullable (informasi atau catatan tambahan).
- **`status_surat`**: `varchar(50)`, not null, default: `'Tercatat'`.
- **`created_by`**: `int`, not null, foreign key ke `users.id` (ID akun TU yang menginput data).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.
- **`updated_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, on update `CURRENT_TIMESTAMP`, not null.
- **`deleted_at`**: `timestamp`, nullable (penanda **soft delete** agar data yang dihapus tidak hilang permanen dari database).

---

### 2. Tabel `outgoing_letter_histories` (Riwayat Aktivitas Surat Keluar)
Tabel audit trail pencatatan aktivitas surat keluar:
- **`id`**: `int`, primary key, auto increment.
- **`letter_id`**: `int`, not null, foreign key ke `outgoing_letters.id` (on delete cascade).
- **`user_id`**: `int`, not null, foreign key ke `users.id` (petugas yang melakukan aksi).
- **`aktivitas`**: `varchar(100)`, not null (contoh: *"Surat keluar dicatat"*, *"Informasi surat keluar diperbarui"*).
- **`keterangan`**: `varchar(255)`, nullable (catatan perubahan).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.

---

## 🚀 Bagian 2: Spesifikasi Endpoint API (`/api/v1/surat-keluar`)

Basis path seluruh rute modul ini adalah: `/api/v1/surat-keluar`.

---

### 1. `GET /api/v1/surat-keluar` (Daftar Arsip Surat Keluar)
Menampilkan daftar seluruh surat keluar aktif (`deleted_at IS NULL`).
- **Akses**: Semua user terotentikasi (Admin, TU, Kepala Sekolah, Wakasek, Guru/Staf).
- **Query Parameter**:
  - `search`: Pencarian teks pada perihal, tujuan surat, pembuat surat, atau nomor surat.
  - `tahun`: Filter berdasarkan tahun surat (contoh: `2026`).
  - `jenis`: Filter jenis surat (contoh: `Undangan`, `Edaran`).
  - `page` & `limit`: Pagination data (default: `page=1`, `limit=10`).
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id_surat_keluar": 1,
        "nomor_agenda": "SK-001/2026",
        "nomor_surat": "050/SMK/XI/2026",
        "tanggal_surat": "2026-11-18",
        "pembuat_surat": "Wakasek Kurikulum",
        "tujuan_surat": "Seluruh Guru",
        "perihal": "Undangan Rapat Evaluasi",
        "status_surat": "Tercatat"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "total_pages": 1
    }
  }
  ```

---

### 2. `GET /api/v1/surat-keluar/:id` (Detail Surat Keluar)
Melihat rincian metadata lengkap dari satu surat keluar.
- **Akses**: Semua user terotentikasi.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id_surat_keluar": 1,
      "nomor_agenda": "SK-001/2026",
      "nomor_surat": "050/SMK/XI/2026",
      "tanggal_surat": "2026-11-18",
      "tanggal_dikirim": "2026-11-18",
      "pembuat_surat": "Wakasek Kurikulum",
      "tujuan_surat": "Seluruh Guru",
      "perihal": "Undangan Rapat Evaluasi",
      "jenis_surat": "Undangan",
      "file_name": "undangan_rapat.pdf",
      "keterangan": "Rapat evaluasi semester ganjil",
      "status_surat": "Tercatat"
    }
  }
  ```

---

### 3. `POST /api/v1/surat-keluar` (Tambah Surat Keluar Baru)
Mencatat surat keluar baru dan mengunggah dokumen fisik (PDF/Word).
- **Akses**: **Khusus Role `tu` dan `admin`**.
- **Content-Type**: `multipart/form-data`
- **Form Data Fields**:
  - `nomor_surat`: Wajib (`varchar`).
  - `tanggal_surat`: Wajib (`YYYY-MM-DD`).
  - `tanggal_dikirim`: Wajib (`YYYY-MM-DD`).
  - `pembuat_surat`: Wajib (`varchar`).
  - `tujuan_surat`: Wajib (`varchar`).
  - `perihal`: Wajib (`varchar`).
  - `jenis_surat`: Wajib (`varchar`).
  - `keterangan`: Opsional (`text`).
  - `file_surat`: Wajib (file berkas berformat PDF atau Word).
- **Alur Kerja Backend**:
  1. Validasi form input dan ekstensi/MIME type file dokumen.
  2. Kunci nomor urut via `GET_LOCK` untuk generate `nomor_agenda` format `SK-XXX/YYYY`.
  3. Simpan file berkas ke storage aman (misal `backend/data/uploads/outgoing/`).
  4. Simpan metadata ke tabel `outgoing_letters`.
  5. Catat riwayat ke tabel `outgoing_letter_histories` dengan aktivitas: *"Surat keluar dicatat"*.
  6. Lepas kunci named lock.
- **Response Format (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Surat keluar berhasil dicatat",
    "data": {
      "id_surat_keluar": 1,
      "nomor_agenda": "SK-001/2026",
      "nomor_surat": "050/SMK/XI/2026",
      "perihal": "Undangan Rapat Evaluasi",
      "pembuat_surat": "Wakasek Kurikulum",
      "tujuan_surat": "Seluruh Guru",
      "status_surat": "Tercatat"
    }
  }
  ```

---

### 4. `PUT /api/v1/surat-keluar/:id` (Ubah Data Surat Keluar)
Memperbaiki metadata surat atau mengganti berkas dokumen surat jika ada revisi.
- **Akses**: **Khusus Role `tu` dan `admin`**.
- **Content-Type**: `multipart/form-data`
- **Alur Kerja Backend**:
  1. Validasi keberadaan surat aktif (`deleted_at IS NULL`).
  2. Update metadata yang dikirimkan.
  3. Jika ada upload `file_surat` baru, simpan file baru dan hapus file lama dari storage.
  4. Catat riwayat audit: *"Informasi surat keluar diperbarui oleh [User]"*.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Data surat keluar berhasil diperbarui",
    "data": {
      "id_surat_keluar": 1,
      "nomor_agenda": "SK-001/2026"
    }
  }
  ```

---

### 5. `DELETE /api/v1/surat-keluar/:id` (Hapus Surat Keluar - Soft Delete)
Menonaktifkan data surat keluar secara aman tanpa menghapus fisik file secara permanen.
- **Akses**: **Khusus Role `tu` dan `admin`**.
- **Alur Kerja Backend**:
  1. Isi kolom `deleted_at = NOW()`.
  2. Catat riwayat audit: *"Surat keluar dihapus (soft delete) oleh [User]"*.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Surat keluar berhasil dihapus"
  }
  ```

---

### 6. `GET /api/v1/surat-keluar/:id/dokumen` (Pratinjau Dokumen)
Menampilkan berkas PDF langsung di tab browser tanpa memaksa pengunduhan.
- **Akses**: Semua user terotentikasi.
- **Response**: Stream file dokumen dengan header:
  - `Content-Type: application/pdf` (atau format word yang sesuai).
  - `Content-Disposition: inline; filename="[nama_file]"`

---

### 7. `GET /api/v1/surat-keluar/:id/riwayat` (Riwayat Surat Keluar)
Melihat jejak waktu pencatatan, pembaruan, dan user pelaksana yang memproses surat keluar.
- **Akses**: Semua user terotentikasi.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "aktivitas": "Surat keluar dicatat",
        "pengguna": "Staf TU",
        "keterangan": "Pencatatan awal surat keluar",
        "tanggal": "2026-11-18 10:00:00"
      }
    ]
  }
  ```

---

## 🔒 Bagian 3: Matriks Hak Akses (Role Permissions)

| Endpoint & Operasi | Admin | TU | Kepala Sekolah | Wakasek | Guru / Staf |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /api/v1/surat-keluar` (List Arsip) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/surat-keluar/:id` (Detail) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/surat-keluar/:id/dokumen` (Preview) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/surat-keluar/:id/riwayat` (Audit Log) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/surat-keluar` (Tambah Data) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PUT /api/v1/surat-keluar/:id` (Edit Data) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `DELETE /api/v1/surat-keluar/:id` (Soft Delete) | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 📝 Panduan Implementasi Bertahap (High-Level untuk Junior Programmer)

1. **Fase 1: Update Skema Database & Migrasi**
   - Tambahkan tabel `outgoing_letters` dan `outgoing_letter_histories` pada [`backend/src/lib/schema.ts`](file:///home/egi/belajar_kode/Belajar_vibecoding/backend/src/lib/schema.ts).
   - Jalankan migrasi: `npm run db:generate` dan `npm run db:push`.

2. **Fase 2: Utility Generator Nomor Agenda Surat Keluar**
   - Buat fungsi penomoran otomatis dengan format `SK-{nomor_urut_3_digit}/{tahun}`.
   - Wajib menggunakan database named lock (`GET_LOCK`) untuk menjamin nomor urut berurutan dan bebas dari race condition.

3. **Fase 3: Pembuatan Modul Domain `outgoingLetters/`**
   - Buat struktur direktori di `backend/src/services/outgoingLetters/`:
     - `controller/outgoingLetterController.ts`
     - `outgoingLetterService.ts`
     - `outgoingLetterRepository.ts`
     - `validator/schema.ts` (Validasi kelengkapan body, format tanggal, dan tipe file upload)
     - `fileStorage.ts` (Penyimpanan dan penghapusan file dokumen surat keluar)
     - `routes/index.ts`

4. **Fase 4: Penerapan Middleware Hak Akses**
   - Pasang middleware `authenticate` pada seluruh endpoint.
   - Pasang middleware `authorizeRoles("tu", "admin")` pada rute mutasi (`POST`, `PUT`, `DELETE`).

5. **Fase 5: Pendaftaran Rute Central Router**
   - Daftarkan `outgoingLetterRouter` pada [`backend/src/routes/index.ts`](file:///home/egi/belajar_kode/Belajar_vibecoding/backend/src/routes/index.ts) dengan path `/api/v1/surat-keluar`.

6. **Fase 6: Automated Testing**
   - Buat file pengujian di `backend/tests/outgoingLetter.test.ts` untuk menguji:
     - Validasi form input dan validasi berkas PDF/Word.
     - Penolakan akses role Guru/Wakasek pada endpoint mutasi (`POST`, `PUT`, `DELETE` harus `403 Forbidden`).
     - Alur CRUD, soft delete, dan pembuatan nomor agenda otomatis.
     - Dukungan parameter pencarian, filter tahun/jenis, dan pagination.

---

## 🎯 Acceptance Criteria
- [ ] Tabel `outgoing_letters` dan `outgoing_letter_histories` terdaftar di Drizzle ORM dan tersinkronisasi di database MariaDB.
- [ ] Nomor agenda dibuat otomatis dengan pola `SK-XXX/YYYY` menggunakan named lock untuk mencegah duplikasi.
- [ ] Endpoint `POST /api/v1/surat-keluar` hanya dapat diakses oleh role `tu` dan `admin`.
- [ ] Berkas surat keluar mendukung format PDF dan Word serta dapat ditampilkan secara *inline* via endpoint `/dokumen`.
- [ ] Fitur soft delete berjalan aman dengan mengisi kolom `deleted_at`.
- [ ] Endpoint daftar surat keluar mendukung `search`, filter `tahun`, filter `jenis`, serta `pagination`.
- [ ] Seluruh aktivitas penambahan dan perubahan data tercatat pada tabel riwayat audit.
- [ ] Seluruh unit test modul surat keluar lulus pengujian 100%.

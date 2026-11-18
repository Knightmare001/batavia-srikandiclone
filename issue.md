# 📋 Issue: Perancangan Skema Database & Modul Disposisi Berjenjang (Kepala Sekolah & Tindak Lanjut)

## 📌 Ringkasan Masalah & Tujuan
Modul ini bertujuan untuk mengelola alur **Disposisi Surat Masuk** secara berjenjang di lingkungan sekolah. 

Alur utama sistem mencakup:
1. **Kepala Sekolah** menerima notifikasi surat masuk berstatus *"Menunggu Kepala Sekolah"*, membaca metadata dan pratinjau dokumen surat secara digital.
2. Kepala Sekolah membuat instruksi disposisi dengan nomor disposisi otomatis, menentukan prioritas, batas waktu, dan target penerima:
   - Ke **Unit Kerja / Bagian** (misal: Wakasek Kurikulum, Wakasek Kesiswaan, Wakasek Sarpras).
   - Langsung ke **Pengguna Spesifik** (Guru atau Staf tertentu tanpa perantara).
   - Ke **Semua Pengguna / Seluruh Unit** (misal: surat edaran / himbauan umum — bersifat broadcast informasi, tidak memerlukan tindak lanjut individual).
3. **Penerima Disposisi** (Wakasek/Kepala Unit) dapat:
   - Memperbarui status tindak lanjut (*Belum Diproses*, *Diproses*, *Selesai*) beserta catatan laporan hasil.
   - **Meneruskan instruksi lanjutan (*sub-disposisi*)** kepada guru/staf di bawah unit kerjanya.
4. **Guru / Staf Pelaksana** menerima tugas lanjutan, melaksanakan instruksi, dan menginput laporan hasil penyelesaian.
5. Kepala Sekolah dan TU dapat memantau progres tindak lanjut dari seluruh tingkatan disposisi hingga surat berstatus selesai diarsipkan.

> 🔒 **Hak Akses & Otorisasi:**
> - Pembuatan disposisi awal: **Khusus role `kepala_sekolah`** (dan `admin`).
> - Pembuatan disposisi lanjutan (*sub-disposisi*): **Penerima disposisi induk** (misal `kepala_unit` / Wakasek yang menjadi target disposisi tersebut).
> - Pembaruan progres/catatan tindak lanjut: **Hanya user yang ditunjuk sebagai penerima disposisi tersebut, atau user yang berada di department tujuan**.
> - Setiap endpoint mutasi (POST, PATCH) **wajib memvalidasi kepemilikan**: sistem harus memastikan user yang login adalah penerima disposisi sebelum mengizinkan aksi tindak lanjut atau penerusan.

---

## ⚙️ Prasyarat: Perbaikan Bug yang Harus Dilakukan Terlebih Dahulu

Sebelum menambahkan tabel `dispositions`, perbaiki bug berikut pada schema yang sudah ada:

### Bug: Kolom `name` di tabel `users` salah definisi
Pada `backend/src/lib/schema.ts` baris 23, kolom database tertulis `"150"` alih-alih `"name"`:
```ts
// ❌ SALAH — kolom database bernama "150"
name: varchar("150", { length: 150 }).notNull(),

// ✅ BENAR — kolom database bernama "name"
name: varchar("name", { length: 150 }).notNull(),
```
Perbaiki ini dan jalankan `npm run db:generate` + `npm run db:push` sebelum melanjutkan.

### Bug: Endpoint Register tanpa Auth Guard
Endpoint `POST /api/v1/auth/register-user` saat ini tidak dilindungi middleware autentikasi. Siapa pun tanpa login bisa mendaftarkan akun baru. Pasang middleware `authenticate` dan `authorizeRoles("admin")` pada route tersebut.

---

## 🗄️ Bagian 1: Rancangan Skema Database (Drizzle ORM)

Untuk mendukung disposisi bertingkat (*self-referencing hierarchy*), fleksibilitas penerima (unit kerja, user spesifik, atau broadcast semua), dan pelacakan hasil tindak lanjut, dirancang tabel berikut:

### 1. Tabel `dispositions` (Disposisi Surat)
Menyimpan instruksi disposisi dari Kepala Sekolah maupun penerusan tugas lanjutan dari Kepala Unit/Wakasek:
- **`id`**: `int`, primary key, auto increment.
- **`letter_id`**: `int`, not null, foreign key ke `incoming_letters.id` (on delete cascade).
- **`parent_disposition_id`**: `int`, nullable, foreign key ke `dispositions.id` (self-referencing).
  - Bernilai `NULL` untuk disposisi utama dari Kepala Sekolah.
  - Bernilai ID disposisi induk jika merupakan disposisi lanjutan (*sub-disposisi*) dari Wakasek ke Guru/Staf.
- **`nomor_disposisi`**: `varchar(50)`, not null, unique.
  - *Format*: Dibuat otomatis oleh sistem, contoh: `DSP-{nomor_urut_3_digit}/{tahun}` (misal: `DSP-001/2026`).
  - **Penting**: Gunakan named lock database (`GET_LOCK`) seperti pola yang sudah diterapkan di modul surat masuk (`IncomingLetterService.create`) untuk mencegah race condition dan duplikasi nomor.
- **`tanggal_disposisi`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null (waktu disposisi disubmit).
- **`from_user_id`**: `int`, not null, foreign key ke `users.id` (pemberi instruksi: Kepsek atau Wakasek).
- **`target_type`**: `varchar(20)`, not null (string: `'department'`, `'user'`, `'all'`).
  - `'department'`: Ditujukan ke unit kerja tertentu (misal Wakasek Sarpras).
  - `'user'`: Ditujukan langsung ke guru/staf spesifik.
  - `'all'`: Ditujukan ke seluruh guru/staf (surat umum / himbauan). **Catatan**: Disposisi bertipe `all` hanya bersifat broadcast informasi. Tidak ada tracking tindak lanjut per-user. Jika di masa depan memerlukan tracking individual, perlu ditambahkan tabel `disposition_recipients`.
- **`to_department_id`**: `int`, nullable, foreign key ke `departments.id`.
- **`to_user_id`**: `int`, nullable, foreign key ke `users.id`.
- **`instruksi`**: `text`, not null (arahan atau perintah pimpinan).
- **`catatan_tambahan`**: `text`, nullable (informasi pelengkap).
- **`prioritas`**: `varchar(20)`, not null, default: `'Biasa'` (`'Biasa'`, `'Penting'`, `'Segera'`).
- **`batas_waktu`**: `date`, nullable (tenggat waktu penyelesaian).
- **`status_tindak_lanjut`**: `varchar(30)`, not null, default: `'Belum Diproses'` (`'Belum Diproses'`, `'Diproses'`, `'Selesai'`).
- **`catatan_tindak_lanjut`**: `text`, nullable (laporan hasil pekerjaan oleh pelaksana).
- **`tanggal_selesai`**: `datetime`, nullable (diisi otomatis saat status diubah menjadi `'Selesai'`).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.
- **`updated_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, on update `CURRENT_TIMESTAMP`, not null.
- **`deleted_at`**: `timestamp`, nullable (soft delete).

### Aturan Transisi Status Tindak Lanjut (State Machine)
Validasi perubahan status harus mengikuti aturan berikut — tidak boleh mundur:
- `Belum Diproses` → `Diproses` ✅
- `Belum Diproses` → `Selesai` ✅ (langsung selesai tanpa proses bertahap)
- `Diproses` → `Selesai` ✅
- `Selesai` → ❌ **Tidak dapat diubah lagi** (status final)
- `Diproses` → `Belum Diproses` ❌ **Tidak diizinkan**

### Logika Auto-Complete Status Surat Masuk
Ketika **seluruh disposisi utama** (root-level, `parent_disposition_id IS NULL`) untuk sebuah surat berstatus `'Selesai'`, maka status surat di `incoming_letters` **otomatis diperbarui** menjadi `'Selesai'` dan dicatat di riwayat audit.

### Catatan: Disposisi Multi-Penerima
Dalam skenario nyata, Kepala Sekolah sering mendisposisikan satu surat ke beberapa unit sekaligus (misal: ke Kurikulum DAN Kesiswaan). Untuk tahap ini, **Kepala Sekolah membuat disposisi terpisah per penerima** (memanggil `POST /api/v1/disposisi` beberapa kali). Enhancement multi-penerima dalam satu request bisa ditambahkan di iterasi berikutnya.

---

## 🚀 Bagian 2: Spesifikasi Endpoint API (`/api/v1/disposisi`)

Semua endpoint modul ini menggunakan basis path: `/api/v1/disposisi`.

---

### 1. `GET /api/v1/disposisi/inbox`
Melihat daftar disposisi atau tugas yang masuk ke meja pengguna yang sedang login.
- **Akses**: Semua user terotentikasi (Kepala Sekolah, Wakasek, Guru, Staf).
- **Logika Filter**:
  - Menampilkan disposisi yang ditujukan langsung ke `to_user_id` yang sedang login, ATAU ke `to_department_id` tempat user bertugas, ATAU yang bertipe `all`.
  - Hanya menampilkan disposisi yang `deleted_at IS NULL`.
- **Query Params**: `status` (`Belum Diproses`, `Diproses`, `Selesai`), `prioritas` (`Biasa`, `Penting`, `Segera`), `page`, `limit`.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "nomor_disposisi": "DSP-001/2026",
        "surat": {
          "id": 1,
          "nomor_agenda": "SM-001/2026",
          "nomor_surat": "001/SARPRAS/XI/2026",
          "pengirim": "Dinas Pendidikan",
          "perihal": "Laporan Kerusakan Fasilitas"
        },
        "pemberi_instruksi": "Dr. H. Ahmad (Kepala Sekolah)",
        "instruksi": "Periksa kondisi laboratorium dan laporkan hasilnya",
        "prioritas": "Segera",
        "batas_waktu": "2026-11-20",
        "status_tindak_lanjut": "Belum Diproses",
        "created_at": "2026-11-18 08:30:00"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total_items": 1, "total_pages": 1 }
  }
  ```

---

### 2. `GET /api/v1/disposisi/:id`
Mengambil detail lengkap disposisi beserta informasi surat asal dan daftar disposisi turunan (*sub-disposisi*).
- **Akses**: User terotentikasi yang terlibat (pemberi, penerima, TU, atau admin).
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "nomor_disposisi": "DSP-001/2026",
      "surat": {
        "id": 1,
        "nomor_agenda": "SM-001/2026",
        "nomor_surat": "001/SARPRAS/XI/2026",
        "perihal": "Laporan Kerusakan Fasilitas",
        "file_name": "laporan.pdf"
      },
      "pemberi_instruksi": "Kepala Sekolah",
      "target_type": "department",
      "penerima": "Unit Sarpras",
      "instruksi": "Periksa kondisi laboratorium komputer",
      "catatan_tambahan": "Koordinasikan dengan penanggung jawab lab",
      "prioritas": "Segera",
      "batas_waktu": "2026-11-20",
      "status_tindak_lanjut": "Diproses",
      "catatan_tindak_lanjut": null,
      "sub_disposisi": [
        {
          "id": 2,
          "nomor_disposisi": "DSP-002/2026",
          "penerima": "Budi Santoso (Guru TIK)",
          "instruksi": "Cek jumlah PC yang rusak",
          "status_tindak_lanjut": "Selesai",
          "catatan_tindak_lanjut": "Ditemukan 3 unit PC mati daya."
        }
      ]
    }
  }
  ```

---

### 3. `POST /api/v1/disposisi`
Kepala Sekolah membuat disposisi awal untuk surat masuk.
- **Akses**: **Hanya Role `kepala_sekolah`** (dan `admin`).
- **Request Body (JSON)**:
  ```json
  {
    "letter_id": 1,
    "target_type": "department",
    "to_department_id": 4,
    "to_user_id": null,
    "instruksi": "Periksa kondisi laboratorium komputer dan laporkan hasilnya",
    "prioritas": "Segera",
    "batas_waktu": "2026-11-20",
    "catatan_tambahan": "Tindak lanjuti segera sebelum rapat akhir bulan"
  }
  ```
  *(Catatan: Jika `target_type: "all"`, `to_department_id` dan `to_user_id` boleh `null`. Jika `target_type: "department"`, `to_department_id` wajib diisi. Jika `target_type: "user"`, `to_user_id` wajib diisi).*
- **Validasi Input**:
  1. `letter_id` wajib ada dan surat berstatus `'Menunggu Kepala Sekolah'` atau `'Didisposisikan'` (surat bisa menerima lebih dari satu disposisi).
  2. `instruksi` wajib diisi, tidak boleh kosong.
  3. `target_type` wajib salah satu dari: `department`, `user`, `all`.
  4. `to_department_id` wajib valid dan ada di database jika `target_type` = `department`.
  5. `to_user_id` wajib valid dan ada di database jika `target_type` = `user`.
  6. `prioritas` wajib salah satu dari: `Biasa`, `Penting`, `Segera`.
  7. `batas_waktu` jika diisi harus format tanggal valid dan tidak boleh di masa lampau.
- **Alur Kerja Backend**:
  1. Validasi surat: pastikan surat ada dan berstatus siap didisposisi.
  2. Acquire named lock via `GET_LOCK` untuk mencegah duplikasi nomor.
  3. Generate otomatis `nomor_disposisi` (`DSP-XXX/YYYY`).
  4. Simpan data disposisi ke tabel `dispositions`.
  5. Perbarui status surat masuk di `incoming_letters` menjadi `'Didisposisikan'` (hanya jika sebelumnya masih `'Menunggu Kepala Sekolah'`).
  6. Catat riwayat di `incoming_letter_histories`: *"Surat didisposisikan oleh Kepala Sekolah kepada [Target]"*.
  7. Release lock.
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Disposisi berhasil dibuat",
    "data": {
      "id": 1,
      "nomor_disposisi": "DSP-001/2026",
      "tanggal_disposisi": "2026-11-18T07:45:00.000Z"
    }
  }
  ```

---

### 4. `POST /api/v1/disposisi/:id/teruskan`
Penerusan tugas lanjutan (*sub-disposisi*) dari Wakasek/Kepala Unit kepada Guru atau Staf pelaksana.
- **Akses**: **Hanya penerima disposisi induk** (user yang `to_user_id`-nya cocok, atau user yang berada di `to_department_id` tujuan disposisi induk). Sistem wajib memvalidasi kepemilikan ini sebelum mengizinkan penerusan.
- **Request Body (JSON)**:
  ```json
  {
    "to_user_id": 12,
    "instruksi_lanjutan": "Harap periksa komputer lab 1 dan laporkan unit yang rusak",
    "catatan_tambahan": "Selesaikan hari ini",
    "batas_waktu": "2026-11-19"
  }
  ```
- **Validasi Input**:
  1. `to_user_id` wajib valid, ada di database, dan belum dihapus.
  2. `instruksi_lanjutan` wajib diisi.
  3. Disposisi induk (`:id`) harus ada dan belum berstatus `'Selesai'`.
- **Alur Kerja Backend**:
  1. Validasi bahwa user yang login adalah penerima disposisi `:id`.
  2. Acquire named lock via `GET_LOCK`.
  3. Buat baris baru di tabel `dispositions` dengan `parent_disposition_id = :id` dan `target_type = 'user'`.
  4. Generate nomor disposisi lanjutan baru.
  5. Catat di riwayat surat: *"Tugas disposisi diteruskan oleh [Wakasek] kepada [Nama Guru]"*.
  6. Release lock.
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Tugas lanjutan berhasil diteruskan",
    "data": {
      "id": 2,
      "nomor_disposisi": "DSP-002/2026"
    }
  }
  ```

---

### 5. `PATCH /api/v1/disposisi/:id/tindak-lanjut`
Penerima disposisi memperbarui status progres dan mengisi laporan hasil pekerjaan.
- **Akses**: **Hanya user yang ditunjuk sebagai penerima disposisi** (user yang `to_user_id`-nya cocok, atau user yang berada di `to_department_id` tujuan). Sistem wajib memvalidasi kepemilikan sebelum mengizinkan update.
- **Request Body (JSON)**:
  ```json
  {
    "status": "Selesai",
    "catatan_tindak_lanjut": "Pemeriksaan selesai. Ditemukan 3 unit PC mati power supply dan 1 unit monitor rusak."
  }
  ```
- **Validasi Input & State Machine**:
  1. `status` wajib salah satu dari: `Belum Diproses`, `Diproses`, `Selesai`.
  2. Transisi status harus maju (tidak boleh mundur):
     - `Belum Diproses` → `Diproses` ✅
     - `Belum Diproses` → `Selesai` ✅
     - `Diproses` → `Selesai` ✅
     - `Selesai` → apapun ❌ (status final, tidak dapat diubah)
     - `Diproses` → `Belum Diproses` ❌
  3. `catatan_tindak_lanjut` wajib diisi jika status diubah menjadi `Selesai`.
- **Alur Kerja Backend**:
  1. Validasi bahwa user yang login adalah penerima disposisi `:id`.
  2. Validasi transisi status sesuai aturan state machine.
  3. Jika status `'Selesai'`, set `tanggal_selesai = NOW()`.
  4. Update `status_tindak_lanjut` dan `catatan_tindak_lanjut`.
  5. Catat aktivitas di riwayat surat: *"Tindak lanjut disposisi diperbarui menjadi: [Status] oleh [Nama User]"*.
  6. **Auto-complete surat**: Jika disposisi ini adalah disposisi utama (`parent_disposition_id IS NULL`) dan seluruh disposisi utama lain untuk surat yang sama juga sudah `'Selesai'`, maka otomatis perbarui status `incoming_letters` menjadi `'Selesai'` dan catat riwayat: *"Seluruh disposisi selesai. Surat diarsipkan."*
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Status tindak lanjut berhasil diperbarui",
    "data": {
      "id": 1,
      "status_tindak_lanjut": "Selesai",
      "tanggal_selesai": "2026-11-18T10:30:00.000Z"
    }
  }
  ```

---

### 6. `GET /api/v1/disposisi/surat/:letterId`
Melihat pohon hierarki disposisi lengkap untuk satu surat tertentu (monitoring Kepala Sekolah & TU).
- **Akses**: User terotentikasi.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "letter_id": 1,
      "nomor_agenda": "SM-001/2026",
      "disposisi_list": [
        {
          "id": 1,
          "nomor_disposisi": "DSP-001/2026",
          "dari": "Kepala Sekolah",
          "tujuan": "Unit Sarpras",
          "instruksi": "Periksa kondisi laboratorium komputer",
          "prioritas": "Segera",
          "batas_waktu": "2026-11-20",
          "status": "Diproses",
          "anak_disposisi": [
            {
              "id": 2,
              "nomor_disposisi": "DSP-002/2026",
              "dari": "Wakasek Sarpras",
              "tujuan": "Budi Santoso (Guru)",
              "instruksi": "Periksa komputer yang rusak",
              "status": "Selesai",
              "catatan": "3 unit PC rusak power supply."
            }
          ]
        }
      ]
    }
  }
  ```

---

## 📝 Panduan Implementasi Bertahap (High-Level untuk Junior Programmer)

1. **Fase 0: Perbaikan Bug Prasyarat**
   - Perbaiki nama kolom `varchar("150")` menjadi `varchar("name")` di definisi tabel `users` pada `backend/src/lib/schema.ts`.
   - Tambahkan middleware `authenticate` dan `authorizeRoles("admin")` pada endpoint `POST /api/v1/auth/register-user` di `backend/src/services/users/routes/index.ts`.
   - Jalankan migrasi ulang: `npm run db:generate` dan `npm run db:push`.

2. **Fase 1: Penambahan Skema & Migrasi Database**
   - Tambahkan tabel `dispositions` pada `backend/src/lib/schema.ts` sesuai spesifikasi di atas.
   - Jalankan migrasi: `npm run db:generate` dan `npm run db:push`.

3. **Fase 2: Utility Generator Nomor Disposisi**
   - Buat fungsi utilitas pembuat nomor disposisi otomatis dengan format `DSP-{nomor_urut_3_digit}/{tahun}`.
   - **Gunakan pola named lock database (`GET_LOCK`)** seperti yang sudah diterapkan di `IncomingLetterService.create` untuk mencegah race condition dan duplikasi nomor saat ada request paralel.

4. **Fase 3: Pembuatan Modul Service `dispositions/`**
   - Buat struktur domain di `backend/src/services/dispositions/`:
     - `controller/dispositionController.ts`: Menangani input request dan response HTTP.
     - `dispositionService.ts`: Menjalankan logika bisnis (validasi kepemilikan disposisi, validasi transisi status state machine, update status surat asal, auto-complete surat).
     - `dispositionRepository.ts`: Query Drizzle ORM untuk filter inbox berdasarkan `user_id`/`department_id`/`all`, insert disposisi, update progres, dan query tree hierarki anak disposisi.
     - `validator/schema.ts`: Validasi payload disposisi utama, penerusan, dan tindak lanjut (termasuk validasi `target_type` konsisten dengan field `to_department_id`/`to_user_id`).
     - `routes/index.ts`: Pendaftaran rute API.

5. **Fase 4: Implementasi Validasi Kepemilikan Disposisi**
   - Sebelum mengizinkan `PATCH /tindak-lanjut` atau `POST /teruskan`, query database untuk memastikan:
     - Jika `target_type = 'user'`: `to_user_id` harus sama dengan `req.authUser.id`.
     - Jika `target_type = 'department'`: `to_department_id` harus sama dengan `department_id` user yang login.
     - Jika `target_type = 'all'`: boleh diakses semua user terotentikasi (khusus view, bukan tindak lanjut).
   - Jika tidak cocok, kembalikan response `403 Forbidden`.

6. **Fase 5: Integrasi Audit Riwayat (`incoming_letter_histories`)**
   - Pastikan setiap ada disposisi baru, penerusan tugas, atau perubahan status tindak lanjut, modul ini otomatis melakukan insert ke tabel riwayat surat terkait.

7. **Fase 6: Pendaftaran Rute di Central Router**
   - Pasang rute disposisi pada `backend/src/routes/index.ts` dengan prefix `/api/v1/disposisi`.

8. **Fase 7: Automated Testing**
   - Buat file pengujian di `backend/tests/disposition.test.ts` untuk menguji:
     - Validasi payload disposisi (field wajib, target_type konsistensi).
     - Proteksi hak akses role Kepala Sekolah pada pembuatan disposisi.
     - **Validasi kepemilikan**: pastikan user yang bukan penerima tidak bisa update tindak lanjut (harus 403).
     - Alur sub-disposisi (penerusan dari Wakasek ke Guru).
     - **Validasi state machine**: pastikan transisi status mundur ditolak.
     - **Auto-complete**: pastikan status surat berubah ke `Selesai` ketika semua disposisi utama selesai.

---

## 🎯 Acceptance Criteria
- [ ] Bug `varchar("150")` pada tabel users sudah diperbaiki menjadi `varchar("name")`.
- [ ] Endpoint register dilindungi `authenticate` dan `authorizeRoles("admin")`.
- [ ] Tabel `dispositions` terdaftar di Drizzle ORM dan tersinkronisasi di database MariaDB.
- [ ] Nomor disposisi ter-generate otomatis dengan pola `DSP-XXX/YYYY` menggunakan named lock untuk mencegah duplikasi.
- [ ] Kepala Sekolah dapat membuat disposisi yang ditujukan ke Departemen, Pengguna Tertentu, atau Semua Pengguna (`all`).
- [ ] Surat masuk otomatis berubah status menjadi `'Didisposisikan'` setelah disposisi pertama dibuat.
- [ ] Penerima disposisi dapat meneruskan tugas lanjutan (*sub-disposisi*) kepada guru/staf di bawahnya.
- [ ] Pelaksana tugas dapat mengubah status sesuai aturan state machine (maju saja, tidak boleh mundur) dan mengisi catatan tindak lanjut.
- [ ] Status `'Selesai'` bersifat final dan tidak dapat diubah kembali.
- [ ] Ketika seluruh disposisi utama sebuah surat berstatus `'Selesai'`, status surat otomatis berubah menjadi `'Selesai'`.
- [ ] Setiap endpoint mutasi memvalidasi kepemilikan disposisi (user yang login harus penerima disposisi, jika tidak maka 403).
- [ ] Setiap aksi disposisi dan perubahannya otomatis tercatat pada riwayat audit surat (`incoming_letter_histories`).
- [ ] Endpoint `/inbox` secara akurat menampilkan tugas yang relevan bagi user yang sedang login (berdasarkan `to_user_id`, `to_department_id`, atau `target_type = 'all'`).
- [ ] Seluruh unit test lulus pengujian.

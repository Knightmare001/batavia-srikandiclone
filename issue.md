# 📋 Issue: Perancangan Skema Database & Modul Alur Kerja Guru/Staf (Penerima Tugas & Pelaporan Tindak Lanjut)

## 📌 Ringkasan Masalah & Tujuan
Modul ini bertujuan untuk menyempurnakan alur kerja pengguna dengan role **Guru dan Staf (`guru_staf`)** sebagai pihak pelaksana lapangan dari disposisi yang didelegasikan oleh Kepala Unit / Wakasek maupun Kepala Sekolah.

Dalam skenario persuratan sekolah:
1. **Guru** menerima instruksi tugas melalui menu personal (*Tugas Saya*), misalnya instruksi pemeriksaan kerusakan laboratorium komputer dari Wakasek Sarpras.
2. Guru dapat membuka detail tugas, membaca konteks surat asli, dan melihat berkas fisik dokumen surat secara langsung di browser tanpa perlu mengunduh file manual.
3. Guru memperbarui status pelaksanaan menjadi **"Diproses"** saat mulai mengerjakan tugas.
4. Setelah pekerjaan tuntas, Guru memperbarui status menjadi **"Selesai"** dan menyertakan laporan/catatan hasil pekerjaan.
5. **Pemisahan Batas Tanggung Jawab (*Separation of Responsibility*)**:
   - Penyelesaian tugas oleh guru hanya menyelesaikan tugas milik guru tersebut (`sub-disposisi`), **bukan otomatis menyelesaikan disposisi induk milik Wakasek atau surat masuknya**.
   - Wakasek memeriksa laporan hasil pekerjaan guru, lalu memutuskan untuk menutup disposisi unitnya atau melaporkan kembali kepada Kepala Sekolah.
6. **Keamanan & Otorisasi Ketat**: Guru hanya dapat melihat dan memperbarui tugas yang ditugaskan kepada dirinya sendiri, tidak dapat memanipulasi tugas pengguna lain, dan tidak dapat mengubah instruksi pemberi tugas.

---

## 🗄️ Bagian 1: Rancangan Skema Database (Drizzle ORM)

Struktur tabel `dispositions` yang sudah ada dapat digunakan secara optimal dengan penambahan/penyesuaian atribut agar mendukung pemisahan filter daftar tugas aktif vs riwayat penyelesaian tugas guru:

### 1. Struktur Tabel `dispositions` (Data Tugas Guru)
- **`id`**: `int`, primary key, auto increment.
- **`letter_id`**: `int`, not null, foreign key ke `incoming_letters.id`.
- **`parent_disposition_id`**: `int`, nullable, foreign key ke `dispositions.id` (menghubungkan tugas guru ke disposisi induk milik Wakasek).
- **`nomor_disposisi`**: `varchar(50)`, not null, unique (kode unik tugas, contoh: `DSP-025/2026`).
- **`from_user_id`**: `int`, not null, foreign key ke `users.id` (Wakasek / pemberi tugas).
- **`target_type`**: `varchar(20)`, not null (`'user'` untuk penugasan spesifik ke guru, atau `'all'` jika edaran umum).
- **`to_user_id`**: `int`, nullable, foreign key ke `users.id` (ID Guru yang ditugaskan).
- **`to_department_id`**: `int`, nullable, foreign key ke `departments.id`.
- **`instruksi`**: `text`, not null (arahan atau perintah yang harus dikerjakan guru).
- **`catatan_tambahan`**: `text`, nullable (catatan pendukung dari pemberi tugas).
- **`prioritas`**: `varchar(20)`, not null, default: `'Biasa'` (`'Biasa'`, `'Penting'`, `'Segera'`).
- **`batas_waktu`**: `date`, nullable (tenggat penyelesaian tugas).
- **`status_tindak_lanjut`**: `varchar(30)`, not null, default: `'Belum Diproses'` (`'Belum Diproses'`, `'Diproses'`, `'Selesai'`).
- **`catatan_tindak_lanjut`**: `text`, nullable (laporan hasil pekerjaan yang diinput oleh guru).
- **`tanggal_selesai`**: `datetime`, nullable (dicatat otomatis oleh sistem saat guru mengubah status menjadi `'Selesai'`).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.
- **`updated_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, on update `CURRENT_TIMESTAMP`, not null.
- **`deleted_at`**: `timestamp`, nullable (soft delete).

> 💡 **Penyelarasan Logika Auto-Complete Surat**:
> Penyelesaian tugas (`status_tindak_lanjut = 'Selesai'`) pada level sub-disposisi (`parent_disposition_id IS NOT NULL`) **hanya menandai tugas guru selesai**. 
> Surat masuk di tabel `incoming_letters` **hanya dapat berstatus `'Selesai'` jika seluruh disposisi tingkat utama (`parent_disposition_id IS NULL`) telah diselesaikan oleh Wakasek/Kepala Unit terkait**.

---

## 🚀 Bagian 2: Spesifikasi Endpoint API untuk Guru (`/api/v1/disposisi`)

Semua endpoint memanfaatkan rute `/api/v1/disposisi` yang telah dirancang sebelumnya dengan penerapan otorisasi dan filter khusus role Guru:

---

### 1. `GET /api/v1/disposisi/inbox` (Menu: Tugas Saya & Riwayat Tugas)
Mengambil daftar tugas yang ditujukan kepada Guru yang sedang login.
- **Akses**: Semua user terotentikasi (khususnya role `guru_staf`).
- **Filter Query**:
  - `tab`: 
    - `active` / kosong $\rightarrow$ Menampilkan tugas yang belum selesai (`status_tindak_lanjut IN ('Belum Diproses', 'Diproses')`) untuk menu **"Tugas Saya"**.
    - `history` $\rightarrow$ Menampilkan tugas yang sudah selesai (`status_tindak_lanjut = 'Selesai'`) untuk menu **"Riwayat Tugas"**.
  - `prioritas`: Filter prioritas (`Biasa`, `Penting`, `Segera`).
  - `page` & `limit`: Dukungan pagination.
- **Logika Keamanan**:
  - Hanya menampilkan disposisi di mana `to_user_id = req.authUser.id` (atau `target_type = 'all'`).
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 25,
        "nomor_disposisi": "DSP-025/2026",
        "surat": {
          "id": 1,
          "nomor_agenda": "SM-001/2026",
          "nomor_surat": "001/SARPRAS/XI/2026",
          "perihal": "Laporan Kerusakan Laboratorium Komputer"
        },
        "pemberi_tugas": "Wakasek Sarpras",
        "instruksi": "Periksa 3 komputer yang tidak dapat menyala di laboratorium.",
        "prioritas": "Segera",
        "batas_waktu": "2026-11-19",
        "status_tindak_lanjut": "Diproses",
        "tanggal_diberikan": "2026-11-18 09:00:00"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total_items": 1, "total_pages": 1 }
  }
  ```

---

### 2. `GET /api/v1/disposisi/:id` (Detail Tugas & Konteks Surat)
Menampilkan rincian tugas yang harus dikerjakan Guru, identitas surat asli, dan instruksi lengkap.
- **Akses**: User yang ditugaskan (`to_user_id = req.authUser.id`), pemberi tugas, atau Admin/Kepsek.
- **Logika Keamanan**: Guru dilarang membuka detail tugas milik guru lain (mengembalikan `403 Forbidden`).
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 25,
      "nomor_disposisi": "DSP-025/2026",
      "pemberi_tugas": "Wakasek Sarpras",
      "instruksi": "Periksa 3 komputer yang tidak dapat menyala di laboratorium.",
      "prioritas": "Segera",
      "batas_waktu": "2026-11-19",
      "status_tindak_lanjut": "Diproses",
      "catatan_tindak_lanjut": "Sedang melakukan pemeriksaan power supply.",
      "tanggal_selesai": null,
      "surat": {
        "id": 1,
        "nomor_agenda": "SM-001/2026",
        "nomor_surat": "001/SARPRAS/XI/2026",
        "perihal": "Laporan Kerusakan Laboratorium Komputer",
        "pengirim": "Kepala Laboratorium",
        "tanggal_surat": "2026-11-15",
        "file_name": "surat-laporan-lab.pdf"
      }
    }
  }
  ```

---

### 3. `GET /api/v1/disposisi/:id/dokumen` (Pratinjau Berkas Dokumen Fisik)
Menampilkan berkas PDF surat asli di browser secara *inline* tanpa harus mengunduh file ke perangkat.
- **Akses**: Terbuka untuk Guru yang menerima tugas dari disposisi terkait.
- **Response**: File stream berkas dokumen dengan header `Content-Type: application/pdf` dan `Content-Disposition: inline`.

---

### 4. `PATCH /api/v1/disposisi/:id/tindak-lanjut` (Mulai Pengerjaan & Pengiriman Laporan)
Mengubah status pengerjaan tugas dan mengirimkan laporan hasil kerja.
- **Akses**: **Hanya Guru yang ditugaskan** (`to_user_id = req.authUser.id`).

#### A. Saat Guru Mulai Mengerjakan (Ubah Status ke Diproses)
- **Request Body (JSON)**:
  ```json
  {
    "status": "Diproses",
    "catatan_tindak_lanjut": "Sedang melakukan pemeriksaan komputer di laboratorium."
  }
  ```

#### B. Saat Guru Menyelesaikan Tugas (Laporan Hasil)
- **Request Body (JSON)**:
  ```json
  {
    "status": "Selesai",
    "catatan_tindak_lanjut": "Ditemukan 3 komputer mengalami kerusakan pada bagian power supply. Hasil pemeriksaan sudah disampaikan kepada Wakasek Sarpras."
  }
  ```
- **Aturan Validasi & State Machine**:
  1. Status hanya boleh maju: `Belum Diproses` $\rightarrow$ `Diproses` $\rightarrow$ `Selesai`.
  2. Status tidak boleh mundur: `Diproses` $\rightarrow$ `Belum Diproses` ❌.
  3. Setelah berstatus `Selesai`, data menjadi final dan tidak dapat diubah kembali oleh Guru ❌.
  4. Field `catatan_tindak_lanjut` wajib diisi saat mengubah status ke `Selesai`.
  5. Sistem otomatis mengisi `tanggal_selesai = NOW()`.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Tindak lanjut berhasil diselesaikan",
    "data": {
      "id_disposisi": 25,
      "status": "Selesai",
      "catatan": "Ditemukan 3 komputer mengalami kerusakan pada bagian power supply. Hasil pemeriksaan sudah disampaikan kepada Wakasek Sarpras.",
      "tanggal_selesai": "2026-11-19 10:30:00"
    }
  }
  ```

---

### 5. `GET /api/v1/disposisi/:id/riwayat` (Riwayat Jejak Tugas)
Menampilkan catatan kronologis penugasan, kapan tugas mulai diproses, dan kapan laporan selesai dikirimkan.

---

## 🔒 Bagian 3: Aturan Batasan Akses (Access Control Rules)

Untuk mencegah manipulasi data antar pegawai, terapkan aturan otorisasi berikut:
1. **Isolasi Tugas**: Guru hanya diizinkan melihat tugas yang mencantumkan dirinya sebagai penerima (`to_user_id = req.authUser.id` atau `target_type = 'all'`).
2. **Proteksi Hak Update**: Guru hanya dapat memperbarui status tugas miliknya sendiri. Akses terhadap tugas orang lain menghasilkan error `403 Forbidden`.
3. **Restriksi Pembuatan**: Role `guru_staf` dilarang membuat disposisi utama (`POST /api/v1/disposisi` hanya untuk `kepala_sekolah` / `admin`).
4. **Restriksi Penerusan**: Guru tidak dapat meneruskan tugas kepada guru lain (`POST /api/v1/disposisi/:id/teruskan` ditolak untuk role guru).
5. **Integritas Arahan**: Guru tidak memiliki akses untuk mengubah teks instruksi asli dari Wakasek/Kepala Sekolah.
6. **Kemandirian Status Sub-Disposisi**: Penyelesaian tugas guru tidak secara otomatis menutup disposisi induk milik Wakasek; Wakasek tetap memegang kendali verifikasi akhir.

---

## 📝 Panduan Implementasi Bertahap (High-Level untuk Junior Programmer)

1. **Fase 1: Filter Endpoint Inbox (`GET /inbox`)**
   - Tambahkan opsi query parameter `?tab=active` dan `?tab=history` pada repository disposisi untuk memudahkan pemisahan tampilan menu *Tugas Saya* dan *Riwayat Tugas* di antarmuka frontend guru.

2. **Fase 2: Endpoint Pratinjau Dokumen Disposisi (`GET /:id/dokumen`)**
   - Buat route `GET /api/v1/disposisi/:id/dokumen` yang mengambil `filePath` dari surat masuk yang terkait dengan disposisi tersebut, lalu kirimkan file buffer secara aman ke client.

3. **Fase 3: Penguatan Otorisasi Kepemilikan Tugas**
   - Pada `dispositionService.ts`, pastikan validasi user login:
     ```ts
     if (disposition.toUserId !== req.authUser.id) {
       throw new AuthorizationError("Anda tidak memiliki akses terhadap tugas ini");
     }
     ```

4. **Fase 4: Penegasan Logika Penyelesaian Surat Masuk**
   - Pastikan logika auto-complete status surat hanya memeriksa disposisi level utama (`parent_disposition_id IS NULL`), sehingga penyelesaian tugas oleh guru tidak menutup status surat masuk secara prematur.

5. **Fase 5: Unit Testing Skenario Guru**
   - Tambahkan pengujian otomatis untuk:
     - Guru mengakses inbox tugas miliknya.
     - Penolakan akses saat guru mencoba membuka/mengubah tugas guru lain (harus `403 Forbidden`).
     - Alur transisi status: `Belum Diproses` $\rightarrow$ `Diproses` $\rightarrow$ `Selesai`.
     - Penolakan saat guru mencoba mengubah kembali tugas yang sudah `Selesai`.

---

## 🎯 Acceptance Criteria
- [ ] Guru dapat melihat daftar tugas aktif melalui menu *Tugas Saya* dan tugas selesai melalui *Riwayat Tugas*.
- [ ] Guru dapat membaca detail surat dan membuka dokumen surat asli di browser melalui endpoint `/dokumen`.
- [ ] Guru dapat mengubah status menjadi `'Diproses'` dan `'Selesai'` disertai catatan laporan hasil pekerjaan.
- [ ] Guru tidak dapat melihat maupun memperbarui tugas milik guru lain (terproteksi `403 Forbidden`).
- [ ] Guru tidak dapat membuat disposisi baru maupun meneruskan tugas ke orang lain.
- [ ] Setelah berstatus `'Selesai'`, data tugas guru terkunci dan tidak dapat diubah kembali.
- [ ] Penyelesaian tugas guru tidak langsung menyelesaikan status disposisi Wakasek atau surat masuk secara otomatis.
- [ ] Seluruh unit test terkait alur penugasan dan pelaporan guru lulus 100%.

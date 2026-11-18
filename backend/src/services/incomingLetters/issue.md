# 📋 Issue: Perancangan Skema Database & Modul Surat Masuk (Role Tata Usaha)

## 📌 Ringkasan Masalah & Tujuan
Modul ini bertujuan untuk mengelola alur pencatatan dan pemantauan **Surat Masuk** di lingkungan sekolah yang dikhususkan bagi pengguna dengan role **Tata Usaha (TU)**. 

Melalui modul ini, TU dapat:
1. Menginput metadata surat masuk beserta file dokumen pendukung (PDF/Word).
2. Memperoleh nomor agenda unik yang dibuat otomatis oleh sistem (contoh: `SM-001/2026`).
3. Memperbarui informasi surat jika terdapat kekeliruan (edit) serta menghapus surat secara aman (*soft delete*).
4. Meneruskan surat kepada Kepala Sekolah dengan status *"Menunggu Kepala Sekolah"*.
5. Melacak riwayat audit alur pemrosesan surat (siapa pelaku dan kapan tindakan dilakukan).
6. Mengunduh/melihat fisik dokumen surat yang diunggah.
7. Menampilkan daftar surat masuk yang dilengkapi fitur pencarian (*search*), filter status/tahun, dan pagination.

> 🔒 **Hak Akses & Otorisasi:**
> Operasi pengubahan data (Create/POST, Update/PUT, Delete/DELETE, Teruskan/POST) **hanya dapat diakses oleh user dengan role `tu`** (dan/atau `admin`).

---

## 🗄️ Bagian 1: Rancangan Skema Database (Drizzle ORM)

Untuk mengakomodasi seluruh data form, pelacakan riwayat, dan lampiran file, diperlukan 2 tabel baru:

### 1. Tabel `incoming_letters` (Surat Masuk)
Tabel utama yang menyimpan metadata surat masuk:
- **`id`**: `int`, primary key, auto increment.
- **`nomor_agenda`**: `varchar(50)`, not null, unique.
  - *Format*: Dihasilkan otomatis oleh sistem, misalnya `SM-{nomor_urut_3_digit}/{tahun}` (contoh: `SM-001/2026`).
- **`nomor_surat`**: `varchar(100)`, nullable (wajib jika dokumen fisik memiliki nomor resmi).
- **`tanggal_surat`**: `date`, not null (tanggal yang tertera pada surat asli).
- **`tanggal_diterima`**: `date`, not null (tanggal surat diterima oleh pihak TU).
- **`pengirim`** / `asal_surat`: `varchar(150)`, not null (instansi/pihak pengirim surat).
- **`perihal`**: `varchar(255)`, not null (ringkasan isi perihal surat).
- **`jenis_surat`**: `varchar(100)`, not null (misal: *Undangan, Edaran, Permohonan, Laporan*).
- **`sumber_surat`**: `varchar(50)`, nullable (misal: *Fisik, Email, Digital, Kurir*).
- **`keterangan`**: `text`, nullable (catatan tambahan dari TU).
- **`file_path`**: `varchar(255)`, not null (lokasi penyimpanan berkas PDF atau Word yang diunggah).
- **`file_name`**: `varchar(255)`, not null (nama file asli dokumen).
- **`status`**: `varchar(50)`, not null, default: `'Draft'`.
  - Contoh transisi status: `'Draft'` $\rightarrow$ `'Menunggu Kepala Sekolah'` $\rightarrow$ `'Didisposisikan'` $\rightarrow$ `'Selesai'`.
- **`created_by`**: `int`, not null, foreign key ke `users.id` (petugas TU yang menginput).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.
- **`updated_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, on update `CURRENT_TIMESTAMP`, not null.
- **`deleted_at`**: `timestamp`, nullable (penanda **soft delete** agar arsip tidak terhapus permanen dari basis data).

---

### 2. Tabel `incoming_letter_histories` (Riwayat Aktivitas Surat)
Tabel audit trail pencatatan log perpindahan tangan dan status surat:
- **`id`**: `int`, primary key, auto increment.
- **`letter_id`**: `int`, not null, foreign key ke `incoming_letters.id` (on delete cascade).
- **`user_id`**: `int`, not null, foreign key ke `users.id` (siapa yang mengeksekusi aktivitas).
- **`aktivitas`**: `varchar(100)`, not null (contoh: *"Surat ditambahkan"*, *"Surat diubah"*, *"Surat diteruskan"*).
- **`keterangan`**: `varchar(255)`, nullable (catatan pelengkap).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null (waktu persis pencatatan riwayat).

---

## 🚀 Bagian 2: Spesifikasi Endpoint API (`/api/v1/surat-masuk`)

Seluruh rute berada di bawah grup: `/api/v1/surat-masuk`.

### 1. `GET /api/v1/surat-masuk`
Mengambil daftar surat masuk dengan dukungan query parameter:
- **Query Params**:
  - `search`: Pencarian parsial pada perihal, pengirim, atau nomor surat.
  - `status`: Filter berdasarkan status (misal: `menunggu`, `draft`, `selesai`).
  - `tahun`: Filter berdasarkan tahun tanggal diterima (contoh: `2026`).
  - `page`: Nomor halaman (default: `1`).
  - `limit`: Jumlah data per halaman (default: `10`).
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "nomor_agenda": "SM-001/2026",
        "nomor_surat": "001/SARPRAS/XI/2026",
        "pengirim": "Wakasek Sarpras",
        "perihal": "Laporan Kerusakan Fasilitas",
        "tanggal_surat": "2026-11-10",
        "tanggal_diterima": "2026-11-12",
        "status": "Menunggu Kepala Sekolah"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total_items": 1,
      "total_pages": 1
    }
  }
  ```

---

### 2. `GET /api/v1/surat-masuk/:id`
Mengambil seluruh rincian informasi surat masuk berdasarkan ID.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "nomor_agenda": "SM-001/2026",
      "nomor_surat": "001/SARPRAS/XI/2026",
      "pengirim": "Wakasek Sarpras",
      "perihal": "Laporan Kerusakan Fasilitas",
      "jenis_surat": "Laporan",
      "sumber_surat": "Digital",
      "keterangan": "Laporan kondisi fasilitas sekolah",
      "tanggal_surat": "2026-11-10",
      "tanggal_diterima": "2026-11-12",
      "status": "Menunggu Kepala Sekolah",
      "file_name": "laporan.pdf"
    }
  }
  ```

---

### 3. `POST /api/v1/surat-masuk`
Menambahkan surat masuk baru (Hanya Role TU).
- **Content-Type**: `multipart/form-data`
- **Form Data Fields**:
  - `nomor_surat`: Wajib jika ada nomor dokumen.
  - `tanggal_surat`: Wajib (`YYYY-MM-DD`).
  - `tanggal_diterima`: Wajib (`YYYY-MM-DD`).
  - `pengirim`: Wajib.
  - `perihal`: Wajib.
  - `jenis_surat`: Wajib.
  - `sumber_surat`: Opsional.
  - `keterangan`: Opsional.
  - `file_surat`: Wajib (hanya file PDF `.pdf` atau Word `.doc`/`.docx`).
- **Alur Kerja Backend**:
  1. Validasi keberadaan file & format MIME type.
  2. Generate `nomor_agenda` berikutnya untuk tahun bersangkutan secara otomatis.
  3. Simpan file ke direktori storage (misal `backend/data/uploads/`).
  4. Simpan metadata ke tabel `incoming_letters`.
  5. Catat riwayat otomatis ke tabel `incoming_letter_histories` dengan aktivitas: *"Surat ditambahkan"*.
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Surat masuk berhasil dicatat",
    "data": {
      "id": 1,
      "nomor_agenda": "SM-001/2026"
    }
  }
  ```

---

### 4. `PUT /api/v1/surat-masuk/:id`
Memperbaiki informasi surat masuk yang salah input (Hanya Role TU).
- Menerima pembaruan data metadata (dan file baru jika dokumen perlu diganti).
- Otomatis mencatat riwayat aktivitas: *"Surat diubah"*.

---

### 5. `DELETE /api/v1/surat-masuk/:id`
Menghapus surat secara lunak (*soft delete*, Hanya Role TU).
- Mengisi kolom `deleted_at = NOW()` tanpa menghapus row database secara fisik.
- Data yang memiliki `deleted_at IS NOT NULL` tidak akan tampil lagi di daftar surat.

---

### 6. `POST /api/v1/surat-masuk/:id/teruskan`
Meneruskan surat masuk kepada Kepala Sekolah (Hanya Role TU).
- **Aturan Bisnis**:
  - Mengubah kolom `status` menjadi `'Menunggu Kepala Sekolah'`.
  - Mencatat ke log riwayat: waktu penerusan dan user TU yang meneruskan.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Surat berhasil diteruskan kepada Kepala Sekolah",
    "status": "Menunggu Kepala Sekolah"
  }
  ```

---

### 7. `GET /api/v1/surat-masuk/:id/dokumen`
Mengakses berkas fisik surat (PDF/Word) untuk ditampilkan atau diunduh langsung di browser:
- Mengembalikan response file stream dengan header `Content-Type: application/pdf` (atau word mime type) dan `Content-Disposition: inline`.

---

### 8. `GET /api/v1/surat-masuk/:id/riwayat`
Melihat jejak riwayat proses perjalanan surat masuk.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "aktivitas": "Surat ditambahkan",
        "pengguna": "Staf TU",
        "tanggal": "2026-11-12 09:00:00"
      },
      {
        "aktivitas": "Surat diteruskan",
        "pengguna": "Staf TU",
        "tanggal": "2026-11-12 09:15:00"
      }
    ]
  }
  ```

---

## 📝 Panduan Implementasi Bertahap (High-Level untuk Programmer Junior)

1. **Fase 1: Update Skema Database & Migrasi**
   - Tambahkan tabel `incoming_letters` dan `incoming_letter_histories` pada `backend/src/lib/schema.ts`.
   - Jalankan `npm run db:generate` dan `npm run db:push` untuk menerapkan skema ke database.

2. **Fase 2: Setup File Upload Middleware**
   - Gunakan middleware penanganan file (seperti `multer`) untuk menerima file PDF dan Word serta menyimpannya ke folder upload yang aman.

3. **Fase 3: Pembuatan Generator Nomor Agenda Otomatis**
   - Buat fungsi utilitas di service untuk menghitung jumlah surat pada tahun berjalan, lalu format menjadi `SM-XXX/YYYY`.

4. **Fase 4: Penyiapan Middleware Role Check**
   - Buat middleware verifikasi role untuk memvalidasi bahwa hanya user dengan role `tu` (atau `admin`) yang diizinkan mengakses aksi POST, PUT, DELETE, dan Teruskan.

5. **Fase 5: Penggabungan Endpoint ke Central Routing**
   - Buat modul service baru di `backend/src/services/incomingLetters/` yang memuat:
     - `controller/incomingLetterController.ts`
     - `routes/index.ts`
     - `validator/schema.ts`
     - `incomingLetterService.ts`
     - `incomingLetterRepository.ts`
   - Daftarkan ke central router Express di `backend/src/routes/index.ts`.

6. **Fase 6: Pengujian Unit & Endpoint**
   - Buat unit test untuk alur CRUD, filter pagination, validasi file, dan pencatatan riwayat.

---

## 🎯 Acceptance Criteria
- [ ] Tabel `incoming_letters` dan `incoming_letter_histories` terdaftar di Drizzle ORM dan tersinkronisasi di database MariaDB.
- [ ] Fitur soft delete berjalan dengan baik (kolom `deleted_at`).
- [ ] Nomor agenda dibuat otomatis dengan format `SM-XXX/YYYY` saat surat baru disimpan.
- [ ] Endpoint `POST /api/v1/surat-masuk` hanya menerima format dokumen PDF dan Word.
- [ ] Endpoint `POST /api/v1/surat-masuk/:id/teruskan` berhasil memperbarui status surat menjadi *"Menunggu Kepala Sekolah"* serta tercatat di riwayat.
- [ ] Endpoint riwayat (`/riwayat`) menampilkan catatan waktu dan nama pengguna yang memproses.
- [ ] Endpoint daftar surat mendukung parameter `search`, `status`, `tahun`, dan pagination (`page` & `limit`).
- [ ] Endpoint mutasi data (POST, PUT, DELETE) hanya dapat diakses oleh role TU.

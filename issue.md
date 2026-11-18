# 📋 Issue: Perancangan Skema Database & Modul Disposisi Berjenjang (Kepala Sekolah & Tindak Lanjut)

## 📌 Ringkasan Masalah & Tujuan
Modul ini bertujuan untuk mengelola alur **Disposisi Surat Masuk** secara berjenjang di lingkungan sekolah. 

Alur utama sistem mencakup:
1. **Kepala Sekolah** menerima notifikasi surat masuk berstatus *"Menunggu Kepala Sekolah"*, membaca metadata dan pratinjau dokumen surat secara digital.
2. Kepala Sekolah membuat instruksi disposisi dengan nomor disposisi otomatis, menentukan prioritas, batas waktu, dan target penerima:
   - Ke **Unit Kerja / Bagian** (misal: Wakasek Kurikulum, Wakasek Kesiswaan, Wakasek Sarpras).
   - Langsung ke **Pengguna Spesifik** (Guru atau Staf tertentu tanpa perantara).
   - Ke **Semua Pengguna / Seluruh Unit** (misal: surat edaran / himbauan umum).
3. **Penerima Disposisi** (Wakasek/Kepala Unit) dapat:
   - Memperbarui status tindak lanjut (*Belum Diproses*, *Diproses*, *Selesai*) beserta catatan laporan hasil.
   - **Meneruskan instruksi lanjutan (*sub-disposisi*)** kepada guru/staf di bawah unit kerjanya.
4. **Guru / Staf Pelaksana** menerima tugas lanjutan, melaksanakan instruksi, dan menginput laporan hasil penyelesaian.
5. Kepala Sekolah dan TU dapat memantau progres tindak lanjut dari seluruh tingkatan disposisi hingga surat berstatus selesai diarsipkan.

> 🔒 **Hak Akses & Otorisasi:**
> - Pembuatan disposisi awal: **Khusus role `kepala_sekolah`** (dan `admin`).
> - Pembuatan disposisi lanjutan (*sub-disposisi*): **Role penerima disposisi** (misal `kepala_unit` / Wakasek).
> - Pembaruan progres/catatan tindak lanjut: **User yang ditunjuk sebagai penerima disposisi**.

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
- **`tanggal_disposisi`**: `datetime` / `timestamp`, default `CURRENT_TIMESTAMP`, not null (waktu disposisi disubmit).
- **`from_user_id`**: `int`, not null, foreign key ke `users.id` (pemberi instruksi: Kepsek atau Wakasek).
- **`target_type`**: `varchar(20)`, not null (ENUM / string: `'department'`, `'user'`, `'all'`).
  - `'department'`: Ditujukan ke unit kerja tertentu (misal Wakasek Sarpras).
  - `'user'`: Ditujukan langsung ke guru/staf spesifik.
  - `'all'`: Ditujukan ke seluruh guru/staf (surat umum / himbauan).
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

---

## 🚀 Bagian 2: Spesifikasi Endpoint API (`/api/v1/disposisi`)

Semua endpoint modul ini menggunakan basis path: `/api/v1/disposisi`.

---

### 1. `GET /api/v1/disposisi/inbox`
Melihat daftar disposisi atau tugas yang masuk ke meja pengguna yang sedang login.
- **Akses**: Semua user terotentikasi (Kepala Sekolah, Wakasek, Guru, Staf).
- **Logika Filter**:
  - Menampilkan disposisi yang ditujukan langsung ke `user_id` yang sedang login, ATAU ke `department_id` tempat user bertugas, ATAU yang bertipe `all`.
- **Query Params**: `status` (`Belum Diproses`, `Diproses`, `Selesai`), `prioritas`, `page`, `limit`.
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
Mengambil detail lengkap disposisi beserta informasi surat asal dan riwayat disposisi turunannya (*sub-disposition*).
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
  *(Catatan: Jika `target_type: "all"`, `to_department_id` dan `to_user_id` boleh `null`).*
- **Alur Kerja Backend**:
  1. Validasi surat: pastikan surat ada dan berstatus siap didisposisi.
  2. Generate otomatis `nomor_disposisi` (`DSP-XXX/YYYY`).
  3. Simpan data disposisi ke tabel `dispositions`.
  4. Perbarui status surat masuk di `incoming_letters` menjadi `'Didisposisikan'`.
  5. Catat riwayat di `incoming_letter_histories`: *"Surat didisposisikan oleh Kepala Sekolah kepada [Target]"*.
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
- **Akses**: Penerima disposisi induk atau pihak unit terkait.
- **Request Body (JSON)**:
  ```json
  {
    "to_user_id": 12,
    "instruksi_lanjutan": "Harap periksa komputer lab 1 dan laporkan unit yang rusak",
    "catatan_tambahan": "Selesaikan hari ini",
    "batas_waktu": "2026-11-19"
  }
  ```
- **Alur Kerja Backend**:
  1. Buat baris baru di tabel `dispositions` dengan `parent_disposition_id = :id`.
  2. Generate nomor disposisi lanjutan baru.
  3. Catat di riwayat surat: *"Tugas disposisi diteruskan oleh [Wakasek] kepada [Nama Guru]"*.
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
- **Akses**: Pengguna yang berwenang mengerjakan disposisi tersebut.
- **Request Body (JSON)**:
  ```json
  {
    "status": "Selesai",
    "catatan_tindak_lanjut": "Pemeriksaan selesai. Ditemukan 3 unit PC mati power supply dan 1 unit monitor rusak."
  }
  ```
- **Alur Kerja Backend**:
  1. Validasi opsi status: `'Belum Diproses'`, `'Diproses'`, atau `'Selesai'`.
  2. Jika status `'Selesai'`, set `tanggal_selesai = NOW()`.
  3. Update `catatan_tindak_lanjut`.
  4. Catat aktivitas di riwayat surat: *"Tindak lanjut disposisi diperbarui menjadi: Selesai oleh [Nama User]"*.
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

1. **Fase 1: Penambahan Skema & Migrasi Database**
   - Tambahkan tabel `dispositions` pada [`backend/src/lib/schema.ts`](file:///home/egi/belajar_kode/Belajar_vibecoding/backend/src/lib/schema.ts).
   - Jalankan migrasi: `npm run db:generate` dan `npm run db:push`.

2. **Fase 2: Utility Generator Nomor Disposisi**
   - Buat fungsi utilitas pembuat nomor disposisi otomatis dengan format `DSP-{nomor_urut_3_digit}/{tahun}`.

3. **Fase 3: Pembuatan Modul Service `dispositions/`**
   - Buat struktur domain di `backend/src/services/dispositions/`:
     - `controller/dispositionController.ts`: Menangani input request dan response HTTP.
     - `dispositionService.ts`: Menjalankan logika bisnis (validasi hak akses, update status surat asal, pembaruan status selesai).
     - `dispositionRepository.ts`: Query Drizzle ORM untuk filter inbox, insert disposisi, update progres, dan query tree hierarki.
     - `validator/schema.ts`: Validasi payload disposisi utama, penerusan, dan tindak lanjut.
     - `routes/index.ts`: Pendaftaran rute API.

4. **Fase 4: Integrasi Audit Riwayat (`incoming_letter_histories`)**
   - Pastikan setiap ada disposisi baru, penerusan tugas, atau perubahan status tindak lanjut, modul ini otomatis melakukan insert ke tabel riwayat surat terkait.

5. **Fase 5: Pendaftaran Rute di Central Router**
   - Pasang rute disposisi pada [`backend/src/routes/index.ts`](file:///home/egi/belajar_kode/Belajar_vibecoding/backend/src/routes/index.ts) dengan prefix `/api/v1/disposisi`.

6. **Fase 6: Automated Testing**
   - Buat file pengujian di `backend/tests/disposition.test.ts` untuk menguji:
     - Validasi payload disposisi.
     - Proteksi hak akses role Kepala Sekolah.
     - Alur sub-disposisi (penerusan dari Wakasek ke Guru).
     - Pembaruan status tindak lanjut dan pencatatan tanggal selesai.

---

## 🎯 Acceptance Criteria
- [ ] Tabel `dispositions` terdaftar di Drizzle ORM dan tersinkronisasi di database MariaDB.
- [ ] Nomor disposisi ter-generate otomatis dengan pola `DSP-XXX/YYYY`.
- [ ] Kepala Sekolah dapat membuat disposisi yang ditujukan ke Departemen, Pengguna Tertentu, atau Semua Pengguna (`all`).
- [ ] Surat masuk otomatis berubah status menjadi `'Didisposisikan'` setelah disposisi pertama dibuat.
- [ ] Penerima disposisi dapat meneruskan tugas lanjutan (*sub-disposisi*) kepada guru/staf di bawahnya.
- [ ] Pelaksana tugas dapat mengubah status (*Belum Diproses*, *Diproses*, *Selesai*) dan mengisi catatan tindak lanjut.
- [ ] Setiap aksi disposisi dan perubahannya otomatis tercatat pada riwayat audit surat (`incoming_letter_histories`).
- [ ] Endpoint `/inbox` secara akurat menampilkan tugas yang relevan bagi user yang sedang login.

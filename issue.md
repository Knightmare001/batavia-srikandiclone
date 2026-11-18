# 📋 Issue: Perancangan Skema Database & Modul Terpadu: Arsip Global, Dashboard Multi-Role, Manajemen Pengguna, Notifikasi, dan Audit Trail Lengkap

## 📌 Ringkasan Masalah & Tujuan
Inisiatif ini bertujuan untuk melengkapi ekosistem persuratan dan pengarsipan digital sekolah dengan menyatukan seluruh komponen pendukung utama:
1. **Pusat Arsip & Pencarian Global (`/api/v1/arsip`)**: Satu pintu pencarian cerdas yang menggabungkan arsip surat masuk dan surat keluar, dilengkapi statistik serta filter komprehensif tanpa perlu membuka folder Google Drive.
2. **Dashboard Dinamis Multi-Role (`/api/v1/dashboard`)**: Menampilkan ringkasan informasi dan metrik penting yang disesuaikan secara otomatis berdasarkan role pengguna yang sedang login (Admin, TU, Kepala Sekolah, Wakasek, Guru/Staf).
3. **Manajemen Pengguna & Departemen Lengkap (`/api/v1/users` & `/api/v1/departments`)**: Fitur administrasi untuk Admin dalam mengelola akun pengguna (daftar, detail, edit, aktif/nonaktifkan akun via soft-delete/status, ubah password) serta pengelolaan unit kerja/departemen sekolah.
4. **Modul Notifikasi Internal (`/api/v1/notifications`)**: Sistem pemberitahuan berbasis database untuk memberi tahu pihak terkait ketika ada surat masuk baru, disposisi baru, penerusan tugas, atau laporan penyelesaian tugas.
5. **Penyempurnaan Audit Trail Terpadu**: Standardisasi pencatatan log aktivitas di seluruh modul yang bersifat *immutable* (hanya bisa ditambah/insert, tidak bisa diedit atau dihapus).

---

## 🗄️ Bagian 1: Rancangan Skema Database (Drizzle ORM)

Untuk mendukung modul-modul di atas, diperlukan penambahan tabel **Notifikasi** dan tabel **Log Audit Global Sistem**, serta pemanfaatan tabel master yang sudah ada:

### 1. Tabel Baru: `notifications` (Pemberitahuan Pengguna)
Menyimpan notifikasi yang ditujukan kepada masing-masing pengguna:
- **`id`**: `int`, primary key, auto increment.
- **`user_id`**: `int`, not null, foreign key ke `users.id` (penerima notifikasi).
- **`judul`**: `varchar(150)`, not null (misal: *"Disposisi Baru Diterima"*, *"Tugas Diselesaikan"*).
- **`pesan`**: `text`, not null (isi pesan singkat notifikasi).
- **`tipe`**: `varchar(50)`, not null (kategori notifikasi: `surat_masuk`, `disposisi`, `tugas_selesai`, `sistem`).
- **`referensi_id`**: `int`, nullable (ID entitas terkait, misalnya ID surat atau ID disposisi).
- **`link_url`**: `varchar(255)`, nullable (tautan cepat menuju halaman terkait di antarmuka frontend).
- **`is_read`**: `boolean` / `tinyint(1)`, not null, default: `false` (penanda status telah dibaca).
- **`read_at`**: `timestamp`, nullable (waktu pengguna membaca notifikasi).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.

---

### 2. Tabel Baru: `system_audit_logs` (Audit Trail Aktivitas Global)
Mencatat seluruh aksi penting di sistem secara terpusat dan *immutable*:
- **`id`**: `int`, primary key, auto increment.
- **`user_id`**: `int`, not null, foreign key ke `users.id` (pelaku aksi).
- **`role_name`**: `varchar(50)`, not null (role pelaku saat melakukan aksi).
- **`modul`**: `varchar(50)`, not null (`auth`, `surat_masuk`, `surat_keluar`, `disposisi`, `users`, `departments`).
- **`aktivitas`**: `varchar(100)`, not null (contoh: *"Mencatat surat masuk"*, *"Membuat disposisi"*, *"Menyelesaikan tugas"*, *"Mengubah password user"*).
- **`deskripsi`**: `text`, nullable (detail informasi atau ringkasan perubahan).
- **`ip_address`**: `varchar(45)`, nullable (IP client pengirim request).
- **`created_at`**: `timestamp`, default `CURRENT_TIMESTAMP`, not null.

---

### 3. Penyelarasan Tabel Eksisting
- **Tabel `users`**:
  - Kolom `deleted_at` digunakan sebagai penanda status aktif/nonaktif akun (jika `deleted_at IS NOT NULL`, akun dianggap nonaktif dan ditolak saat login).
- **Tabel `departments`**:
  - Sudah memiliki struktur: `id`, `name`, `createdAt`.
- **Tabel `incoming_letters` & `outgoing_letters`**:
  - Menjadi sumber data terpadu untuk modul Arsip dan metrik Dashboard.

---

## 🚀 Bagian 2: Spesifikasi Fitur & Endpoint API

---

### MODUL 1: Pusat Arsip & Pencarian Global (`/api/v1/arsip`)

Menyediakan pencarian gabungan (*federated search*) antara Surat Masuk dan Surat Keluar dalam satu antarmuka terpusat.

#### 1. `GET /api/v1/arsip`
Mengambil daftar gabungan arsip surat masuk dan surat keluar.
- **Akses**: Semua user terotentikasi.
- **Query Parameter**:
  - `search`: Pencarian teks bebas (pada nomor surat, perihal, pengirim, atau tujuan).
  - `jenis`: Filter jenis arsip (`surat_masuk` atau `surat_keluar`). Jika kosong, tampilkan keduanya.
  - `tahun`: Filter tahun (contoh: `2026`).
  - `bulan`: Filter bulan (1-12).
  - `status`: Filter status dokumen (misal: `Selesai`, `Tercatat`, `Didisposisikan`).
  - `page` & `limit`: Pagination.
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "jenis_arsip": "surat_masuk",
        "nomor_agenda": "SM-001/2026",
        "nomor_surat": "001/SARPRAS/XI/2026",
        "perihal": "Laporan Kerusakan Fasilitas",
        "pihak_terkait": "Wakasek Sarpras",
        "tanggal": "2026-11-10",
        "status": "Selesai"
      },
      {
        "id": 1,
        "jenis_arsip": "surat_keluar",
        "nomor_agenda": "SK-001/2026",
        "nomor_surat": "050/SMK/XI/2026",
        "perihal": "Undangan Rapat Evaluasi",
        "pihak_terkait": "Seluruh Guru",
        "tanggal": "2026-11-18",
        "status": "Tercatat"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 2, "total_pages": 1 }
  }
  ```

#### 2. `GET /api/v1/arsip/:jenis/:id`
Melihat detail lengkap arsip berdasarkan jenis (`surat_masuk` atau `surat_keluar`) dan ID.

#### 3. `GET /api/v1/arsip/statistik`
Ringkasan statistik arsip untuk grafik dan pemantauan cepat:
- Total surat masuk tahun berjalan.
- Total surat keluar tahun berjalan.
- Surat masuk berdasarkan status (`Draft`, `Menunggu Kepala Sekolah`, `Didisposisikan`, `Selesai`).
- Rekapitulasi per bulan.

---

### MODUL 2: Dashboard Dinamis Multi-Role (`GET /api/v1/dashboard`)

Mengembalikan data statistik dan ringkasan tugas yang dipersonalisasi sesuai role pengguna yang login (berdasarkan token JWT).
- **Akses**: Semua user terotentikasi.
- **Logika Output Berdasarkan Role**:
  - **Admin**:
    - Total pengguna aktif, total departemen, rincian user per role, dan log audit sistem terbaru.
  - **Tata Usaha (TU)**:
    - Total surat masuk, total surat keluar, surat masuk yang belum diteruskan (Draft), dan surat yang masih menunggu Kepala Sekolah.
  - **Kepala Sekolah**:
    - Jumlah surat yang menunggu disposisi, progres disposisi berjalan, dan daftar surat masuk prioritas tinggi (Segera/Penting).
  - **Wakasek / Kepala Unit**:
    - Disposisi yang diterima unit kerjanya, tugas yang sedang diteruskan ke guru, dan laporan guru yang menunggu verifikasi.
  - **Guru / Staf**:
    - Total tugas aktif (Belum Diproses, Diproses), total tugas selesai, dan tugas dengan batas waktu terdekat.
- **Contoh Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "role": "tu",
    "data": {
      "total_surat_masuk": 42,
      "total_surat_keluar": 18,
      "surat_menunggu_disposisi": 3,
      "surat_terbaru": [ ... ]
    }
  }
  ```

---

### MODUL 3: Manajemen Pengguna & Departemen (Admin)

#### Pengelolaan Akun Pengguna (`/api/v1/users`)
- `GET /api/v1/users`: Menampilkan daftar semua pengguna beserta info role dan departemen (dukungan search & pagination).
- `GET /api/v1/users/:id`: Detail profil pengguna tertentu.
- `PUT /api/v1/users/:id`: Memperbarui informasi profil pengguna (nama, email, NIP, role, departemen, jabatan).
- `PATCH /api/v1/users/:id/status`: Mengaktifkan atau menonaktifkan akun (`deleted_at` set NULL atau timestamp).
- `PATCH /api/v1/users/:id/password`: Mengubah password akun pengguna oleh Admin (menggunakan hash bcrypt baru).

#### Pengelolaan Departemen / Unit Kerja (`/api/v1/departments`)
- `GET /api/v1/departments`: Menampilkan seluruh daftar departemen sekolah.
- `POST /api/v1/departments`: Menambahkan unit kerja baru (nama unit harus unik).
- `PUT /api/v1/departments/:id`: Memperbarui nama departemen.
- **Akses**: Khusus Role **Admin**.

---

### MODUL 4: Sistem Notifikasi Internal (`/api/v1/notifications`)

Pemberitahuan otomatis saat terjadi peristiwa penting dalam alur kerja:
- **Pemicu Otomatis (Event Triggers)**:
  1. TU meneruskan surat masuk $\rightarrow$ Notifikasi ke Kepala Sekolah.
  2. Kepala Sekolah membuat disposisi $\rightarrow$ Notifikasi ke Wakasek/Unit kerja tujuan.
  3. Wakasek meneruskan tugas $\rightarrow$ Notifikasi ke Guru/Staf pelaksana.
  4. Guru menyelesaikan tugas $\rightarrow$ Notifikasi ke Wakasek pemberi tugas.
  5. Seluruh disposisi tuntas $\rightarrow$ Notifikasi ke Kepala Sekolah dan TU.
- **Endpoints**:
  - `GET /api/v1/notifications`: Menampilkan notifikasi milik pengguna yang sedang login (dengan info jumlah belum dibaca).
  - `PATCH /api/v1/notifications/:id/read`: Menandai satu notifikasi telah dibaca.
  - `PATCH /api/v1/notifications/read-all`: Menandai seluruh notifikasi milik pengguna telah dibaca.

---

### MODUL 5: Penguatan Audit Trail Terpadu

- Setiap operasi penting di backend otomatis mencatat riwayat ke tabel `system_audit_logs`.
- Data audit trail bersifat **Append-Only** (hanya `INSERT`, tidak ada endpoint `PUT` atau `DELETE` untuk data log).
- Format log menyimpan waktu presisi, identitas pelaku (`userId` & `role`), modul yang diakses, dan rincian aktivitas.

---

## 📝 Panduan Implementasi Bertahap (High-Level untuk Junior Programmer)

1. **Fase 1: Skema Database & Migrasi**
   - Definisikan tabel `notifications` dan `system_audit_logs` di [`backend/src/lib/schema.ts`](file:///home/egi/belajar_kode/Belajar_vibecoding/backend/src/lib/schema.ts).
   - Jalankan migrasi: `npm run db:generate` dan `npm run db:push`.

2. **Fase 2: Layanan Notifikasi Terpadu (`notificationService.ts`)**
   - Buat fungsi utilitas `sendNotification(userId, title, message, type, refId, linkUrl)` yang dapat dipanggil dari service surat masuk, disposisi, dan pengguna.

3. **Fase 3: Layanan Audit Log Helper (`auditLogger.ts`)**
   - Buat helper fungsi untuk mencatat aktivitas penting secara asynchronous tanpa menghambat respon utama HTTP.

4. **Fase 4: Modul Manajemen Pengguna & Departemen**
   - Lengkapi handler endpoint CRUD user dan department di bawah otorisasi ketat role Admin (`authorizeRoles("admin")`).

5. **Fase 5: Modul Pusat Arsip Global (`archiveService.ts`)**
   - Gabungkan query surat masuk dan surat keluar menggunakan `UNION` atau mapping Drizzle ORM dengan dukungan filter tahun, bulan, jenis, dan kata kunci pencarian.

6. **Fase 6: Modul Dashboard Dinamis (`dashboardService.ts`)**
   - Buat logika percabangan berdasarkan `req.authUser.role` untuk mengambil agregasi data statistik spesifik tiap peran pengguna.

7. **Fase 7: Automated Testing**
   - Tulis unit & integration test untuk memvalidasi:
     - Filter pencarian arsip gabungan.
     - Respons metrik dashboard untuk masing-masing role.
     - Operasi manajemen user (status aktif/nonaktif, edit password).
     - Alur pembuatan notifikasi dan penandaan status baca.

---

## 🎯 Acceptance Criteria
- [ ] Tabel `notifications` dan `system_audit_logs` tersinkronisasi di database MariaDB.
- [ ] Endpoint `GET /api/v1/arsip` dapat mencari dan menampilkan gabungan data surat masuk dan surat keluar secara akurat.
- [ ] Endpoint `GET /api/v1/dashboard` mengembalikan statistik yang sesuai dengan role pengguna yang sedang login.
- [ ] Admin dapat melihat, mengubah informasi, menonaktifkan akun, dan me-reset password pengguna lain.
- [ ] Admin dapat menambah dan mengedit data departemen/unit kerja.
- [ ] Pengguna menerima notifikasi otomatis saat ada disposisi atau tugas baru yang ditujukan kepadanya.
- [ ] Pengguna dapat menandai notifikasi telah dibaca (`/read` dan `/read-all`).
- [ ] Seluruh aktivitas penting tercatat pada log audit sistem dan tidak dapat dimanipulasi oleh pengguna biasa.
- [ ] Seluruh unit test lulus pengujian 100%.

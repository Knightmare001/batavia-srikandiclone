# 📋 Issue: Perancangan Arsitektur Frontend Aplikasi Persuratan & Kearsipan Sekolah Islam (Desain Ala SRIKANDI)

## 📌 Ringkasan Masalah & Tujuan
Inisiatif ini bertujuan untuk membangun antarmuka pengguna (Frontend) untuk Sistem Informasi Persuratan dan Kearsipan Digital Sekolah. 

Antarmuka ini mengadopsi pola tata letak aplikasi **SRIKANDI** (Sistem Kearsipan Dinamis Terintegrasi) dengan sentuhan identitas **Madrasah / Pesantren / Sekolah Islam**:
1. **Navigasi Sisi Kiri (Sidebar Navigation)**: Menu navigasi utama diletakkan di sebelah kiri dengan ikon representatif, status aktif yang jelas, serta collapsible/responsive untuk perangkat mobile.
2. **Tema Minimalis & Elegan**: 
   - Mode Terang (*Light Mode*): Dominan warna **Putih bersih** (`bg-white` / `bg-slate-50`) dengan teks gelap kontras tinggi.
   - Mode Gelap (*Dark Mode*): Dominan warna **Hitam / Slate pekat** (`dark:bg-slate-900`) yang ramah di mata.
   - Aksen Khas Madrasah/Pesantren: Sentuhan warna **Hijau Islami / Emerald** (`emerald-600` / `emerald-700`) sebagai warna primer untuk tombol aksi utama (*CTA*), badge status, highlight navigasi aktif, dan kartu ringkasan.
3. **Tech Stack Modern**:
   - **Framework**: **React 19 / Versi Terbaru** (menggunakan Vite / Next.js bundler).
   - **Styling**: **Tailwind CSS v4** (atau v3.4+ dengan utility classes modern).
   - **Ikon**: Lucide React (`lucide-react`) untuk set ikon yang bersih dan konsisten.
   - **Client State / Fetching**: Fetch/Axios terpusat yang terintegrasi dengan Bearer token JWT backend.
4. **Struktur Direktori**: Ditempatkan di dalam folder `frontend/` mengikuti kaidah *Industry Best Practices* (Modular, Reusable Components, Custom Hooks, dan Context API).

---

## 🎨 Bagian 1: Panduan Desain & Tata Letak Antarmuka (Layout SRIKANDI)

```text
+-----------------------------------------------------------------------------------------+
| [LOGO MADRASAH] Sistem Kearsipan Digital                 [Cari...] [🔔 Notif] [👤 Profil]|
+-----------------------+-----------------------------------------------------------------+
| 📊 Dashboard          | 📌 Dashboard / Surat Masuk / Disposisi                           |
| 📥 Surat Masuk (TU)   |-----------------------------------------------------------------|
| 📤 Surat Keluar (TU)  |                                                                 |
| 🔀 Disposisi (Kepsek) |              [KONTEN HALAMAN UTAMA / DATA TABEL]                 |
| 📋 Tugas Saya (Guru)  |                                                                 |
| 🗄️ Arsip & Pencarian |                                                                 |
| 👥 Manajemen User     |                                                                 |
| ⚙️ Pengaturan         |                                                                 |
|                       |                                                                 |
| [🌙 Toggle Dark Mode] |                                                                 |
| [🚪 Logout]           |                                                                 |
+-----------------------+-----------------------------------------------------------------+
```

### 1. Tata Letak (Layout Hierarchy)
- **Sidebar Kiri**:
  - Logo instansi sekolah + nama aplikasi (*batavia - srikandiClone*).
  - Menu dinamis disesuaikan dengan **Role** pengguna dari payload JWT:
    - *Admin*: Dashboard, Manajemen User, Kelola Departemen, Arsip Global, Audit Trail.
    - *TU*: Dashboard, Surat Masuk (Input/List), Surat Keluar (Input/List), Arsip Global.
    - *Kepala Sekolah*: Dashboard, Menunggu Disposisi, Monitoring Disposisi, Arsip Global.
    - *Wakasek / Kepala Unit*: Dashboard, Disposisi Diterima, Teruskan Tugas, Laporan Guru.
    - *Guru / Staf*: Dashboard, Tugas Saya, Riwayat Tugas, Arsip Global.
  - Tombol alih mode gelap/terang (*Dark/Light Mode Switcher*) dan tombol Logout di bagian bawah sidebar.
- **Top Header**:
  - Kolom pencarian cepat global (*Global Quick Search*).
  - Lonceng notifikasi interaktif (`/api/v1/notifications`) dengan penanda titik merah (*unread badge*) dan popover list notifikasi.
  - Identitas akun yang login (Nama, NIP, Badge Role).
- **Area Konten Utama (Main Content)**:
  - Header halaman (Breadcrumbs, Judul Halaman, Tombol Aksi Primer Hijau).
  - Kartu Ringkasan Metrik (Statistik dengan aksen hijau emerald).
  - Tabel Data dengan fitur pencarian real-time, filter tanggal/status, pagination, dan tombol pratinjau dokumen PDF *in-app modal*.

---

## 📁 Bagian 2: Struktur Direktori Target (`frontend/`)

Terapkan hierarki direktori berbasis best practice berikut:

```text
frontend/
├── public/                     # Favicon, logo madrasah, aset statis
├── src/
│   ├── assets/                 # Gambar lokal, ilustrasi kosong (empty states)
│   ├── components/             # Reusable UI Components
│   │   ├── common/             # Tombol, Input, Modal, Dropdown, Badge, Pagination
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Table.tsx
│   │   ├── layout/             # Komponen kerangka aplikasi
│   │   │   ├── AppLayout.tsx   # Wrapper Sidebar + Header + Content
│   │   │   ├── Sidebar.tsx     # Navigasi kiri ala SRIKANDI
│   │   │   ├── Header.tsx      # Top bar (profil, notifikasi)
│   │   │   └── ThemeToggle.tsx # Dark mode toggle
│   │   ├── pdf/                # Komponen PDF viewer / inline preview
│   │   │   └── DocumentViewer.tsx
│   │   └── notification/       # Dropdown popover notifikasi
│   │       └── NotificationBell.tsx
│   ├── context/                # Global React Context
│   │   ├── AuthContext.tsx     # State login, user info, logout, token JWT
│   │   └── ThemeContext.tsx    # State tema (light/dark mode)
│   ├── hooks/                  # Custom React Hooks
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   └── useDebounce.ts      # Optimasi pencarian cepat
│   ├── pages/                  # Halaman Aplikasi Berdasarkan Modul
│   │   ├── auth/
│   │   │   └── LoginPage.tsx   # Halaman login modern (NIP + Password)
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx # Dashboard adaptif sesuai role
│   │   ├── suratMasuk/
│   │   │   ├── SuratMasukListPage.tsx
│   │   │   ├── SuratMasukCreatePage.tsx
│   │   │   └── SuratMasukDetailPage.tsx
│   │   ├── suratKeluar/
│   │   │   ├── SuratKeluarListPage.tsx
│   │   │   └── SuratKeluarCreatePage.tsx
│   │   ├── disposisi/
│   │   │   ├── DisposisiInboxPage.tsx
│   │   │   ├── DisposisiCreatePage.tsx
│   │   │   └── DisposisiDetailPage.tsx
│   │   ├── tugasGuru/
│   │   │   ├── TugasSayaPage.tsx
│   │   │   └── RiwayatTugasPage.tsx
│   │   ├── arsip/
│   │   │   └── ArsipGlobalPage.tsx # Satu pintu pencarian arsip
│   │   └── admin/
│   │       ├── UserManagementPage.tsx
│   │       └── DepartmentManagementPage.tsx
│   ├── services/               # API Call Integration (Axios / Fetch Client)
│   │   ├── api.ts              # Interceptor otomatis pasang Bearer Token
│   │   ├── authService.ts
│   │   ├── letterService.ts
│   │   ├── dispositionService.ts
│   │   └── notificationService.ts
│   ├── types/                  # TypeScript Interfaces & Types
│   │   └── index.ts
│   ├── App.tsx                 # Routing konfigurasi (React Router v7 / v6)
│   ├── main.tsx                # Entry point React
│   └── index.css               # Setup Tailwind CSS directives
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js          # Konfigurasi palet warna emerald & dark mode
├── tsconfig.json
└── vite.config.ts
```

---

## 🎨 Bagian 3: Konfigurasi Desain & Palet Warna Tailwind

### Palet Warna Utama:
- **Primary / Nuansa Madrasah**: `emerald-600` (`#059669`) dan `emerald-700` (`#047857`) untuk aksen, tombol utama, dan highlight aktif.
- **Background Light**: `slate-50` (`#f8fafc`) untuk canvas dasar, `white` (`#ffffff`) untuk kartu konten.
- **Background Dark**: `slate-900` (`#0f172a`) untuk canvas gelap, `slate-800` (`#1e293b`) untuk sidebar dan kartu.
- **Border & Separator**: `slate-200` (`dark:border-slate-700`).
- **Status Badges**:
  - *Selesai / Aktif*: `bg-emerald-100 text-emerald-800` (`dark:bg-emerald-950 dark:text-emerald-300`).
  - *Menunggu / Proses*: `bg-amber-100 text-amber-800` (`dark:bg-amber-950 dark:text-amber-300`).
  - *Segera / Penting*: `bg-rose-100 text-rose-800` (`dark:bg-rose-950 dark:text-rose-300`).

---

## 📝 Bagian 4: Panduan Langkah Demi Langkah (Untuk Junior Programmer)

1. **Fase 1: Inisialisasi Proyek Frontend**
   - Buat proyek React TypeScript baru di folder `frontend/` menggunakan Vite:
     ```bash
     npm create vite@latest frontend -- --template react-ts
     ```
   - Instal dependensi utama:
     ```bash
     cd frontend
     npm install
     npm install react-router-dom lucide-react clsx tailwind-merge
     npm install -D tailwindcss postcss autoprefixer
     npx tailwindcss init -p
     ```

2. **Fase 2: Konfigurasi Tailwind & Dark Mode**
   - Aktifkan class-based dark mode pada `tailwind.config.js`:
     ```js
     module.exports = {
       darkMode: 'class',
       content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
       theme: {
         extend: {
           colors: {
             primary: {
               50: '#ecfdf5',
               500: '#10b981',
               600: '#059669',
               700: '#047857',
             }
           }
         }
       }
     }
     ```

3. **Fase 3: Global State & API Client**
   - Buat `AuthContext` untuk menyimpan token JWT, identitas user, role, dan fungsi login/logout.
   - Buat client Axios/Fetch di `src/services/api.ts` yang otomatis menyisipkan header:
     ```ts
     headers: { Authorization: `Bearer ${token}` }
     ```

4. **Fase 4: Kerangka Tata Letak SRIKANDI (`AppLayout`)**
   - Bangun komponen `Sidebar.tsx` dengan daftar menu berikon yang dinamis berdasarkan role akun login.
   - Bangun komponen `Header.tsx` lengkap dengan popover notifikasi dan tombol switch dark mode.

5. **Fase 5: Integrasi Halaman Kunci**
   - **Login Page**: Form login NIP & Password dengan tema islami modern.
   - **Dashboard**: Widget metrik ringkasan data yang disesuaikan dengan role.
   - **Surat Masuk & Surat Keluar**: Tabel data dengan modal *PDF Document Viewer* (menampilkan dokumen langsung via URL endpoint `/dokumen`).
   - **Disposisi & Tugas Guru**: Formulir tindak lanjut laporan tugas dengan feedback visual status.
   - **Pusat Arsip Global**: Halaman pencarian terpadu surat masuk & keluar dengan filter instan.

---

## 🎯 Acceptance Criteria
- [ ] Folder `frontend/` terinisialisasi menggunakan **React terbaru + TypeScript + Tailwind CSS**.
- [ ] Tata letak mengadopsi navigasi **Sidebar Kiri berikon ala SRIKANDI** yang rapi dan responsif.
- [ ] Skema warna bernuansa **Madrasah/Islami** (Dominan putih/hitam dengan aksen hijau emerald).
- [ ] Fitur **Dark Mode & Light Mode** dapat berganti secara mulus dan persisten.
- [ ] Dokumen surat PDF dapat langsung dipratinjau (*inline preview*) di dalam aplikasi tanpa perlu diunduh manual.
- [ ] Menu navigasi otomatis menyesuaikan dengan **Role pengguna** (Admin, TU, Kepala Sekolah, Wakasek, Guru).
- [ ] Terhubung penuh dengan endpoint backend (`/api/v1/auth`, `/api/v1/surat-masuk`, `/api/v1/surat-keluar`, `/api/v1/disposisi`, `/api/v1/arsip`, `/api/v1/dashboard`, `/api/v1/notifications`).

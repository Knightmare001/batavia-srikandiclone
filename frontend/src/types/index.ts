export type Role = "admin" | "tu" | "kepala_sekolah" | "pegawai";
export interface SessionUser { id?: number; name: string; nip: string; email: string; role: Role | string; }
export interface ApiResponse<T> { success?: boolean; data: T; message?: string; }
export interface PageInfo { page: number; limit: number; total?: number; total_items?: number; total_pages: number; }
export interface ArchiveItem { id: number; jenis_arsip: "surat_masuk" | "surat_keluar"; nomor_agenda: string; nomor_surat?: string | null; perihal: string; pihak_terkait: string; tanggal: string; status: string; }

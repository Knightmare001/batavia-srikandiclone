import { Archive, BellRing, BookOpenCheck, Building2, FileInput, FileOutput, LayoutDashboard, ListTodo, LogOut, Pencil, ScrollText, Users, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { Role } from "../../types";
import { useAuth } from "../../hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "tu", "kepala_sekolah", "pegawai"] },
  { to: "/surat-masuk", label: "Surat Masuk", icon: FileInput, roles: ["admin", "tu"] },
  { to: "/surat-keluar", label: "Surat Keluar", icon: FileOutput, roles: ["admin", "tu"] },
  { to: "/disposisi", label: "Disposisi", icon: BookOpenCheck, roles: ["admin", "kepala_sekolah"] },
  { to: "/disposisi/pantau", label: "Pantau & Riwayat Disposisi", icon: ListTodo, roles: ["kepala_sekolah"] },
  { to: "/disposisi/pantau", label: "Pantau Disposisi", icon: ListTodo, roles: ["admin", "tu"] },
  { to: "/tugas", label: "Tugas Saya", icon: ListTodo, roles: ["pegawai"] },
  { to: "/tugas/riwayat", label: "Riwayat Tugas", icon: ScrollText, roles: ["pegawai"] },
  { to: "/arsip", label: "Arsip Global", icon: Archive, roles: ["admin", "tu", "kepala_sekolah"] },
  { to: "/admin/users", label: "Manajemen User", icon: Users, roles: ["admin"] },
  { to: "/admin/departments", label: "Departemen", icon: Building2, roles: ["admin"] },
  { to: "/admin/audit", label: "Audit Trail", icon: ScrollText, roles: ["admin"] },
];
const roleLabel: Record<string, string> = { admin: "Administrator", tu: "Tata Usaha", kepala_sekolah: "Kepala Sekolah", pegawai: "Pegawai" };
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false), [editOpen, setEditOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setMenuOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  async function saveProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); try { await updateProfile(String(form.get("name")), String(form.get("email"))); setEditOpen(false); setMenuOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan profil"); } finally { setBusy(false); } }
  return <><div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={onClose} /><aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
    <div className="brand"><div className="brand-mark"><BookOpenCheck size={21} /></div><div><strong>e-Arsip</strong><small>Madrasah Digital</small></div><button className="icon-button sidebar-close" onClick={onClose} data-tooltip="Tutup menu" aria-label="Tutup menu"><X size={18} /></button></div>
    <div className="nav-caption">MENU UTAMA</div><nav className="side-nav">{items.filter((item) => item.roles.includes((user?.role || "pegawai") as Role)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><span className="nav-icon"><Icon size={18} /></span><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><ThemeToggle /><div className="profile-menu-wrap sidebar-profile-menu" ref={profileRef}><button className="sidebar-user" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}><span className="avatar">{user?.name?.slice(0, 1).toUpperCase() || "U"}</span><span className="user-copy"><strong>{user?.name}</strong><span>{roleLabel[user?.role || ""] || user?.role}</span></span><BellRing size={16} className="user-status" /></button>{menuOpen && <div className="account-menu sidebar-account-menu"><button onClick={() => { setMenuOpen(false); setError(""); setEditOpen(true); }}><UserRound size={16} /> Ubah profil</button><button className="account-logout" onClick={() => { setMenuOpen(false); logout(); navigate("/login"); }}><LogOut size={16} /> Keluar</button></div>}</div></div>
  </aside>{editOpen && <Modal title="Ubah profil" onClose={() => setEditOpen(false)}><form className="form-stack modal-form" onSubmit={saveProfile}><label>Nama lengkap<input name="name" required maxLength={150} defaultValue={user?.name || ""} /></label><label>Email<input name="email" type="email" required defaultValue={user?.email || ""} /></label>{error && <div className="error-box">{error}</div>}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button disabled={busy}><Pencil size={15} /> {busy ? "Menyimpan…" : "Simpan perubahan"}</Button></div></form></Modal>}</>;
}

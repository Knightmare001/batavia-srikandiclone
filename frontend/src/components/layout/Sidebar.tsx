import { Archive, BellRing, BookOpenCheck, Building2, FileInput, FileOutput, LayoutDashboard, ListTodo, LogOut, ScrollText, Users, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Role } from "../../types";
import { useAuth } from "../../hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { useNavigate } from "react-router-dom";
const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "tu", "kepala_sekolah", "kepala_unit", "guru_staf"] },
  { to: "/surat-masuk", label: "Surat Masuk", icon: FileInput, roles: ["admin", "tu"] },
  { to: "/surat-keluar", label: "Surat Keluar", icon: FileOutput, roles: ["admin", "tu"] },
  { to: "/disposisi", label: "Disposisi", icon: BookOpenCheck, roles: ["admin", "kepala_sekolah", "kepala_unit"] },
  { to: "/tugas", label: "Tugas Saya", icon: ListTodo, roles: ["guru_staf", "kepala_unit"] },
  { to: "/tugas/riwayat", label: "Riwayat Tugas", icon: ScrollText, roles: ["guru_staf"] },
  { to: "/arsip", label: "Arsip Global", icon: Archive, roles: ["admin", "tu", "kepala_sekolah", "kepala_unit", "guru_staf"] },
  { to: "/admin/users", label: "Manajemen User", icon: Users, roles: ["admin"] },
  { to: "/admin/departments", label: "Departemen", icon: Building2, roles: ["admin"] },
  { to: "/admin/audit", label: "Audit Trail", icon: ScrollText, roles: ["admin"] },
];
const roleLabel: Record<string, string> = { admin: "Administrator", tu: "Tata Usaha", kepala_sekolah: "Kepala Sekolah", kepala_unit: "Wakasek / Kepala Unit", guru_staf: "Guru / Staf" };
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth(), navigate = useNavigate();
  return <><div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={onClose} /><aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
    <div className="brand"><div className="brand-mark"><BookOpenCheck size={21} /></div><div><strong>e-Arsip</strong><small>Madrasah Digital</small></div><button className="icon-button sidebar-close" onClick={onClose} aria-label="Tutup menu"><X size={18} /></button></div>
    <div className="nav-caption">MENU UTAMA</div><nav className="side-nav">{items.filter((item) => item.roles.includes((user?.role || "guru_staf") as Role)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><span className="nav-icon"><Icon size={18} /></span><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><ThemeToggle /><button className="nav-item logout-item" onClick={() => { logout(); navigate("/login"); }}><span className="nav-icon"><LogOut size={18} /></span><span>Keluar</span></button><div className="sidebar-user"><div className="avatar">{user?.name?.slice(0, 1).toUpperCase() || "U"}</div><div className="user-copy"><strong>{user?.name}</strong><span>{roleLabel[user?.role || ""] || user?.role}</span></div><BellRing size={16} className="user-status" /></div></div>
  </aside></>;
}

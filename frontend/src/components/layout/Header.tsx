import { Menu, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "../notification/NotificationBell";
import { useAuth } from "../../hooks/useAuth";
export function Header({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth(), navigate = useNavigate(); const [query, setQuery] = useState("");
  return <header className="topbar"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Buka menu"><Menu size={20} /></button><form className="quick-search" onSubmit={(e) => { e.preventDefault(); navigate(`/arsip${query ? `?search=${encodeURIComponent(query)}` : ""}`); }}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari surat, nomor agenda, atau perihal..." /><kbd>↵</kbd></form><div className="top-actions"><NotificationBell /><div className="header-profile"><div className="avatar avatar-small">{user?.name?.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user?.name}</strong><small>{user?.nip}</small></div></div></div></header>;
}

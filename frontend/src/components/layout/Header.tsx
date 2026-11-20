import { LogOut, Menu, Pencil, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NotificationBell } from "../notification/NotificationBell";
import { useAuth } from "../../hooks/useAuth";
export function Header({ onMenu }: { onMenu: () => void }) {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false),
    [editOpen, setEditOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !profileRef.current?.contains(event.target)
      )
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await updateProfile(String(form.get("name")), String(form.get("email")));
      setEditOpen(false);
      setMenuOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan profil");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          data-tooltip="Buka menu"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>
        <div className="top-actions">
          <NotificationBell />
          <div className="profile-menu-wrap" ref={profileRef}>
            <button
              className="profile-trigger"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
            >
              <span className="avatar avatar-small">
                {user?.name?.slice(0, 1).toUpperCase()}
              </span>
              <span className="profile-copy">
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
              </span>
            </button>
            {menuOpen && (
              <div className="account-menu">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setError("");
                    setEditOpen(true);
                  }}
                >
                  <UserRound size={16} /> Ubah profil
                </button>
                <button
                  className="account-logout"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate("/login");
                  }}
                >
                  <LogOut size={16} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {editOpen && (
        <Modal title="Ubah profil" onClose={() => setEditOpen(false)}>
          <form className="form-stack modal-form" onSubmit={saveProfile}>
            <label>
              Nama lengkap
              <input
                name="name"
                required
                maxLength={150}
                defaultValue={user?.name || ""}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                defaultValue={user?.email || ""}
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(false)}
              >
                Batal
              </Button>
              <Button disabled={busy}>
                <Pencil size={15} /> {busy ? "Menyimpan…" : "Simpan perubahan"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

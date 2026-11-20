import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
type Notice = {
  id: number;
  judul: string;
  pesan: string;
  isRead: boolean;
  createdAt: string;
  linkUrl?: string | null;
};
export function NotificationBell() {
  const navigate = useNavigate(),
    { user } = useAuth();
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Notice[]>([]),
    [unread, setUnread] = useState(0);
  const refresh = () =>
    api<{ data: Notice[]; unread_count: number }>("/notifications?limit=8")
      .then((r) => {
        setItems(r.data);
        setUnread(r.unread_count);
      })
      .catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);
  const markRead = async (item: Notice) => {
    if (!item.isRead)
      await api(`/notifications/${item.id}/read`, { method: "PATCH" });
    if (item.linkUrl?.startsWith("/disposisi/riwayat"))
      navigate(
        user?.role === "kepala_sekolah"
          ? "/disposisi/riwayat"
          : "/tugas/riwayat",
      );
    else if (item.linkUrl?.startsWith("/disposisi/pantau"))
      navigate("/disposisi/pantau");
    else if (item.linkUrl?.startsWith("/disposisi"))
      navigate(user?.role === "pegawai" ? "/tugas" : "/disposisi");
    else if (item.linkUrl?.startsWith("/surat-masuk"))
      navigate(
        user?.role === "tu" || user?.role === "admin"
          ? "/surat-masuk"
          : "/arsip",
      );
    else navigate("/arsip");
    setOpen(false);
    void refresh();
  };
  return (
    <div className="notification-wrap">
      <button
        className="header-icon"
        onClick={() => {
          setOpen((v) => !v);
          void refresh();
        }}
        data-tooltip="Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="unread-dot">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="popover-title">
            <div>
              <strong>Notifikasi</strong>
              <small>{unread} belum dibaca</small>
            </div>
            <button
              className="text-action"
              onClick={() =>
                void api("/notifications/read-all", { method: "PATCH" }).then(
                  refresh,
                )
              }
            >
              <CheckCheck size={15} /> Baca semua
            </button>
          </div>
          <div className="notice-list">
            {items.length ? (
              items.map((item) => (
                <button
                  className={`notice ${item.isRead ? "" : "notice-unread"}`}
                  key={item.id}
                  onClick={() => void markRead(item)}
                >
                  <strong>{item.judul}</strong>
                  <span>{item.pesan}</span>
                  <small>
                    {new Date(item.createdAt).toLocaleString("id-ID")}
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-mini">Belum ada notifikasi</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

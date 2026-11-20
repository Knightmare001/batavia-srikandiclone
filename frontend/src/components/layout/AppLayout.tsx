import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
export function AppLayout({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-main">
        <Header onMenu={() => setMenuOpen(true)} />
        <main className="content-area">{children || <Outlet />}</main>
      </div>
    </div>
  );
}

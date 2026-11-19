import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { SessionUser } from "../types";
type AuthValue = { user: SessionUser | null; token: string | null; login: (nip: string, password: string) => Promise<void>; logout: () => void; };
export const AuthContext = createContext<AuthValue | null>(null);
function roleFromToken(token: string) {
  try { const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string; sub?: string }; return payload; } catch { return {}; }
}
function currentRole(role?: string) { return role === "kepala_unit" || role === "guru_staf" ? "pegawai" : role || "pegawai"; }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("ear:token"));
  const [user, setUser] = useState<SessionUser | null>(() => { try { const stored = JSON.parse(localStorage.getItem("ear:user") || "null") as SessionUser | null; return stored ? { ...stored, role: currentRole(stored.role) } : null; } catch { return null; } });
  const logout = useCallback(() => { localStorage.removeItem("ear:token"); localStorage.removeItem("ear:user"); setToken(null); setUser(null); }, []);
  useEffect(() => { window.addEventListener("ear:unauthorized", logout); return () => window.removeEventListener("ear:unauthorized", logout); }, [logout]);
  const login = useCallback(async (nip: string, password: string) => {
    const result = await api<{ data: { access_token: string; nip: string; name: string; email: string } }>("/auth/login-user", { method: "POST", body: JSON.stringify({ nip, password }) });
    const profile = result.data, claims = roleFromToken(profile.access_token);
    const nextUser: SessionUser = { id: Number(claims.sub), name: profile.name, nip: profile.nip, email: profile.email, role: currentRole(claims.role) };
    localStorage.setItem("ear:token", profile.access_token); localStorage.setItem("ear:user", JSON.stringify(nextUser));
    setToken(profile.access_token); setUser(nextUser);
  }, []);
  const value = useMemo(() => ({ user, token, login, logout }), [user, token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

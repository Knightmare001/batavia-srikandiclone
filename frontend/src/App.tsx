import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { ArsipGlobalPage } from "./pages/arsip/ArsipGlobalPage";
import { DisposisiPage, LetterPage, TugasPage } from "./pages/modules/ModulePages";
import { AuditPage, DepartmentManagementPage, UserManagementPage } from "./pages/admin/AdminPages";
function RequireAuth() { const { user } = useAuth(); return user ? <Outlet /> : <Navigate to="/login" replace />; }
function Allow({ roles, children }: { roles: string[]; children: React.ReactNode }) { const { user } = useAuth(); return roles.includes(user?.role || "") ? children : <Navigate to="/" replace />; }
export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<RequireAuth />}><Route element={<AppLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="arsip" element={<Allow roles={["admin", "tu", "kepala_sekolah"]}><ArsipGlobalPage /></Allow>} />
    <Route path="surat-masuk" element={<Allow roles={["admin", "tu"]}><LetterPage kind="masuk" /></Allow>} />
    <Route path="surat-keluar" element={<Allow roles={["admin", "tu"]}><LetterPage kind="keluar" /></Allow>} />
    <Route path="disposisi/riwayat" element={<Allow roles={["kepala_sekolah"]}><TugasPage history historyTitle="Riwayat Disposisi" /></Allow>} />
    <Route path="disposisi" element={<Allow roles={["admin", "kepala_sekolah"]}><DisposisiPage /></Allow>} />
    <Route path="tugas" element={<Allow roles={["pegawai"]}><TugasPage /></Allow>} />
    <Route path="tugas/riwayat" element={<Allow roles={["pegawai"]}><TugasPage history /></Allow>} />
    <Route path="admin/users" element={<Allow roles={["admin"]}><UserManagementPage /></Allow>} />
    <Route path="admin/departments" element={<Allow roles={["admin"]}><DepartmentManagementPage /></Allow>} />
    <Route path="admin/audit" element={<Allow roles={["admin"]}><AuditPage /></Allow>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Route></Routes>;
}

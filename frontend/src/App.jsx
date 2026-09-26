import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import RehabilitationsPage from "./pages/RehabilitationsPage.jsx";
import BrigadesPage from "./pages/BrigadesPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProducersPage from "./pages/ProducersPage.jsx";
import DepartementsPage from "./pages/DepartementsPage.jsx";
import AuditSuperficiePage from "./pages/AuditSuperficiePage.jsx";
import FichesAuditPage from "./pages/FichesAuditPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import TerrainPage from "./pages/TerrainPage.jsx";
import MesFichesPage from "./pages/MesFichesPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Route publique ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Routes protégées (tout utilisateur authentifié actif) ── */}
          <Route path="/" element={<PrivateRoute><RehabilitationsPage /></PrivateRoute>} />
          <Route path="/brigades" element={<PrivateRoute><BrigadesPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/producteurs" element={<PrivateRoute><ProducersPage /></PrivateRoute>} />
          <Route path="/departements" element={<PrivateRoute><DepartementsPage /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><AuditSuperficiePage /></PrivateRoute>} />
          <Route path="/fiches-audit" element={<PrivateRoute><FichesAuditPage /></PrivateRoute>} />

          {/* ── Terrain (binômes + chefs) ── */}
          <Route path="/terrain" element={
            <PrivateRoute roles={["admin", "chef_equipe", "binome"]}>
              <TerrainPage />
            </PrivateRoute>
          } />
          <Route path="/mes-fiches" element={
            <PrivateRoute roles={["admin", "chef_equipe", "binome"]}>
              <MesFichesPage />
            </PrivateRoute>
          } />

          {/* ── Administration (admin uniquement) ── */}
          <Route path="/admin" element={
            <PrivateRoute roles={["admin"]}>
              <AdminPage />
            </PrivateRoute>
          } />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

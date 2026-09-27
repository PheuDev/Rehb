import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./context/AuthContext.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { Skeleton } from "./components/ui.jsx";

// ── Chargement différé des pages : allège le bundle initial (Chart.js n'est
//    téléchargé que si l'utilisateur ouvre le Dashboard, etc.). ──
import LoginPage from "./pages/LoginPage.jsx";
const RehabilitationsPage = lazy(() => import("./pages/RehabilitationsPage.jsx"));
const BrigadesPage = lazy(() => import("./pages/BrigadesPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const ProducersPage = lazy(() => import("./pages/ProducersPage.jsx"));
const DepartementsPage = lazy(() => import("./pages/DepartementsPage.jsx"));
const AuditSuperficiePage = lazy(() => import("./pages/AuditSuperficiePage.jsx"));
const FichesAuditPage = lazy(() => import("./pages/FichesAuditPage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const TerrainPage = lazy(() => import("./pages/TerrainPage.jsx"));
const MesFichesPage = lazy(() => import("./pages/MesFichesPage.jsx"));
const PlantationsHorsEchantillonPage = lazy(() => import("./pages/PlantationsHorsEchantillonPage.jsx"));
const MesBrigadesPage = lazy(() => import("./pages/MesBrigadesPage.jsx"));
const MonEquipePage = lazy(() => import("./pages/MonEquipePage.jsx"));

/** Écran d'attente pendant le téléchargement d'un chunk de page. */
function PageFallback() {
  return (
    <div className="min-h-[100dvh] bg-gray-50" role="status" aria-live="polite">
      <span className="sr-only">Chargement de la page…</span>
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
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
          <Route path="/plantations-hors-echantillon" element={
            <PrivateRoute roles={["admin", "chef_equipe", "binome"]}>
              <PlantationsHorsEchantillonPage />
            </PrivateRoute>
          } />
          <Route path="/mes-brigades" element={
            <PrivateRoute roles={["chef_equipe", "binome"]}>
              <MesBrigadesPage />
            </PrivateRoute>
          } />
          <Route path="/mon-equipe" element={
            <PrivateRoute roles={["chef_equipe", "binome"]}>
              <MonEquipePage />
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

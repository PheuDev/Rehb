import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RehabilitationsPage from "./pages/RehabilitationsPage.jsx";
import BrigadesPage from "./pages/BrigadesPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProducersPage from "./pages/ProducersPage.jsx";
import DepartementsPage from "./pages/DepartementsPage.jsx";
import AuditSuperficiePage from "./pages/AuditSuperficiePage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RehabilitationsPage />} />
        <Route path="/brigades" element={<BrigadesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/audit-superficie" element={<AuditSuperficiePage />} />
        <Route path="/producteurs" element={<ProducersPage />} />
        <Route path="/departements" element={<DepartementsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

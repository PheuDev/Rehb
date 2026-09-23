import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RehabilitationsPage from "./pages/RehabilitationsPage.jsx";
import BrigadesPage from "./pages/BrigadesPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RehabilitationsPage />} />
        <Route path="/brigades" element={<BrigadesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

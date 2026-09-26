import { useEffect, useState } from "react";
import { MapPin, RefreshCw, Users } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { EmptyState, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { listTeamBrigades } from "../api/terrain.js";
import { useSidebarState } from "../hooks/useSidebarState.js";

export default function MesBrigadesPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const [brigades, setBrigades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBrigades() {
    if (!user?.team_id) {
      setBrigades([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setBrigades(await listTeamBrigades(user.team_id));
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible de charger les brigades de votre équipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBrigades(); }, [user?.team_id]);

  return (
    <div className="min-h-screen bg-gray-50 pb-8 sm:pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-3 py-3 sm:gap-6 sm:px-6 sm:py-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="min-w-0 flex-1 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Mes brigades</h2>
              <p className="mt-0.5 text-xs text-gray-500 sm:mt-1 sm:text-sm">Les brigades confiées à votre équipe.</p>
            </div>
            <button type="button" aria-label="Actualiser les brigades" title="Actualiser" className="btn-secondary h-10 w-10 shrink-0 p-0 sm:w-auto sm:px-4" onClick={loadBrigades} disabled={loading}>
              <RefreshCw size={15} /><span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading ? <Spinner /> : brigades.length === 0 ? (
            <EmptyState message="Aucune brigade affectée à votre équipe pour le moment." />
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 sm:p-4 sm:text-sm">
                <Users size={16} className="mr-2 inline text-forest-600" />
                {brigades.length} brigade{brigades.length === 1 ? "" : "s"} affectée{brigades.length === 1 ? "" : "s"} à votre équipe
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {brigades.map((brigade) => (
                  <li key={brigade.brigade_id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-100 text-forest-700 sm:h-10 sm:w-10 sm:rounded-xl"><MapPin size={18} /></span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">{brigade.brigade_name}</h3>
                        <p className="mt-1 text-sm text-gray-500">Équipe : {brigade.team_name}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users } from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
import { getBrigades } from "../api/rehabilitations.js";

export default function BrigadesPage() {
  const navigate = useNavigate();

  const [brigades, setBrigades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getBrigades();
        setBrigades(data);
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? brigades.filter((b) => (b.name || "").toLowerCase().includes(keyword))
    : brigades;

  function handleSelectBrigade(name) {
    // Navigue vers la page principale avec un filtre brigade pré-appliqué
    navigate(`/?brigade=${encodeURIComponent(name)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && (
          <Sidebar
            brigades={brigades}
            loading={loading}
            active=""
            onSelect={handleSelectBrigade}
            onClear={() => {}}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1 space-y-6">
          {/* Breadcrumb / retour */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="btn-secondary"
            >
              <ArrowLeft size={16} /> Retour aux fiches
            </button>
          </div>

          {/* Titre de la page */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Liste des brigades</h2>
              <p className="text-sm text-gray-500">
                {loading ? "Chargement…" : `${brigades.length} brigade${brigades.length !== 1 ? "s" : ""} enregistrée${brigades.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="relative max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                className="input pl-9"
                placeholder="Rechercher une brigade…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Grille des brigades */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size={32} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState message="Aucune brigade trouvée." />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((b) => (
                <button
                  key={b.name}
                  onClick={() => handleSelectBrigade(b.name)}
                  className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-forest-400 hover:shadow-md text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700 group-hover:bg-forest-600 group-hover:text-white transition-colors">
                      <Users size={18} />
                    </div>
                    <span className="badge bg-forest-100 text-forest-700 group-hover:bg-forest-600 group-hover:text-white transition-colors">
                      {b.fiches} fiche{b.fiches !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">{b.name}</p>
                  <p className="text-xs text-gray-500 group-hover:text-forest-700 transition-colors">
                    Voir les fiches →
                  </p>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

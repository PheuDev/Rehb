import { useState } from "react";
import { BarChart3, ChevronDown, ChevronLeft, ChevronUp, Home, Menu, Search, Users, X } from "lucide-react";
import { Spinner } from "./ui.jsx";

function NavButton({ active, onClick, icon, label, right = null }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
        active ? "bg-forest-600 text-white" : "text-gray-700 hover:bg-forest-50"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </span>
      {right}
    </button>
  );
}

/**
 * Sidebar de navigation, ouvrable / repliable.
 *
 * Menu : Accueil, Dashboard, Liste des brigades. Le sous-menu "Liste des
 * brigades" se déplie pour afficher les brigades disponibles, regroupées par
 * nom (une même brigade pouvant être enregistrée plusieurs fois avec des clés
 * primaires différentes, chaque nom n'apparaît qu'une seule fois).
 */
export default function Sidebar({ brigades = [], active = "", loading = false, onSelect, onClear, onClose }) {
  const [brigadesOpen, setBrigadesOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("accueil");
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();

  const filtered = keyword
    ? brigades.filter((b) => (b.name || "").toLowerCase().includes(keyword))
    : brigades;

  const toggleBrigades = () => {
    if (brigadesOpen) {
      setBrigadesOpen(false);
      setActiveMenu("accueil");
    } else {
      setBrigadesOpen(true);
      setActiveMenu("brigades");
    }
  };

  const goHome = () => {
    setActiveMenu("accueil");
    setBrigadesOpen(false);
  };

  const goDashboard = () => {
    setActiveMenu("dashboard");
    setBrigadesOpen(false);
  };

  return (
    <aside className="w-full shrink-0 self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:w-72 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Menu size={16} className="text-forest-600" />
          <h2 className="text-sm font-semibold text-gray-900">Navigation</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Replier la sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        <li>
          <NavButton
            active={activeMenu === "accueil"}
            onClick={goHome}
            icon={<Home size={16} />}
            label="Accueil"
          />
        </li>
        <li>
          <NavButton
            active={activeMenu === "dashboard"}
            onClick={goDashboard}
            icon={<BarChart3 size={16} />}
            label="Dashboard"
            right={<span className="badge bg-amber-100 text-amber-800">Bientôt</span>}
          />
        </li>
        <li>
          <NavButton
            active={activeMenu === "brigades"}
            onClick={toggleBrigades}
            icon={<Users size={16} />}
            label="Liste des brigades"
            right={brigadesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          />
        </li>
      </ul>

      {brigadesOpen && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Brigades disponibles
            </h3>
            <span className="badge bg-forest-100 text-forest-700">{brigades.length}</span>
          </div>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="input pl-9"
              placeholder="Rechercher une brigade..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {active && (
            <button onClick={onClear} className="btn-secondary mt-2 w-full">
              <X size={16} /> Toutes les brigades
            </button>
          )}

          <ul className="mt-2 space-y-1">
            {loading && brigades.length === 0 && (
              <li className="flex items-center gap-2 py-2 text-sm text-gray-400">
                <Spinner size={16} /> Chargement...
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="py-2 text-sm text-gray-400">Aucune brigade trouvée.</li>
            )}
            {filtered.map((b) => (
              <li key={b.name}>
                <button
                  onClick={() => onSelect(b.name)}
                  title={`${b.name} — ${b.fiches} fiche(s)`}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    active === b.name
                      ? "bg-forest-600 text-white"
                      : "text-gray-700 hover:bg-forest-50"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className={`badge ${active === b.name ? "bg-white/20 text-white" : "bg-forest-100 text-forest-700"}`}>
                    {b.fiches}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
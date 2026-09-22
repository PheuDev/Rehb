import { useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Spinner } from "./ui.jsx";

/**
 * Sidebar listant les brigades disponibles, regroupées par nom.
 *
 * Une même brigade pouvant être enregistrée plusieurs fois (clés primaires
 * différentes), le backend renvoie des noms uniques : chaque nom n'apparaît
 * qu'une seule fois, accompagné du nombre de fiches associées.
 */
export default function Sidebar({ brigades = [], active = "", loading = false, onSelect, onClear }) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();

  const filtered = keyword
    ? brigades.filter((b) => (b.name || "").toLowerCase().includes(keyword))
    : brigades;

  return (
    <aside className="w-full shrink-0 self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:w-72 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-forest-600" />
        <h2 className="text-sm font-semibold text-gray-900">Brigades disponibles</h2>
        <span className="badge bg-forest-100 text-forest-700">{brigades.length}</span>
      </div>

      <div className="relative mt-3">
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

      <ul className="mt-3 space-y-1">
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
    </aside>
  );
}
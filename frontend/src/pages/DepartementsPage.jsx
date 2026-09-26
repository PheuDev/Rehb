import { useEffect, useState, useMemo } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  MapPin,
  Search,
  TreeDeciduous,
  Users,
  Building2,
  Calendar,
} from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
import { getDepartements, exportDepartementsExcel } from "../api/rehabilitations.js";
import { formatNumber } from "../utils/format.js";
import { useDebounce } from "../hooks/useDebounce.js";

const PAGE_SIZES = [10, 25, 50];

// ─── Tri ──────────────────────────────────────────────────────────────────────
function useSortedData(data, sortKey, sortDir) {
  return useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp =
        typeof va === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);
}

// ─── En-tête de colonne triable ───────────────────────────────────────────────
function Th({ label, field, sortKey, sortDir, onSort, className = "" }) {
  const active = sortKey === field;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer select-none hover:text-gray-800 ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon size={13} className={active ? "text-forest-600" : "text-gray-400"} />
      </span>
    </th>
  );
}

// ─── Badge liste compacte ─────────────────────────────────────────────────────
function BadgeList({ items, max = 3, accent = "bg-amber-100 text-amber-700" }) {
  if (!items || items.length === 0)
    return <span className="text-xs text-gray-400">—</span>;
  const shown = items.slice(0, max);
  const rest = items.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((item) => (
        <span key={item} className={`badge text-xs ${accent}`}>
          {item}
        </span>
      ))}
      {rest > 0 && (
        <span className="badge bg-gray-100 text-gray-500 text-xs">+{rest}</span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DepartementsPage() {
  const navigate = useNavigate();

  const [departements, setDepartements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useSidebarState();

  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 350);

  const [sortKey, setSortKey] = useState("departement");
  const [sortDir, setSortDir] = useState("asc");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getDepartements(debouncedQ ? { q: debouncedQ } : undefined);
        setDepartements(data.items);
        setTotal(data.total);
        setPage(1);
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [debouncedQ]);

  function handleSort(field) {
    if (sortKey === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const sorted = useSortedData(departements, sortKey, sortDir);
  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated = sorted.slice((page - 1) * limit, page * limit);

  function handleSelectDepartement(name) {
    navigate(`/?departement=${encodeURIComponent(name)}`);
  }

  // Totaux globaux
  const totalFiches = departements.reduce((s, d) => s + d.fiches, 0);
  const totalSuperficie = departements.reduce((s, d) => s + d.superficie_totale, 0);
  const totalCommunes = departements.reduce((s, d) => s + d.nb_communes, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 space-y-6">
          {/* Breadcrumb */}
          <button onClick={() => navigate("/")} className="btn-secondary">
            <ArrowLeft size={16} /> Retour aux fiches
          </button>

          {/* Titre + bouton export */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MapPin size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Liste des départements</h2>
                <p className="text-sm text-gray-500">
                  {loading
                    ? "Chargement…"
                    : `${total} département${total !== 1 ? "s" : ""} enregistré${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => exportDepartementsExcel(debouncedQ ? { q: debouncedQ } : undefined)}
              disabled={loading || departements.length === 0}
              className="btn-primary disabled:opacity-40"
            >
              <Download size={15} /> Exporter en Excel
            </button>
          </div>

          {/* KPI rapides */}
          {!loading && departements.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Départements</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(total, 0)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
                  <TreeDeciduous size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Superficie (ha)</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalSuperficie)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fiches totales</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalFiches, 0)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Communes</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalCommunes, 0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Barre de recherche + sélecteur de taille */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative flex-1 min-w-48">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={15}
              />
              <input
                className="input pl-9"
                placeholder="Rechercher un département…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Afficher</span>
              <select
                className="input w-20"
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span>par page</span>
            </div>
          </div>

          {/* Tableau */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size={32} />
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState message="Aucun département trouvé." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <Th label="Département" field="departement" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                        <Th label="Fiches" field="fiches" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Superficie (ha)" field="superficie_totale" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Communes" field="nb_communes" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Arrondissements" field="nb_arrondissements" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Villages" field="nb_villages" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Communes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Brigades</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Années</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginated.map((d, idx) => (
                        <tr
                          key={`${d.departement}-${idx}`}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Nom département */}
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                <MapPin size={14} />
                              </div>
                              <span>{d.departement}</span>
                            </div>
                          </td>

                          {/* Fiches */}
                          <td className="px-4 py-3">
                            <span className="badge bg-forest-100 text-forest-700">
                              {d.fiches}
                            </span>
                          </td>

                          {/* Superficie */}
                          <td className="px-4 py-3 font-medium text-gray-700">
                            {formatNumber(d.superficie_totale)} ha
                          </td>

                          {/* Nb communes */}
                          <td className="px-4 py-3 text-gray-600 text-center">
                            {d.nb_communes}
                          </td>

                          {/* Nb arrondissements */}
                          <td className="px-4 py-3 text-gray-600 text-center">
                            {d.nb_arrondissements}
                          </td>

                          {/* Nb villages */}
                          <td className="px-4 py-3 text-gray-600 text-center">
                            {d.nb_villages}
                          </td>

                          {/* Communes badges */}
                          <td className="px-4 py-3">
                            <BadgeList items={d.communes} max={2} accent="bg-amber-100 text-amber-700" />
                          </td>

                          {/* Brigades badges */}
                          <td className="px-4 py-3">
                            <BadgeList items={d.brigades} max={2} accent="bg-forest-100 text-forest-700" />
                          </td>

                          {/* Années badges */}
                          <td className="px-4 py-3">
                            <BadgeList
                              items={d.annees.map(String)}
                              max={3}
                              accent="bg-sky-100 text-sky-700"
                            />
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleSelectDepartement(d.departement)}
                              className="text-xs text-forest-600 hover:underline whitespace-nowrap"
                              title="Voir les fiches de ce département"
                            >
                              Voir les fiches →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
                  <span>
                    {sorted.length === 0
                      ? "Aucun résultat"
                      : `${(page - 1) * limit + 1}–${Math.min(page * limit, sorted.length)} sur ${sorted.length}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      ← Précédent
                    </button>
                    <span className="px-3 text-xs">{page} / {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      Suivant →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

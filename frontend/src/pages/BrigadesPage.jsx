import { useEffect, useState, useMemo } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  MapPin,
  Phone,
  Search,
  TreeDeciduous,
  Users,
} from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
import { getBrigadesDetail, exportBrigadesExcel } from "../api/rehabilitations.js";
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
function BadgeList({ items, max = 2, accent = "bg-amber-100 text-amber-700" }) {
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
export default function BrigadesPage() {
  const navigate = useNavigate();

  const [brigades, setBrigades] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useSidebarState();

  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 350);

  const [sortKey, setSortKey] = useState("brigade_name");
  const [sortDir, setSortDir] = useState("asc");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getBrigadesDetail(debouncedQ ? { q: debouncedQ } : undefined);
        setBrigades(data.items);
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

  const sorted = useSortedData(brigades, sortKey, sortDir);
  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated = sorted.slice((page - 1) * limit, page * limit);

  // Totaux globaux
  const totalFiches     = brigades.reduce((s, b) => s + b.fiches, 0);
  const totalSuperficie = brigades.reduce((s, b) => s + b.superficie_totale, 0);
  const totalCommunes   = brigades.reduce((s, b) => s + b.nb_communes, 0);

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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
                <Users size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Liste des brigades</h2>
                <p className="text-sm text-gray-500">
                  {loading
                    ? "Chargement…"
                    : `${total} brigade${total !== 1 ? "s" : ""} enregistrée${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => exportBrigadesExcel(debouncedQ ? { q: debouncedQ } : undefined)}
              disabled={loading || brigades.length === 0}
              className="btn-primary disabled:opacity-40"
            >
              <Download size={15} /> Exporter en Excel
            </button>
          </div>

          {/* KPI rapides */}
          {!loading && brigades.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Brigades</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(total, 0)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <TreeDeciduous size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Superficie (ha)</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalSuperficie)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fiches totales</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalFiches, 0)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Communes couvertes</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(totalCommunes, 0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Barre recherche + sélecteur de taille */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative flex-1 min-w-48">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={15}
              />
              <input
                className="input pl-9"
                placeholder="Rechercher par nom, chef de brigade, commune, département…"
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
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
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
              <EmptyState message="Aucune brigade trouvée." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <Th label="Nom de la brigade"  field="brigade_name"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[180px]" />
                        <Th label="Chef de brigade"    field="manager_name"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Téléphone</th>
                        <Th label="Fiches"             field="fiches"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Superficie (ha)"    field="superficie_totale" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Communes"           field="nb_communes"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Villages"           field="nb_villages"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Communes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Départements</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Années actives</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginated.map((b, idx) => (
                        <tr
                          key={`${b.brigade_name}-${idx}`}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Nom */}
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-700">
                                <Users size={14} />
                              </div>
                              <span className="truncate max-w-[160px]" title={b.brigade_name}>
                                {b.brigade_name}
                              </span>
                            </div>
                          </td>

                          {/* Chef */}
                          <td className="px-4 py-3 text-gray-700">
                            {b.manager_name ?? <span className="text-gray-400">—</span>}
                          </td>

                          {/* Téléphone */}
                          <td className="px-4 py-3 text-gray-600">
                            {b.manager_phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone size={13} className="text-gray-400" />
                                {b.manager_phone}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Fiches */}
                          <td className="px-4 py-3">
                            <span className="badge bg-forest-100 text-forest-700">{b.fiches}</span>
                          </td>

                          {/* Superficie */}
                          <td className="px-4 py-3 font-medium text-gray-700">
                            {formatNumber(b.superficie_totale)} ha
                          </td>

                          {/* Nb communes */}
                          <td className="px-4 py-3 text-center text-gray-600">{b.nb_communes}</td>

                          {/* Nb villages */}
                          <td className="px-4 py-3 text-center text-gray-600">{b.nb_villages}</td>

                          {/* Communes badges */}
                          <td className="px-4 py-3">
                            <BadgeList items={b.communes} max={2} accent="bg-sky-100 text-sky-700" />
                          </td>

                          {/* Départements badges */}
                          <td className="px-4 py-3">
                            <BadgeList items={b.departements} max={2} accent="bg-amber-100 text-amber-700" />
                          </td>

                          {/* Années badges */}
                          <td className="px-4 py-3">
                            <BadgeList
                              items={b.annees.map(String)}
                              max={3}
                              accent="bg-violet-100 text-violet-700"
                            />
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate(`/?brigade=${encodeURIComponent(b.brigade_name)}`)}
                              className="text-xs text-forest-600 hover:underline whitespace-nowrap"
                              title="Voir les fiches de cette brigade"
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

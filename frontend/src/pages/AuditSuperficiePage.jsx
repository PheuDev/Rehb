import { useState, useMemo } from "react";
import {
  ArrowLeft, BarChart3, ChevronDown, ChevronUp, ChevronsUpDown,
  ClipboardCheck, Download, RefreshCw, Search, TreeDeciduous, Users, Percent, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner } from "../components/ui.jsx";
import { getAuditSample, exportAuditExcel } from "../api/rehabilitations.js";
import { formatNumber } from "../utils/format.js";

function Th({ label, field, sortKey, sortDir, onSort, className = "" }) {
  const active = sortKey === field;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th onClick={() => onSort(field)} className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 ${className}`}>
      <span className="inline-flex items-center gap-1">{label}<Icon size={12} className={active ? "text-violet-600" : "text-gray-400"} /></span>
    </th>
  );
}

function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon size={20} /></div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold text-gray-900 leading-tight">{value}</p></div>
    </div>
  );
}

const CLASS_COLORS = {
  "S < 1 ha": "bg-sky-100 text-sky-700", "1 ≤ S < 2 ha": "bg-emerald-100 text-emerald-700",
  "2 ≤ S < 3 ha": "bg-teal-100 text-teal-700", "3 ≤ S < 5 ha": "bg-forest-100 text-forest-700",
  "5 ≤ S < 10 ha": "bg-amber-100 text-amber-700", "10 ≤ S < 20 ha": "bg-orange-100 text-orange-700",
  "20 ≤ S ≤ 30 ha": "bg-red-100 text-red-700", "S > 30 ha": "bg-violet-100 text-violet-700",
};
function ClassBadge({ classe }) {
  return <span className={`badge text-xs ${CLASS_COLORS[classe] ?? "bg-gray-100 text-gray-600"}`}>{classe}</span>;
}

const CLASS_ORDER = ["S < 1 ha","1 ≤ S < 2 ha","2 ≤ S < 3 ha","3 ≤ S < 5 ha","5 ≤ S < 10 ha","10 ≤ S < 20 ha","20 ≤ S ≤ 30 ha","S > 30 ha"];

export default function AuditSuperficiePage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filtre brigade
  const [brigadeSearch, setBrigadeSearch] = useState("");
  const [selectedBrigades, setSelectedBrigades] = useState([]);

  // Tri
  const [sortKey, setSortKey] = useState("brigade_name");
  const [sortDir, setSortDir] = useState("asc");

  async function handleGenerate() {
    setLoading(true); setError(null);
    try {
      const data = await getAuditSample();
      setResult(data);
      setSelectedBrigades([]);
    } catch {
      setError("Erreur lors de la génération de l'échantillon. Vérifiez que des fiches avec superficie sont présentes.");
    } finally { setLoading(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportAuditExcel(selectedBrigades.length > 0 ? selectedBrigades : null);
    } catch {} finally { setExporting(false); }
  }

  function handleSort(field) {
    if (sortKey === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(field); setSortDir("asc"); }
  }

  const allBrigades = useMemo(() => {
    if (!result) return [];
    const s = new Set(result.fiches.map((f) => f.brigade_name).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fr"));
  }, [result]);

  const filteredBrigadesList = useMemo(() => {
    const kw = brigadeSearch.trim().toLowerCase();
    return kw ? allBrigades.filter((b) => b.toLowerCase().includes(kw)) : allBrigades;
  }, [allBrigades, brigadeSearch]);

  function toggleBrigade(name) {
    setSelectedBrigades((prev) => prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]);
  }

  const activeBrigades = selectedBrigades.length === 0 ? allBrigades : selectedBrigades;
  const hasFilter = selectedBrigades.length > 0;

  const filteredFiches = useMemo(() => {
    if (!result) return [];
    return result.fiches.filter((f) => {
      const b = f.brigade_name ?? "— Sans brigade —";
      return activeBrigades.includes(b) || activeBrigades.includes(f.brigade_name);
    });
  }, [result, activeBrigades]);

  const sortedFiches = useMemo(() => {
    return [...filteredFiches].sort((a, b) => {
      const va = a[sortKey] ?? ""; const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "fr", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredFiches, sortKey, sortDir]);

  const syntheseFiltered = useMemo(() => {
    const map = {};
    for (const f of filteredFiches) {
      const cls = f.audit_classe ?? "—";
      if (!map[cls]) map[cls] = { classe: cls, fiches: 0, superficie: 0, brigades: new Set() };
      map[cls].fiches++;
      map[cls].superficie += f.superficie_rehabilitee ?? 0;
      if (f.brigade_name) map[cls].brigades.add(f.brigade_name);
    }
    return CLASS_ORDER.map((cls) => map[cls] ? { ...map[cls], nb_brigades: map[cls].brigades.size } : null).filter(Boolean);
  }, [filteredFiches]);

  const supEch = filteredFiches.reduce((s, f) => s + (f.superficie_rehabilitee ?? 0), 0);
  const pctEch = result && result.superficie_totale > 0 ? Math.round(supEch / result.superficie_totale * 1000) / 10 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 space-y-6">
          <button onClick={() => navigate("/")} className="btn-secondary"><ArrowLeft size={16} /> Retour aux fiches</button>

          {/* Titre + actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ClipboardCheck size={22} /></div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Superficie à Auditer</h2>
                <p className="text-sm text-gray-500">25% superficie globale · 20% fiches par brigade · aléatoire</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result && (
                <>
                  <button onClick={handleGenerate} disabled={loading} className="btn-secondary">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Regénérer
                  </button>
                  <button onClick={handleExport} disabled={exporting} className="btn-primary">
                    {exporting ? <Spinner size={15} /> : <Download size={15} />}
                    Exporter Excel{hasFilter ? ` (${selectedBrigades.length} brigade${selectedBrigades.length > 1 ? "s" : ""})` : ""}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* État initial */}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-white py-24 gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"><ClipboardCheck size={32} /></div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">Aucun échantillon généré</p>
                <p className="mt-1 text-sm text-gray-500 max-w-sm">Générez un plan d'audit aléatoire : 20% des fiches par brigade, 25% de la superficie totale.</p>
              </div>
              <button onClick={handleGenerate} className="btn-primary px-8 py-3 text-base"><ClipboardCheck size={18} /> Générer l'échantillon</button>
            </div>
          )}

          {loading && <div className="flex items-center justify-center py-32"><Spinner size={36} /></div>}

          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
          )}

          {result && !loading && (
            <>
              {/* KPI */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard icon={ClipboardCheck} label={hasFilter ? "Fiches (filtrées)" : "Fiches sélectionnées"} value={formatNumber(sortedFiches.length, 0)} accent="bg-violet-100 text-violet-700" />
                <KpiCard icon={TreeDeciduous} label="Superficie échantillon (ha)" value={formatNumber(supEch)} accent="bg-forest-100 text-forest-700" />
                <KpiCard icon={Percent} label="Couverture superficie" value={`${pctEch} %`} accent={pctEch >= 25 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} />
                <KpiCard icon={BarChart3} label="Classes couvertes" value={`${syntheseFiltered.length} / 8`} accent="bg-sky-100 text-sky-700" />
              </div>

              {/* Filtre brigades */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-forest-600" />
                    <p className="text-sm font-semibold text-gray-700">
                      Filtrer par brigade
                      {hasFilter && <span className="ml-2 badge bg-violet-100 text-violet-700">{selectedBrigades.length} sélectionnée{selectedBrigades.length > 1 ? "s" : ""}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedBrigades([])} className="text-forest-600 hover:underline">Toutes</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => setSelectedBrigades([...allBrigades])} className="text-gray-500 hover:underline">Aucune</button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input className="input pl-9 text-sm" placeholder="Rechercher une brigade…" value={brigadeSearch} onChange={(e) => setBrigadeSearch(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {filteredBrigadesList.map((name) => {
                    const active = selectedBrigades.length === 0 || selectedBrigades.includes(name);
                    return (
                      <button key={name} onClick={() => toggleBrigade(name)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                          active ? "bg-forest-600 text-white border-forest-600" : "bg-white text-gray-500 border-gray-200 hover:border-forest-400"
                        }`}
                      >
                        {name}
                        {active && selectedBrigades.length > 0 && <X size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Synthèse par classe */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
                  <BarChart3 size={16} className="text-violet-600" />
                  <p className="text-sm font-semibold text-gray-700">Synthèse par classe{hasFilter ? " — brigades filtrées" : ""}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Classe</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Fiches</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Superficie (ha)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Brigades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {syntheseFiltered.map((cls) => (
                        <tr key={cls.classe} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><ClassBadge classe={cls.classe} /></td>
                          <td className="px-4 py-3 text-center font-medium">{cls.fiches}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{formatNumber(cls.superficie)} ha</td>
                          <td className="px-4 py-3 text-center"><span className="badge bg-forest-100 text-forest-700"><Users size={11} className="mr-1 inline" />{cls.nb_brigades}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tableau des fiches */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-violet-600" />
                  <p className="text-sm font-semibold text-gray-700">
                    Fiches à inspecter
                    <span className="ml-2 badge bg-violet-100 text-violet-700">{sortedFiches.length}</span>
                    {hasFilter && <span className="ml-1 text-xs text-gray-400">/ {result.total_fiches} total</span>}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <Th label="Brigade" field="brigade_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Classe" field="audit_classe" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="N° PDA" field="pda_number" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Département" field="departement" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Commune" field="commune" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Village" field="village" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Superficie (ha)" field="superficie_rehabilitee" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Année" field="annee_rehabilitation" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedFiches.map((f) => (
                        <tr key={f.id} className="hover:bg-violet-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{f.brigade_name ?? <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3"><ClassBadge classe={f.audit_classe ?? "—"} /></td>
                          <td className="px-4 py-3 text-gray-700">{f.pda_number ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{f.departement ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{f.commune ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{f.village ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{f.superficie_rehabilitee != null ? `${formatNumber(f.superficie_rehabilitee)} ha` : "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{f.annee_rehabilitation ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Échantillonnage : ≥ 20% des fiches de chaque brigade, complété jusqu'à 25% de la superficie totale ({formatNumber(result.superficie_totale)} ha). Regénérer produit un tirage différent.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
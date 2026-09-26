import { useState, useMemo } from "react";
import {
  ArrowLeft, BarChart3, ChevronDown, ChevronUp, ChevronsUpDown,
  ClipboardCheck, Download, RefreshCw, Save, Search, TreeDeciduous, Percent, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner } from "../components/ui.jsx";
import { getAuditSample, exportAuditExcel, saveAuditSuggestion } from "../api/rehabilitations.js";
import { formatNumber } from "../utils/format.js";

// ─── Tri ──────────────────────────────────────────────────────────────────────
function Th({ label, field, sortKey, sortDir, onSort, className = "" }) {
  const active = sortKey === field;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-400 hover:text-gray-700 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon size={11} className={active ? "text-violet-500" : "opacity-40"} />
      </span>
    </th>
  );
}

// ─── Badge classe ─────────────────────────────────────────────────────────────
const CLASS_COLORS = {
  "S < 1 ha":        "bg-sky-50 text-sky-600 border border-sky-200",
  "1 ≤ S < 2 ha":   "bg-emerald-50 text-emerald-600 border border-emerald-200",
  "2 ≤ S < 3 ha":   "bg-teal-50 text-teal-600 border border-teal-200",
  "3 ≤ S < 5 ha":   "bg-forest-50 text-forest-600 border border-forest-200",
  "5 ≤ S < 10 ha":  "bg-amber-50 text-amber-600 border border-amber-200",
  "10 ≤ S < 20 ha": "bg-orange-50 text-orange-600 border border-orange-200",
  "20 ≤ S ≤ 30 ha": "bg-red-50 text-red-600 border border-red-200",
  "S > 30 ha":       "bg-violet-50 text-violet-600 border border-violet-200",
};
function ClassBadge({ classe }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${CLASS_COLORS[classe] ?? "bg-gray-100 text-gray-500"}`}>
      {classe}
    </span>
  );
}

const CLASS_ORDER = [
  "S < 1 ha","1 ≤ S < 2 ha","2 ≤ S < 3 ha","3 ≤ S < 5 ha",
  "5 ≤ S < 10 ha","10 ≤ S < 20 ha","20 ≤ S ≤ 30 ha","S > 30 ha",
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuditSuperficiePage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveOpen, setSaveOpen]       = useState(false);
  const [saveTitle, setSaveTitle]     = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveDispatch, setSaveDispatch] = useState(null);
  const [error, setError]             = useState(null);

  const [brigadeSearch, setBrigadeSearch]       = useState("");
  const [selectedBrigades, setSelectedBrigades] = useState([]);
  const [sortKey, setSortKey]                   = useState("brigade_name");
  const [sortDir, setSortDir]                   = useState("asc");

  // Suggestion personnalisée (pourcentages au lieu des défauts 25 % / 20 %)
  const [customMode, setCustomMode] = useState(false);
  const [pctGlobal, setPctGlobal]   = useState(25);
  const [pctBrigade, setPctBrigade] = useState(20);

  const auditParams = () => customMode
    ? { pourcentage_global: pctGlobal, pourcentage_brigade: pctBrigade }
    : {};

  async function handleGenerate() {
    setLoading(true); setError(null);
    try {
      const data = await getAuditSample(auditParams());
      setResult(data);
      setSelectedBrigades([]);
    } catch {
      setError("Impossible de générer l'échantillon. Vérifiez que des fiches avec superficie existent.");
    } finally { setLoading(false); }
  }

  async function handleExport() {
    setExporting(true);
    try { await exportAuditExcel(selectedBrigades.length > 0 ? selectedBrigades : null, auditParams()); }
    catch {} finally { setExporting(false); }
  }

  async function handleSaveSuggestion(e) {
    e.preventDefault();
    if (!result) return;
    setSaving(true);
    setError(null);
    setSaveSuccess("");
    try {
      const saved = await saveAuditSuggestion({
        title: saveTitle.trim() || undefined,
        brigade_filter: hasFilter ? selectedBrigades : null,
        snapshot: result,
      });
      setSaveOpen(false);
      setSaveTitle("");
      setSaveDispatch(saved.dispatch || null);
      const dispatched = saved.dispatch?.fiches_dispatched ?? 0;
      setSaveSuccess(
        dispatched > 0
          ? `Suggestion enregistrée — ${dispatched} fiche(s) envoyée(s) aux équipes concernées (Mes plantations).`
          : "Suggestion enregistrée. Aucune fiche distribuée : vérifiez les affectations brigade → équipe et les binômes.",
      );
    } catch {
      setError("Impossible d'enregistrer la suggestion.");
    } finally {
      setSaving(false);
    }
  }

  function handleSort(field) {
    if (sortKey === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(field); setSortDir("asc"); }
  }

  const allBrigades = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.fiches.map((f) => f.brigade_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
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
    return result.fiches.filter((f) => activeBrigades.includes(f.brigade_name ?? "— Sans brigade —") || activeBrigades.includes(f.brigade_name));
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
  const pctEch = result?.superficie_totale > 0 ? Math.round(supEch / result.superficie_totale * 1000) / 10 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 space-y-5">

          {/* Breadcrumb + titre + actions — tout sur une ligne */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors" title="Retour">
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-violet-500" />
                <h2 className="text-lg font-semibold text-gray-900">Superficie à Auditer</h2>
                <span className="hidden sm:inline text-xs text-gray-400">
                  — {customMode ? `${pctGlobal}% global · ${pctBrigade}% fiches/brigade` : "25% global · 20% fiches/brigade"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!result && !loading && (
                <button onClick={handleGenerate} className="btn-primary">
                  <ClipboardCheck size={15} /> Générer l'échantillon
                </button>
              )}
              {result && (
                <>
                  <button onClick={handleGenerate} disabled={loading} className="btn-secondary text-xs px-3 py-1.5">
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Regénérer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSaveOpen(true); setSaveSuccess(""); }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <Save size={13} /> Sauvegarder la suggestion
                  </button>
                  <button onClick={handleExport} disabled={exporting} className="btn-primary text-xs px-3 py-1.5">
                    {exporting ? <Spinner size={13} /> : <Download size={13} />}
                    Excel{hasFilter ? ` (${selectedBrigades.length})` : ""}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mode de suggestion : par défaut / personnalisé */}
          {(!result || customMode) && (
            <div className={`rounded-xl border p-4 space-y-3 ${customMode ? "border-violet-200 bg-violet-50/60" : "border-gray-200 bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {customMode ? "Ma suggestion personnalisée" : "Suggestion par défaut"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {customMode ? (
                      <>
                        L'échantillon couvrira <strong>{pctGlobal} %</strong> de la superficie totale
                        et au moins <strong>{pctBrigade} %</strong> du nombre de plantations de chaque brigade.
                      </>
                    ) : (
                      <>
                        Par défaut : <strong>25 %</strong> de la superficie totale ·
                        au moins <strong>20 %</strong> des plantations de chaque brigade.
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-1.5"
                  onClick={() => setCustomMode((v) => !v)}
                >
                  {customMode ? "Revenir à la suggestion par défaut" : "Personnaliser ma suggestion"}
                </button>
              </div>

              {customMode && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-gray-600">
                      % de la superficie totale couverte par l'échantillon
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1} max={100} step={0.5}
                        className="input"
                        value={pctGlobal}
                        onChange={(e) => setPctGlobal(Number(e.target.value) || 1)}
                      />
                      <span className="text-sm text-gray-400">% (25 % par défaut)</span>
                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-gray-600">
                      % du nombre de plantations par brigade à prélever
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1} max={100} step={0.5}
                        className="input"
                        value={pctBrigade}
                        onChange={(e) => setPctBrigade(Number(e.target.value) || 1)}
                      />
                      <span className="text-sm text-gray-400">% (20 % par défaut)</span>
                    </div>
                  </label>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Une plantation ne peut être suggérée qu'une seule fois : une même fiche ne
                peut pas être re-citée dans la même séquence de suggestion.
              </p>
            </div>
          )}

          {/* Erreur */}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          {saveSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{saveSuccess}</span>
                <button type="button" className="text-emerald-900 underline text-xs" onClick={() => navigate("/fiches-audit")}>
                  Ouvrir Fiches d'audit
                </button>
              </div>
              {saveDispatch?.teams?.length > 0 && (
                <ul className="text-xs text-emerald-700/90 list-disc pl-4">
                  {saveDispatch.teams.map((t) => (
                    <li key={t.team_id}>
                      {t.team_name} — {t.fiches} fiche(s) · {t.binomes} binôme(s)
                    </li>
                  ))}
                </ul>
              )}
              {saveDispatch?.warnings?.length > 0 && (
                <ul className="text-xs text-amber-800 list-disc pl-4 border-t border-emerald-200/80 pt-2">
                  {saveDispatch.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {saveDispatch.warnings.length > 5 && (
                    <li>… et {saveDispatch.warnings.length - 5} autre(s) alerte(s)</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Chargement */}
          {loading && <div className="flex items-center justify-center py-32"><Spinner size={32} /></div>}

          {/* État vide */}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-white py-20 gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-50 text-violet-400">
                <ClipboardCheck size={28} />
              </div>
              <div>
                <p className="font-medium text-gray-700">Aucun échantillon généré</p>
                <p className="mt-0.5 text-sm text-gray-400 max-w-xs">Cliquez sur "Générer l'échantillon" pour lancer le tirage aléatoire.</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              {/* ── Ligne 1 : KPI compactes ── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: ClipboardCheck, label: hasFilter ? "Fiches (filtrées)" : "Fiches sélectionnées", value: formatNumber(sortedFiches.length, 0), accent: "text-violet-500" },
                  { icon: TreeDeciduous,  label: "Superficie (ha)",   value: formatNumber(supEch),        accent: "text-forest-600" },
                  { icon: Percent,        label: "Couverture",         value: `${pctEch} %`,               accent: pctEch >= (customMode ? pctGlobal : 25) ? "text-emerald-600" : "text-amber-500" },
                  { icon: BarChart3,      label: "Classes",            value: `${syntheseFiltered.length} / 8`, accent: "text-sky-500" },
                ].map(({ icon: Icon, label, value, accent }) => (
                  <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                    <Icon size={18} className={`shrink-0 ${accent}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 truncate">{label}</p>
                      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Ligne 2 : Filtre brigade (gauche) + Synthèse par classe (droite) ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

                {/* Filtre brigade — plus compact */}
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Brigades
                      {hasFilter && <span className="ml-1.5 badge bg-violet-100 text-violet-600 normal-case font-normal">{selectedBrigades.length}</span>}
                    </p>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <button onClick={() => setSelectedBrigades([])} className="hover:text-forest-600 transition-colors">Toutes</button>
                      <span>·</span>
                      <button onClick={() => setSelectedBrigades([...allBrigades])} className="hover:text-gray-700 transition-colors">Aucune</button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={13} />
                    <input
                      className="input pl-8 text-xs py-1.5"
                      placeholder="Rechercher…"
                      value={brigadeSearch}
                      onChange={(e) => setBrigadeSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                    {filteredBrigadesList.map((name) => {
                      const active = selectedBrigades.length === 0 || selectedBrigades.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleBrigade(name)}
                          className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs border transition-colors ${
                            active
                              ? "bg-forest-600 text-white border-forest-600"
                              : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {name}
                          {active && selectedBrigades.length > 0 && <X size={9} className="ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Synthèse par classe */}
                <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <p className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100">
                    Synthèse par classe{hasFilter ? " — filtrées" : ""}
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2 text-left font-medium text-gray-400">Classe</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-400">Fiches</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-400">Superficie</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-400">Brigades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {syntheseFiltered.map((cls) => (
                        <tr key={cls.classe} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2"><ClassBadge classe={cls.classe} /></td>
                          <td className="px-3 py-2 text-center font-medium text-gray-700">{cls.fiches}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{formatNumber(cls.superficie)} ha</td>
                          <td className="px-3 py-2 text-center text-gray-500">{cls.nb_brigades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Tableau des fiches ── */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Fiches à inspecter
                  </p>
                  <span className="badge bg-violet-100 text-violet-600 text-xs">{sortedFiches.length}</span>
                  {hasFilter && <span className="text-xs text-gray-400">/ {result.total_fiches} total</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <Th label="Brigade"       field="brigade_name"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Classe"         field="audit_classe"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="N° PDA"         field="pda_number"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Département"    field="departement"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Commune"        field="commune"               sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Village"        field="village"               sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Superficie"     field="superficie_rehabilitee" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <Th label="Année"          field="annee_rehabilitation"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedFiches.map((f) => (
                        <tr key={f.id} className="hover:bg-violet-50/40 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">{f.brigade_name ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5"><ClassBadge classe={f.audit_classe ?? "—"} /></td>
                          <td className="px-3 py-2.5 text-gray-600 text-sm">{f.pda_number ?? "—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-sm">{f.departement ?? "—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-sm">{f.commune ?? "—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-sm">{f.village ?? "—"}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-700 text-sm">
                            {f.superficie_rehabilitee != null ? `${formatNumber(f.superficie_rehabilitee)} ha` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-sm">{f.annee_rehabilitation ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-300 text-right">
                Superficie totale système : {formatNumber(result.superficie_totale)} ha · Regénérer produit un tirage différent.
              </p>
            </>
          )}
        </main>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setSaveOpen(false)}>
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveSuggestion}
          >
            <h3 className="font-semibold text-gray-900">Sauvegarder la suggestion</h3>
            <p className="text-sm text-gray-500">
              L'échantillon actuel ({result?.fiches?.length ?? 0} fiches) sera enregistré pour consultation et export ultérieur.
            </p>
            <div>
              <label className="label" htmlFor="save-audit-title">Titre (optionnel)</label>
              <input
                id="save-audit-title"
                className="input"
                placeholder="Ex. Campagne audit T1 2026"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setSaveOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner size={14} /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

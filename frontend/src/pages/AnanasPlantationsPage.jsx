import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "../hooks/useDebounce.js";
import { useAuth } from "../context/AuthContext.jsx";
import AnanasLayout from "../components/AnanasLayout.jsx";
import { AlertCircle, Download, FileSpreadsheet, Pencil, Search, Trash2, UploadCloud, X } from "lucide-react";
import {
  deleteAnanasPlantation,
  downloadAnanasTemplate,
  exportAnanasPlantations,
  getAnanasFilters,
  getAnanasStats,
  importAnanasExcel,
  listAnanasPlantations,
  updateAnanasPlantation,
} from "../api/ananas.js";

const FIELDS = [
  ["numero", "N", "number"],
  ["nom_prenoms", "Nom et prénoms"],
  ["sexe", "Sexe"],
  ["commune", "Commune"],
  ["arrondissement", "Arrondissement"],
  ["village_hameau", "Village/Hameau"],
  ["coord_x", "Coordonnées géographiques X", "number"],
  ["coord_y", "Coordonnées géographiques Y", "number"],
  ["superficie_declaree", "Superficie déclarée (ha)", "number"],
  ["superficie_trackee", "Superficie trackée (ha)", "number"],
  ["type_friche", "Type de friche"],
  ["type_espece_vegetale", "Type d’espèce végétale"],
  ["type_sol", "Type de sol"],
  ["precedents_culturaux", "Précédents culturaux"],
  ["decision_equipe_validation", "Décision de l’équipe de validation"],
  ["decision_atda7", "Décision ATDA7"],
  ["superficie_confirmee", "Sup attribuée / confirmée (ha)", "number"],
];

const emptyFilters = { q: "", commune: "", arrondissement: "", classe: "" };
const display = (value) => value == null || value === "" ? "—" : value;
const number = (value) => value == null ? "—" : Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 });

function Stat({ label, value, detail }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>{detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}</div>;
}

function ImportDialog({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit() {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const imported = await importAnanasExcel(file);
      setResult(imported);
      if (imported.importees > 0) onImported();
    } catch (err) {
      setError(err?.response?.data?.detail || "Le fichier n’a pas pu être importé.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ananas-import-title" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 id="ananas-import-title" className="text-lg font-semibold text-gray-900">Importer les plantations Ananas</h2><p className="mt-1 text-sm text-gray-500">Le fichier doit respecter exactement les en-têtes et les types du modèle.</p></div><button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div>
        <button type="button" onClick={downloadAnanasTemplate} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:underline"><FileSpreadsheet size={16} /> Télécharger le modèle Excel Ananas</button>
        <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-5 text-center hover:border-amber-400"><UploadCloud size={26} className="text-gray-500" /><span className="text-sm text-gray-600">{file?.name || "Choisir un fichier .xlsx ou .xlsm"}</span><input type="file" accept=".xlsx,.xlsm" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {result && <div className="mt-3 rounded-lg border border-forest-200 bg-forest-50 p-3 text-sm text-forest-800"><p>{result.importees} ligne(s) importée(s) sur {result.total}.</p>{result.erreurs?.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-medium">{result.erreurs.length} ligne(s) à corriger</summary><ul className="mt-2 max-h-36 list-inside list-disc overflow-auto text-xs">{result.erreurs.map((item) => <li key={item.ligne}>Ligne {item.ligne} : {item.erreurs.join(" ; ")}</li>)}</ul></details>}</div>}
        <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Fermer</button><button className="btn-primary" onClick={submit} disabled={!file || busy}>{busy ? "Import en cours…" : "Importer"}</button></div>
      </section>
    </div>
  );
}

function EditDialog({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([key]) => [key, item[key] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const payload = Object.fromEntries(FIELDS.map(([key, , type]) => [key, form[key] === "" ? null : type === "number" ? Number(form[key]) : form[key]]));
    try { await updateAnanasPlantation(item.id, payload); onSaved(); onClose(); }
    catch (err) { setError(err?.response?.data?.detail || "La modification n’a pas pu être enregistrée."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-3"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Modifier la fiche N° {item.numero}</h2><p className="text-sm text-gray-500">Tous les champs suivent le modèle Ananas.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button></div><div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(([key, label, type]) => <label key={key} className="text-sm font-medium text-gray-700">{label}<input type={type || "text"} step={type === "number" ? "any" : undefined} min={type === "number" ? 0 : undefined} value={form[key]} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))} className="input mt-1" /></label>)}</div>{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Annuler</button><button className="btn-primary" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></div></form></div>;
}

export default function AnanasPlantationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filters, setFilters] = useState(emptyFilters);
  const debouncedQuery = useDebounce(filters.q, 350);
  const [filterOptions, setFilterOptions] = useState({ communes: [], arrondissements: [] });
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const params = useMemo(() => ({ q: debouncedQuery || undefined, commune: filters.commune || undefined, arrondissement: filters.arrondissement || undefined, classe: filters.classe || undefined, page, limit: 25 }), [debouncedQuery, filters.commune, filters.arrondissement, filters.classe, page]);

  const reload = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [list, nextStats] = await Promise.all([listAnanasPlantations(params), getAnanasStats()]);
      setItems(list.items); setPagination(list.pagination); setStats(nextStats);
    } catch (err) { setError(err?.response?.data?.detail || "Impossible de charger les plantations Ananas."); }
    finally { setBusy(false); }
  }, [params]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { getAnanasFilters().then(setFilterOptions).catch(() => {}); }, [stats?.total_plantations]);
  useEffect(() => { setPage(1); }, [debouncedQuery, filters.commune, filters.arrondissement, filters.classe]);

  async function exportCurrent() {
    try { await exportAnanasPlantations(params); }
    catch { setError("L’export Excel n’a pas pu être généré."); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionBusy(true);
    try { await deleteAnanasPlantation(deleting.id); setDeleting(null); setNotice("Fiche supprimée."); await reload(); }
    catch { setError("La suppression de la fiche a échoué."); }
    finally { setActionBusy(false); }
  }

  return (
    <AnanasLayout>
      <main className="space-y-5">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-amber-700">Système Ananas</p><h2 className="mt-1 text-2xl font-bold text-gray-900">Plantations</h2><p className="mt-1 text-sm text-gray-600">Fiches séparées du système Anacardier, importées selon le modèle Ananas.</p></div><div className="flex flex-wrap gap-2">{isAdmin && <button onClick={() => setShowImport(true)} className="btn-primary bg-amber-600 hover:bg-amber-700"><UploadCloud size={16} /> Importer Excel</button>}<button onClick={exportCurrent} className="btn-secondary"><Download size={16} /> Exporter</button></div></section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Plantations" value={stats?.total_plantations ?? "—"} /><Stat label="Superficie confirmée" value={stats ? `${number(stats.superficie_confirmee_totale)} ha` : "—"} detail="Base retenue pour l’échantillonnage" /><Stat label="Classe 1" value={stats?.par_classe?.[1] ?? "—"} detail="0 à 4,9 ha" /><Stat label="Classe 2" value={stats?.par_classe?.[2] ?? "—"} detail="5 à 9,9 ha" /><Stat label="Classe 3" value={stats?.par_classe?.[3] ?? "—"} detail="10 ha et plus" /></section>
        {stats?.sans_superficie_confirmee > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{stats.sans_superficie_confirmee} fiche(s) n’ont pas de superficie attribuée / confirmée et ne pourront pas être échantillonnées.</p>}
        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,220px))]">
          <label className="relative"><span className="sr-only">Rechercher une plantation</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={filters.q} onChange={(e) => setFilters((old) => ({ ...old, q: e.target.value }))} className="input pl-9" placeholder="Nom, commune, arrondissement…" /></label>
          <select className="input" value={filters.commune} onChange={(e) => setFilters((old) => ({ ...old, commune: e.target.value }))}><option value="">Toutes les communes</option>{filterOptions.communes.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="input" value={filters.arrondissement} onChange={(e) => setFilters((old) => ({ ...old, arrondissement: e.target.value }))}><option value="">Tous les arrondissements</option>{filterOptions.arrondissements.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="input" value={filters.classe} onChange={(e) => setFilters((old) => ({ ...old, classe: e.target.value }))}><option value="">Toutes les classes</option><option value="1">Classe 1 · 0 à 4,9 ha</option><option value="2">Classe 2 · 5 à 9,9 ha</option><option value="3">Classe 3 · 10 ha et plus</option></select>
        </div></section>
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
        {notice && <p className="rounded-xl border border-forest-200 bg-forest-50 p-3 text-sm text-forest-800">{notice}<button onClick={() => setNotice("")} className="ml-2 underline">Fermer</button></p>}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-200 px-4 py-3"><h3 className="font-semibold text-gray-900">Fiches Ananas</h3><span className="text-sm text-gray-500">{pagination?.total ?? 0} résultat(s)</span></div><div className="overflow-x-auto">
          <table className="min-w-[1900px] border-collapse text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold text-gray-600"><tr><th rowSpan="2" className="border-b px-3 py-2">N</th><th rowSpan="2" className="border-b px-3 py-2">Nom et prénoms</th><th rowSpan="2" className="border-b px-3 py-2">Sexe</th><th rowSpan="2" className="border-b px-3 py-2">Commune</th><th rowSpan="2" className="border-b px-3 py-2">Arrondissement</th><th rowSpan="2" className="border-b px-3 py-2">Village/Hameau</th><th colSpan="2" className="border-b px-3 py-2 text-center">Coordonnées Géographiques</th><th rowSpan="2" className="border-b px-3 py-2">Superficie déclarée (ha)</th><th rowSpan="2" className="border-b px-3 py-2">Superficie trackée (ha)</th><th rowSpan="2" className="border-b px-3 py-2">Type de friche</th><th rowSpan="2" className="border-b px-3 py-2">Type d’espèce végétale</th><th rowSpan="2" className="border-b px-3 py-2">Type de sol</th><th rowSpan="2" className="border-b px-3 py-2">Précédents culturaux</th><th rowSpan="2" className="border-b px-3 py-2">Décision de l’équipe de validation</th><th rowSpan="2" className="border-b px-3 py-2">Décision ATDA7</th><th rowSpan="2" className="border-b px-3 py-2">Sup attribuée / confirmée (ha)</th>{isAdmin && <th rowSpan="2" className="border-b px-3 py-2">Actions</th>}</tr><tr><th className="border-b px-3 py-2">X</th><th className="border-b px-3 py-2">Y</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{busy ? <tr><td colSpan="18" className="px-4 py-12 text-center text-gray-500">Chargement…</td></tr> : items.length === 0 ? <tr><td colSpan="18" className="px-4 py-12 text-center text-gray-500">Aucune fiche Ananas trouvée. Importez un classeur conforme au modèle.</td></tr> : items.map((item) => <tr key={item.id} className="hover:bg-amber-50/40"><td className="px-3 py-3 font-medium">{item.numero}</td><td className="px-3 py-3 font-medium text-gray-900">{display(item.nom_prenoms)}</td><td className="px-3 py-3">{display(item.sexe)}</td><td className="px-3 py-3">{display(item.commune)}</td><td className="px-3 py-3">{display(item.arrondissement)}</td><td className="px-3 py-3">{display(item.village_hameau)}</td><td className="px-3 py-3">{number(item.coord_x)}</td><td className="px-3 py-3">{number(item.coord_y)}</td><td className="px-3 py-3">{number(item.superficie_declaree)}</td><td className="px-3 py-3">{number(item.superficie_trackee)}</td><td className="px-3 py-3">{display(item.type_friche)}</td><td className="px-3 py-3">{display(item.type_espece_vegetale)}</td><td className="px-3 py-3">{display(item.type_sol)}</td><td className="px-3 py-3">{display(item.precedents_culturaux)}</td><td className="px-3 py-3">{display(item.decision_equipe_validation)}</td><td className="px-3 py-3">{display(item.decision_atda7)}</td><td className="px-3 py-3 font-semibold">{number(item.superficie_confirmee)}</td>{isAdmin && <td className="px-3 py-3"><div className="flex gap-1"><button onClick={() => setEditing(item)} title="Modifier" className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700"><Pencil size={15} /></button><button onClick={() => setDeleting(item)} title="Supprimer" className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button></div></td>}</tr>)}</tbody></table>
        </div><footer className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600"><span>Page {pagination?.page ?? page} sur {Math.max(1, pagination?.pages ?? 1)}</span><div className="flex gap-2"><button disabled={page <= 1 || busy} onClick={() => setPage((old) => old - 1)} className="btn-secondary px-3">Précédent</button><button disabled={!pagination || page >= pagination.pages || busy} onClick={() => setPage((old) => old + 1)} className="btn-secondary px-3">Suivant</button></div></footer></section>
      </main>
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={reload} />}
      {editing && <EditDialog item={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-3"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 className="font-semibold text-gray-900">Supprimer cette fiche ?</h2><p className="mt-2 text-sm text-gray-600">La plantation N° {deleting.numero} — {deleting.nom_prenoms || "sans nom"} sera supprimée du système Ananas.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleting(null)} disabled={actionBusy} className="btn-secondary">Annuler</button><button onClick={confirmDelete} disabled={actionBusy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">{actionBusy ? "Suppression…" : <><Trash2 size={15} /> Supprimer</>}</button></div></section></div>}
    </AnanasLayout>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Download, RefreshCw, Save } from "lucide-react";
import AnanasLayout from "../components/AnanasLayout.jsx";
import { exportAnanasAuditSample, getAnanasAuditSample, saveAnanasAuditSuggestion } from "../api/ananas.js";

const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function Metric({ label, value, hint }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}</div>;
}

function QuotaTable({ title, rows, labelField, targetPercent }) {
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-4 py-3"><h3 className="font-semibold text-gray-900">{title}</h3><p className="mt-1 text-xs text-gray-500">Au moins {targetPercent} % des fiches de chaque groupe.{labelField === "type_friche" ? " Les fiches sans type renseigné sont exclues de ce quota." : ""}</p></div><div className="overflow-x-auto"><table className="min-w-[520px] w-full divide-y divide-gray-100 text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold text-gray-600"><tr><th className="px-3 py-2">Groupe</th><th className="px-3 py-2">Disponibles</th><th className="px-3 py-2">Minimum</th><th className="px-3 py-2">Sélectionnées</th></tr></thead><tbody>{rows.length ? rows.map((row) => { const satisfied = row.plantations_echantillon >= row.minimum_requis; return <tr key={row[labelField]}><td className="px-3 py-2.5 font-medium">{row[labelField]}</td><td className="px-3 py-2.5">{row.plantations_total}</td><td className="px-3 py-2.5">{row.minimum_requis}</td><td className={`px-3 py-2.5 font-semibold ${satisfied ? "text-forest-700" : "text-red-700"}`}>{row.plantations_echantillon} / {row.plantations_total}</td></tr>; }) : <tr><td colSpan="4" className="px-3 py-4 text-center text-sm text-gray-500">Aucun type de friche renseigné.</td></tr>}</tbody></table></div></section>;
}

function SampleTable({ rows, title, emptyText }) {
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3"><h3 className="font-semibold text-gray-900">{title}</h3><span className="text-sm text-gray-500">{rows?.length || 0}</span></div><div className="overflow-x-auto"><table className="min-w-[950px] divide-y divide-gray-200 text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold text-gray-600"><tr><th className="px-3 py-2">N</th><th className="px-3 py-2">Nom et prénoms</th><th className="px-3 py-2">Commune</th><th className="px-3 py-2">Arrondissement</th><th className="px-3 py-2">Village/Hameau</th><th className="px-3 py-2">Classe de superficie</th><th className="px-3 py-2">Type de friche</th><th className="px-3 py-2">Sup attribuée / confirmée (ha)</th></tr></thead><tbody className="divide-y divide-gray-100">{!rows?.length ? <tr><td colSpan="8" className="px-4 py-10 text-center text-gray-500">{emptyText}</td></tr> : rows.map((item) => <tr key={item.id}><td className="px-3 py-2.5">{item.numero}</td><td className="px-3 py-2.5 font-medium text-gray-900">{item.nom_prenoms || "—"}</td><td className="px-3 py-2.5">{item.commune || "—"}</td><td className="px-3 py-2.5">{item.arrondissement || "—"}</td><td className="px-3 py-2.5">{item.village_hameau || "—"}</td><td className="px-3 py-2.5">{item.classe_superficie || "—"}</td><td className="px-3 py-2.5">{item.type_friche || "—"}</td><td className="px-3 py-2.5 font-semibold">{fmt(item.superficie_confirmee)}</td></tr>)}</tbody></table></div></section>;
}

export default function AnanasAuditPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [title, setTitle] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [activeList, setActiveList] = useState("sample");

  async function generate() {
    setLoading(true); setError(""); setSavedMessage("");
    try { setResult(await getAnanasAuditSample()); }
    catch (err) { setError(err?.response?.data?.detail || "Impossible de générer la suggestion. Vérifiez les superficies attribuées / confirmées."); }
    finally { setLoading(false); }
  }

  async function exportCurrent() {
    if (!result) return;
    setLoading(true); setError("");
    try { await exportAnanasAuditSample(result); }
    catch (err) { setError(err?.response?.data?.detail || "Impossible d’exporter cette suggestion."); }
    finally { setLoading(false); }
  }

  async function saveCurrent(event) {
    event.preventDefault();
    if (!result) return;
    setSaving(true); setError("");
    try {
      const saved = await saveAnanasAuditSuggestion({ title: title.trim() || undefined, snapshot: result });
      setSavedMessage(`Suggestion « ${saved.title} » enregistrée.`);
      setTitle(""); setShowSave(false);
    } catch (err) { setError(err?.response?.data?.detail || "Impossible d’enregistrer la suggestion."); }
    finally { setSaving(false); }
  }

  const visibleRows = activeList === "sample" ? result?.fiches : result?.fiches_hors_echantillon;

  return (
    <AnanasLayout>
      <main className="space-y-5">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-amber-700">Système Ananas</p><h2 className="mt-1 text-2xl font-bold text-gray-900">Suggestion d’échantillonnage</h2><p className="mt-1 max-w-3xl text-sm text-gray-600">La sélection prend au moins 30 % des fiches de chaque classe de superficie et de chaque type de friche, et couvre au moins 40 % de la superficie confirmée totale. Chaque classe reste représentée dans chaque arrondissement.</p></div><div className="flex flex-wrap gap-2"><button onClick={generate} disabled={loading} className="btn-primary bg-amber-600 hover:bg-amber-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />{result ? "Nouvelle suggestion" : "Générer la suggestion"}</button>{result && <><button onClick={() => { setShowSave(true); setSavedMessage(""); }} className="btn-secondary"><Save size={16} /> Enregistrer</button><button onClick={exportCurrent} disabled={loading} className="btn-secondary"><Download size={16} /> Excel</button></>}</div></section>
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
        {savedMessage && <p role="status" className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 p-3 text-sm text-forest-800"><CheckCircle2 size={17} />{savedMessage}<Link to="/ananas/suggestions" className="ml-auto font-semibold underline">Voir l’historique</Link></p>}
        {!result && !loading && <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-5 py-12 text-center"><p className="text-lg font-semibold text-gray-900">Prêt à calculer l’échantillon</p><p className="mx-auto mt-2 max-w-2xl text-sm text-gray-600">Les superficies attribuées / confirmées manquantes sont exclues et signalées dans le résultat. Les règles de classe utilisent les seuils 5 ha et 10 ha.</p></section>}
        {loading && !result && <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-500">Calcul de l’échantillon…</div>}
        {result && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Plantations éligibles" value={result.total_fiches_eligibles} hint={`${result.total_fiches} fiches au total`} /><Metric label="Superficie confirmée totale" value={`${fmt(result.superficie_totale)} ha`} /><Metric label="Superficie échantillonnée" value={`${fmt(result.superficie_echantillon)} ha`} hint={`${result.fiches.length} plantations`} /><Metric label="Couverture obtenue" value={`${fmt(result.pourcentage_couverture)} %`} hint={`Cible minimale : ${result.pourcentage_cible} %`} /></section>
          <section className="grid gap-3 xl:grid-cols-2"><QuotaTable title="Quota par classe de superficie" rows={result.par_classe} labelField="classe" targetPercent={result.pourcentage_cible_par_classe} /><QuotaTable title="Quota par type de friche" rows={result.par_type_friche} labelField="type_friche" targetPercent={result.pourcentage_cible_par_type_friche} /></section>
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-gray-900">Contrôle des strates</h3><p className="mt-1 text-sm text-gray-500">Chaque ligne a au moins une plantation dans l’échantillon.</p></div><span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Base : {result.base_superficie}</span></div><div className="mt-4 overflow-x-auto"><table className="min-w-[620px] divide-y divide-gray-100 text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="px-3 py-2">Arrondissement</th><th className="px-3 py-2">Classe</th><th className="px-3 py-2">Plantations disponibles</th><th className="px-3 py-2">Dans l’échantillon</th></tr></thead><tbody>{result.par_arrondissement_et_classe.map((stratum) => <tr key={`${stratum.arrondissement}-${stratum.classe}`}><td className="px-3 py-2.5 font-medium">{stratum.arrondissement}</td><td className="px-3 py-2.5">{stratum.classe}</td><td className="px-3 py-2.5">{stratum.plantations_total}</td><td className="px-3 py-2.5 font-semibold text-forest-700">{stratum.plantations_echantillon}</td></tr>)}</tbody></table></div></section>
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-2"><button onClick={() => setActiveList("sample")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeList === "sample" ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Échantillon ({result.fiches.length})</button><button onClick={() => setActiveList("outside")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeList === "outside" ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Hors échantillon ({result.fiches_hors_echantillon.length})</button></div><SampleTable rows={visibleRows} title={activeList === "sample" ? "Plantations retenues" : "Plantations non retenues"} emptyText="Aucune plantation dans cette liste." /></section>
          {result.fiches_sans_superficie_confirmee.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">À compléter : superficie confirmée absente ({result.fiches_sans_superficie_confirmee.length})</h3><p className="mt-1 text-sm text-amber-800">Ces fiches sont exclues des quotas par classe et du calcul des 40 % de superficie.</p><div className="mt-2 flex flex-wrap gap-2">{result.fiches_sans_superficie_confirmee.slice(0, 12).map((item) => <span key={item.id} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-gray-700">N° {item.numero} · {item.nom_prenoms || "sans nom"}</span>)}</div></section>}
          {result.fiches_sans_arrondissement.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">À compléter : arrondissement absent ({result.fiches_sans_arrondissement.length})</h3><p className="mt-1 text-sm text-amber-800">Ces fiches ne peuvent pas garantir la couverture de chaque classe dans chaque arrondissement.</p><div className="mt-2 flex flex-wrap gap-2">{result.fiches_sans_arrondissement.slice(0, 12).map((item) => <span key={item.id} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-gray-700">N° {item.numero} · {item.nom_prenoms || "sans nom"}</span>)}</div></section>}
        </>}
      </main>
      {showSave && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-3"><form onSubmit={saveCurrent} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-semibold text-gray-900">Enregistrer cette suggestion</h3><label className="mt-4 block text-sm font-medium text-gray-700">Nom de la suggestion<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Campagne octobre 2026" className="input mt-1" maxLength={200} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowSave(false)} className="btn-secondary">Annuler</button><button disabled={saving} className="btn-primary bg-amber-600 hover:bg-amber-700">{saving ? "Enregistrement…" : "Enregistrer"}</button></div></form></div>}
    </AnanasLayout>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, RefreshCw, Trash2 } from "lucide-react";
import AnanasLayout from "../components/AnanasLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  deleteAnanasAuditSuggestion,
  exportSavedAnanasAuditSuggestion,
  listAnanasAuditSuggestions,
} from "../api/ananas.js";

const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function AnanasSuggestionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listAnanasAuditSuggestions());
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible de charger les suggestions enregistrées.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function exportOne(item) {
    setExporting(item.id);
    setError("");
    try {
      await exportSavedAnanasAuditSuggestion(item.id);
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible d’exporter cette suggestion.");
    } finally {
      setExporting(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await deleteAnanasAuditSuggestion(deleteTarget.id);
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible de supprimer cette suggestion.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AnanasLayout>
      <main className="space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-700">Système Ananas</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">Suggestions enregistrées</h2>
            <p className="mt-1 text-sm text-gray-600">Chaque suggestion conserve la liste exacte des plantations retenues au moment du tirage.</p>
          </div>
          <button onClick={reload} disabled={loading} className="btn-secondary">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </section>

        {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Suggestion</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Plantations retenues</th>
                  <th className="px-4 py-3">Superficie échantillonnée</th>
                  <th className="px-4 py-3">Couverture</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">Chargement…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">Aucune suggestion enregistrée.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.title}</td>
                    <td className="px-4 py-3 text-gray-600">{item.created_at ? new Date(item.created_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-4 py-3">{item.nb_fiches_echantillon}</td>
                    <td className="px-4 py-3">{fmt(item.superficie_echantillon)} ha</td>
                    <td className="px-4 py-3">{fmt(item.pourcentage_couverture)} %</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => exportOne(item)} disabled={exporting === item.id} className="btn-secondary px-3 py-2" aria-label={`Télécharger ${item.title}`}>
                          <Download size={14} />{exporting === item.id ? "Export…" : "Excel"}
                        </button>
                        {isAdmin && <button onClick={() => setDeleteTarget(item)} className="btn-secondary px-3 py-2 text-red-700 hover:bg-red-50" aria-label={`Supprimer ${item.title}`} title="Supprimer la suggestion">
                          <Trash2 size={14} /> Supprimer
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-3">
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-ananas-suggestion-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h3 id="delete-ananas-suggestion-title" className="text-lg font-semibold text-gray-900">Supprimer cette suggestion ?</h3>
          <p className="mt-2 text-sm text-gray-600">La suggestion « {deleteTarget.title} » sera supprimée définitivement. Les fiches de plantations resteront dans la base Ananas.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary">Annuler</button>
            <button onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              <Trash2 size={15} />{deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </section>
      </div>}
    </AnanasLayout>
  );
}

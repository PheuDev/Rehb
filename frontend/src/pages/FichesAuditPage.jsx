import { useCallback, useEffect, useState } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ClipboardCheck, Download, Eye, RefreshCw, Trash2,
} from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner, EmptyState, Modal, SkeletonTable } from "../components/ui.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  deleteAuditSuggestion,
  exportSavedAuditExcel,
  getAuditSuggestion,
  listAuditSuggestions,
} from "../api/rehabilitations.js";
import { formatNumber } from "../utils/format.js";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DetailModal({ item, onClose }) {
  if (!item?.snapshot) return null;
  const snap = item.snapshot;
  return (
    <Modal
      open
      onClose={onClose}
      title={item.title}
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <p className="text-xs text-gray-500">{formatDateTime(item.created_at)}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 border-b border-gray-100 pb-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">Fiches échantillon</p>
          <p className="font-semibold">{formatNumber(snap.fiches?.length ?? 0, 0)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Superficie (ha)</p>
          <p className="font-semibold">{formatNumber(snap.superficie_echantillon)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Couverture</p>
          <p className="font-semibold">{snap.pourcentage_couverture} %</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total système</p>
          <p className="font-semibold">{formatNumber(snap.superficie_totale)} ha</p>
        </div>
      </div>

      <div className="mt-3 max-h-[45dvh] overflow-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Brigade</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">N° PDA</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Superficie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(snap.fiches || []).map((f) => (
              <tr key={f.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2 text-gray-700">{f.brigade_name ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{f.pda_number ?? "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {f.superficie_rehabilitee != null ? `${formatNumber(f.superficie_rehabilitee)} ha` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function FichesAuditPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingId, setExportingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAuditSuggestions();
      setItems(data.items || []);
    } catch {
      setError("Impossible de charger les suggestions enregistrées.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleExport(row) {
    setExportingId(row.id);
    try {
      const safe = (row.title || "audit").replace(/[^\w.-]+/g, "_").slice(0, 60);
      await exportSavedAuditExcel(row.id, `${safe}.xlsx`);
    } finally {
      setExportingId(null);
    }
  }

  async function handleView(row) {
    try {
      const full = await getAuditSuggestion(row.id);
      setDetail(full);
    } catch {
      setError("Impossible d'ouvrir cette suggestion.");
    }
  }

  async function requestDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await deleteAuditSuggestion(deleteTarget);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
    } catch {
      setError("Suppression impossible.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate("/audit")} aria-label="Retour à la superficie à auditer" className="touch -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-violet-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Fiches d'audit</h2>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Suggestions de superficie à auditer enregistrées depuis l'outil d'échantillonnage.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={load}>
                <RefreshCw size={14} /> Actualiser
              </button>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate("/audit")}>
                Nouvelle suggestion
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {loading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : items.length === 0 ? (
            <EmptyState message="Aucune suggestion enregistrée. Générez un échantillon puis cliquez sur « Sauvegarder la suggestion »." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Titre</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Auteur</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Fiches</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Superficie</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Couverture</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Filtre</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-violet-50/30">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.title}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {row.created_by_full_name || row.created_by_username || "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">{row.nb_fiches_echantillon}</td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {row.superficie_echantillon != null ? `${formatNumber(row.superficie_echantillon)} ha` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">
                        {row.pourcentage_couverture != null ? `${row.pourcentage_couverture} %` : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 max-w-[140px] truncate" title={
                        row.brigade_filter?.length ? row.brigade_filter.join(", ") : undefined
                      }>
                        {row.brigade_filter?.length
                          ? `${row.brigade_filter.length} brigade(s)`
                          : "Toutes"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="btn-secondary h-10 w-10 p-0" onClick={() => handleView(row)} aria-label={`Voir la suggestion ${row.title}`} title="Voir">
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-primary h-10 w-10 p-0"
                            disabled={exportingId === row.id}
                            onClick={() => handleExport(row)}
                            aria-label={`Télécharger la suggestion ${row.title} au format Excel`}
                            title="Télécharger Excel"
                          >
                            {exportingId === row.id ? <Spinner size={13} /> : <Download size={15} />}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn-secondary h-10 w-10 p-0 text-red-600 hover:bg-red-50"
                              onClick={() => requestDelete(row.id)}
                              aria-label={`Supprimer la suggestion ${row.title}`}
                              title="Supprimer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Supprimer cette suggestion ?"
        message="Les fiches de cette suggestion distribuées aux équipes (« Mes plantations ») seront AUSSI supprimées et disparaîtront pour les binômes concernés."
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

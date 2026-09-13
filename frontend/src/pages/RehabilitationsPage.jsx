import { useEffect, useMemo, useState } from "react";
import { Plus, TreeDeciduous } from "lucide-react";

import StatsCards from "../components/StatsCards.jsx";
import FiltersBar from "../components/FiltersBar.jsx";
import RehabilitationTable from "../components/RehabilitationTable.jsx";
import Pagination from "../components/Pagination.jsx";
import RehabilitationFormModal from "../components/RehabilitationFormModal.jsx";
import ImportExcelModal from "../components/ImportExcelModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Toast from "../components/Toast.jsx";

import { useDebounce } from "../hooks/useDebounce.js";
import {
  listRehabilitations,
  createRehabilitation,
  updateRehabilitation,
  deleteRehabilitation,
  deleteRehabilitations,
  clearAllRehabilitations,
  getFilters,
  getStats,
  exportCsv,
  exportExcel,
} from "../api/rehabilitations.js";

const DEFAULT_FILTERS = { q: "", departement: "", commune: "", annee: "", sup_class: "" };

export default function RehabilitationsPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const debouncedQ = useDebounce(filters.q, 400);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filterOptions, setFilterOptions] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState([]);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => setToast({ type, message });

  const [importModalOpen, setImportModalOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      departement: filters.departement || undefined,
      commune: filters.commune || undefined,
      annee: filters.annee || undefined,
      sup_class: filters.sup_class || undefined,
      page,
      limit,
      sortBy,
      sortOrder,
    }),
    [debouncedQ, filters.departement, filters.commune, filters.annee, filters.sup_class, page, limit, sortBy, sortOrder]
  );

  async function loadList() {
    setLoading(true);
    try {
      const data = await listRehabilitations(queryParams);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      showToast("error", "Erreur lors du chargement des fiches.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFilterOptions() {
    try {
      const data = await getFilters();
      setFilterOptions(data);
    } catch (err) {
      // silencieux : les filtres ne sont pas critiques
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      // silencieux
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  useEffect(() => {
    loadFilterOptions();
    loadStats();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.departement, filters.commune, filters.annee, filters.sup_class]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const allCurrentPageSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setServerErrors({});
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setServerErrors({});
    setModalOpen(true);
  }

  async function handleSubmitForm(payload) {
    setSubmitting(true);
    setServerErrors({});
    try {
      if (editingItem) {
        await updateRehabilitation(editingItem.id, payload);
        showToast("success", "Fiche mise à jour avec succès.");
      } else {
        await createRehabilitation(payload);
        showToast("success", "Fiche créée avec succès.");
      }
      setModalOpen(false);
      await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
    } catch (err) {
      const detail = err?.response?.data;
      if (detail?.erreurs) {
        const fieldErrors = {};
        detail.erreurs.forEach((e) => {
          fieldErrors[e.champ] = e.message;
        });
        setServerErrors(fieldErrors);
      }
      showToast("error", detail?.detail || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteRehabilitation(confirmTarget.id);
      showToast("success", "Fiche supprimée avec succès.");
      setConfirmTarget(null);
      await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
    } catch (err) {
      showToast("error", "Erreur lors de la suppression de la fiche.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmBulkDelete() {
    if (!bulkDeleteIds.length) return;
    setBulkDeleting(true);
    try {
      await deleteRehabilitations(bulkDeleteIds);
      showToast("success", `${bulkDeleteIds.length} fiche(s) supprimée(s) avec succès.`);
      setBulkDeleteIds([]);
      setSelectedIds([]);
      await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
    } catch (err) {
      showToast("error", "Erreur lors de la suppression des fiches sélectionnées.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleClearAll() {
    setClearingAll(true);
    try {
      await clearAllRehabilitations();
      showToast("success", "Base de données vidée avec succès.");
      setClearAllConfirm(false);
      setSelectedIds([]);
      await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
    } catch (err) {
      showToast("error", "Erreur lors du vidage de la base de données.");
    } finally {
      setClearingAll(false);
    }
  }

  function toggleSelectItem(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((itemId) => !items.some((item) => item.id === itemId)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...items.map((item) => item.id)])]);
  }

  async function handleExport() {
    try {
      await exportCsv(queryParams);
    } catch (err) {
      showToast("error", "Erreur lors de l'export CSV.");
    }
  }

  async function handleExportExcel() {
    try {
      await exportExcel(queryParams);
    } catch (err) {
      showToast("error", "Erreur lors de l'export Excel.");
    }
  }

  async function handleImported() {
    showToast("success", "Import terminé.");
    await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white">
              <TreeDeciduous size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Gestion des réhabilitations forestières</h1>
              <p className="text-sm text-gray-500">Suivi des fiches PDA et des opérations sylvicoles</p>
            </div>
          </div>
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={16} /> Nouvelle fiche
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <StatsCards stats={stats} loading={statsLoading} />

        <FiltersBar
          filters={filters}
          filterOptions={filterOptions}
          onChange={setFilters}
          onReset={handleResetFilters}
          onExport={handleExport}
          onExportExcel={handleExportExcel}
          onImportExcel={() => setImportModalOpen(true)}
          onClearAll={() => setClearAllConfirm(true)}
        />

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3">
            <div className="text-sm text-forest-800">
              <span className="font-semibold">{selectedIds.length}</span> fiche(s) sélectionnée(s)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-danger"
                onClick={() => setBulkDeleteIds(selectedIds)}
              >
                Supprimer la sélection
              </button>
              <button
                className="btn-secondary"
                onClick={() => setSelectedIds([])}
              >
                Tout désélectionner
              </button>
            </div>
          </div>
        )}

        <RehabilitationTable
          items={items}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onEdit={openEditModal}
          onDelete={setConfirmTarget}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectItem}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allCurrentPageSelected}
        />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      </main>

      <RehabilitationFormModal
        open={modalOpen}
        initialData={editingItem}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={handleImported}
      />

      <ConfirmDialog
        open={!!confirmTarget || bulkDeleteIds.length > 0 || clearAllConfirm}
        title={
          confirmTarget
            ? "Supprimer la fiche"
            : bulkDeleteIds.length > 0
              ? "Supprimer la sélection"
              : "Vider la base de données"
        }
        message={
          confirmTarget
            ? `Voulez-vous vraiment supprimer la fiche N° PDA "${confirmTarget?.pda_number}" ? Cette action est irréversible.`
            : bulkDeleteIds.length > 0
              ? `Voulez-vous vraiment supprimer ${bulkDeleteIds.length} fiche(s) sélectionnée(s) ? Cette action est irréversible.`
              : "Voulez-vous vraiment supprimer toutes les fiches de la base de données ? Cette action est irréversible."
        }
        onConfirm={
          confirmTarget
            ? handleConfirmDelete
            : bulkDeleteIds.length > 0
              ? handleConfirmBulkDelete
              : handleClearAll
        }
        onCancel={() => {
          setConfirmTarget(null);
          setBulkDeleteIds([]);
          setClearAllConfirm(false);
        }}
        loading={deleting || bulkDeleting || clearingAll}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, List } from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import StatsCards from "../components/StatsCards.jsx";
import Sidebar from "../components/Sidebar.jsx";
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
  listIncompleteRehabilitations,
  createRehabilitation,
  updateRehabilitation,
  deleteRehabilitation,
  deleteRehabilitations,
  clearAllRehabilitations,
  getFilters,
  getStats,
  exportCsv,
  exportExcel,
  exportIncompleteExcel,
} from "../api/rehabilitations.js";

const DEFAULT_FILTERS = { q: "", departement: "", commune: "", village: "", annee: "", sup_class: "", brigade: "" };

export default function RehabilitationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialise les filtres depuis l'URL (?brigade=..., ?departement=..., ?q=...) si présents
  const [filters, setFilters] = useState(() => {
    const brigadeFromUrl = searchParams.get("brigade") || "";
    const departementFromUrl = searchParams.get("departement") || "";
    const qFromUrl = searchParams.get("q") || "";
    return { ...DEFAULT_FILTERS, brigade: brigadeFromUrl, departement: departementFromUrl, q: qFromUrl };
  });

  // Nettoie les paramètres URL après les avoir consommés
  useEffect(() => {
    if (searchParams.has("brigade") || searchParams.has("departement") || searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedQ = useDebounce(filters.q, 400);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("all");
  const [incompleteTotal, setIncompleteTotal] = useState(null);

  const [filterOptions, setFilterOptions] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [sidebarOpen, setSidebarOpen] = useSidebarState();

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
      village: filters.village || undefined,
      annee: filters.annee || undefined,
      sup_class: filters.sup_class || undefined,
      brigade_name: filters.brigade || undefined,
      page,
      limit,
      sortBy,
      sortOrder,
    }),
    [debouncedQ, filters.departement, filters.commune, filters.village, filters.annee, filters.sup_class, filters.brigade, page, limit, sortBy, sortOrder]
  );

  async function loadList() {
    setLoading(true);
    try {
      const data =
        activeView === "incomplete"
          ? await listIncompleteRehabilitations(queryParams)
          : await listRehabilitations(queryParams);
      setItems(data.items);
      setPagination(data.pagination);
      if (activeView === "incomplete") setIncompleteTotal(data.pagination.total);
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

  async function reloadAll() {
    await Promise.all([loadList(), loadStats(), loadFilterOptions()]);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, activeView]);

  useEffect(() => {
    loadFilterOptions();
    loadStats();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.departement, filters.commune, filters.village, filters.annee, filters.sup_class, filters.brigade]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const allCurrentPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

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
      await reloadAll();
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
      await reloadAll();
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
      await reloadAll();
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
      await reloadAll();
    } catch (err) {
      showToast("error", "Erreur lors du vidage de la base de données.");
    } finally {
      setClearingAll(false);
    }
  }

  function toggleSelectItem(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((itemId) => !items.some((item) => item.id === itemId))
      );
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
      if (activeView === "incomplete") {
        await exportIncompleteExcel(queryParams);
      } else {
        await exportExcel(queryParams);
      }
    } catch (err) {
      showToast("error", "Erreur lors de l'export Excel.");
    }
  }

  async function handleImported() {
    showToast("success", "Import terminé.");
    await reloadAll();
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onNewFiche={openCreateModal}
      />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && (
          <Sidebar onClose={() => setSidebarOpen(false)} />
        )}

        <main className="min-w-0 flex-1 space-y-6">
          <StatsCards stats={stats} loading={statsLoading} />

          {/* Filtre brigade actif — badge affiché sous les stats */}
          {filters.brigade && (
            <div className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-2 text-sm text-forest-800">
              <span>Brigade filtrée&nbsp;: <strong>{filters.brigade}</strong></span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, brigade: "" }))}
                className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-forest-700 hover:bg-forest-100"
              >
                Retirer le filtre ✕
              </button>
            </div>
          )}

          {filters.departement && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>Département filtré&nbsp;: <strong>{filters.departement}</strong></span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, departement: "" }))}
                className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                Retirer le filtre ✕
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <button
              onClick={() => {
                setActiveView("all");
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                activeView === "all" ? "bg-forest-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <List size={16} /> Toutes les fiches
            </button>
            <button
              onClick={() => {
                setActiveView("incomplete");
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                activeView === "incomplete"
                  ? "bg-amber-500 text-white"
                  : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <ClipboardList size={16} /> Fiches à compléter
              {incompleteTotal !== null ? ` (${incompleteTotal})` : ""}
            </button>
            {activeView === "incomplete" && (
              <p className="px-2 text-sm text-gray-500">
                Chaque fiche liste les informations encore absentes. L'export Excel colore ces cellules en rouge.
              </p>
            )}
          </div>

          <FiltersBar
            filters={filters}
            filterOptions={filterOptions}
            onChange={setFilters}
            onReset={handleResetFilters}
            onExport={handleExport}
            onExportExcel={handleExportExcel}
            onImportExcel={() => setImportModalOpen(true)}
            onClearAll={() => setClearAllConfirm(true)}
            completionMode={activeView === "incomplete"}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3">
              <div className="text-sm text-forest-800">
                <span className="font-semibold">{selectedIds.length}</span> fiche(s) sélectionnée(s)
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-danger" onClick={() => setBulkDeleteIds(selectedIds)}>
                  Supprimer la sélection
                </button>
                <button className="btn-secondary" onClick={() => setSelectedIds([])}>
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
            showMissingFields={activeView === "incomplete"}
          />

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(n) => {
                setLimit(n);
                setPage(1);
              }}
            />
          </div>
        </main>
      </div>

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
          confirmTarget ? handleConfirmDelete : bulkDeleteIds.length > 0 ? handleConfirmBulkDelete : handleClearAll
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

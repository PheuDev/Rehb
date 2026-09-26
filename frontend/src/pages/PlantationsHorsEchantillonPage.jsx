/**
 * Page « Mes plantations hors échantillon » — stock de remplacement par brigade.
 *
 * Parcours :
 *  1. Sélectionner une brigade → liste des plantations hors-échantillon.
 *  2. « Marquer comme utilisée » → choisir une plantation échantillonnée de la
 *     même brigade à remplacer.
 *  3. Résultat : la hors-échantillon devient « grisée » (non cliquable, non
 *     réutilisable) et l'échantillonnée passe au statut « remplacée » dans
 *     Mes plantations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import {
  CheckCircle2, Lock, RefreshCw, Search,
} from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { EmptyState, Modal, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createStockReplacement,
  deleteReplacement,
  listBrigadeEntities,
  listEchantillonPlantations,
  listHorsEchantillonPlantations,
  listTeamBrigades,
} from "../api/terrain.js";
import { formatNumber } from "../utils/format.js";

export default function PlantationsHorsEchantillonPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const [brigades, setBrigades]               = useState([]);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState("");
  const [search, setSearch]                   = useState("");

  const [plantations, setPlantations]         = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [listError, setListError]             = useState("");
  const [actionError, setActionError]         = useState("");

  const [target, setTarget]                   = useState(null); // hors-échantillon à utiliser
  const [sampleOptions, setSampleOptions]     = useState([]);
  const [samplesLoading, setSamplesLoading]   = useState(false);
  const [selectedOriginal, setSelectedOriginal] = useState(null);
  const listRequestId = useRef(0);
  const samplesRequestId = useRef(0);

  const getRequestError = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (!err?.response) return "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.";
    return fallback;
  };

  const normalizedBrigades = brigades.map((b) => ({
    id: b.brigade_id ?? b.id,
    name: b.brigade_name ?? b.name,
  }));

  const loadBrigades = useCallback(async () => {
    try {
      const raw = isAdmin
        ? await listBrigadeEntities()
        : user?.team_id ? await listTeamBrigades(user.team_id) : [];
      const norm = raw.map((b) => ({ id: b.brigade_id ?? b.id, name: b.brigade_name ?? b.name }));
      setBrigades(norm);
      if (norm.length > 0) setSelectedBrigadeId((prev) => prev || String(norm[0].id));
    } catch { /* silencieux */ }
  }, [isAdmin, user?.team_id]);

  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setLoading(true);
    setListError("");
    try {
      const params = {
        ...(selectedBrigadeId ? { brigade_id: selectedBrigadeId } : {}),
        ...(search ? { q: search } : {}),
      };
      const result = await listHorsEchantillonPlantations(params);
      if (requestId === listRequestId.current) setPlantations(result);
    } catch (err) {
      if (requestId === listRequestId.current) {
        setListError(getRequestError(err, "Impossible de charger les plantations hors-échantillon."));
      }
    } finally {
      if (requestId === listRequestId.current) setLoading(false);
    }
  }, [selectedBrigadeId, search]);

  useEffect(() => { loadBrigades(); }, [loadBrigades]);
  useEffect(() => { loadList(); }, [loadList]);

  function closeUseModal() {
    samplesRequestId.current += 1;
    setSamplesLoading(false);
    setTarget(null);
  }

  async function openUseModal(plantation) {
    const requestId = ++samplesRequestId.current;
    setTarget(plantation);
    setSelectedOriginal(null);
    setSampleOptions([]);
    setActionError("");
    setSamplesLoading(true);
    try {
      const sample = await listEchantillonPlantations({ brigade_id: plantation.brigade_id });
      if (requestId === samplesRequestId.current) setSampleOptions(sample);
    } catch (err) {
      if (requestId === samplesRequestId.current) {
        setActionError(getRequestError(err, "Impossible de charger les plantations échantillonnées de cette brigade."));
      }
    } finally {
      if (requestId === samplesRequestId.current) setSamplesLoading(false);
    }
  }

  async function handleConfirmReplacement() {
    if (!target || !selectedOriginal) return;
    setSaving(true);
    setActionError("");
    try {
      await createStockReplacement(target.id, selectedOriginal.id);
      closeUseModal();
      await loadList();
    } catch (err) {
      setActionError(getRequestError(err, "Erreur lors du marquage."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock(plantation) {
    if (!plantation.replacement_id) return;
    setSaving(true);
    setActionError("");
    try {
      await deleteReplacement(plantation.replacement_id);
      await loadList();
    } catch (err) {
      setActionError(getRequestError(err, "Erreur lors du dégrisage."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8 sm:pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-3 py-3 sm:gap-6 sm:px-6 sm:py-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="min-w-0 flex-1 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Hors échantillon</h2>
              <p className="mt-0.5 text-xs text-gray-500 sm:mt-1 sm:text-sm">
                Fiches de la feuille hors-échantillon de la dernière suggestion enregistrée.
                Marquez une fiche comme utilisée pour remplacer une fiche échantillonnée de la même brigade.
              </p>
            </div>
            <button type="button" aria-label="Actualiser les plantations" title="Actualiser" className="btn-secondary h-10 w-10 shrink-0 p-0 sm:w-auto sm:px-4" onClick={loadList}>
              <RefreshCw size={14} /><span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>

          {/* Filtres */}
          <div className="grid gap-2 rounded-xl border border-gray-200 bg-white p-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:p-3">
            <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs text-gray-600 sm:flex sm:text-sm">
              Brigade
              <select
                className="input min-w-0 py-2"
                value={selectedBrigadeId}
                onChange={(e) => setSelectedBrigadeId(e.target.value)}
              >
                <option value="">Toutes les brigades</option>
                {normalizedBrigades.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 py-2"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {plantations.length > 0 && (
              <span className="text-xs text-gray-400 sm:ml-auto">{plantations.length} plantation(s)</span>
            )}
          </div>

          {listError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{listError}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={32} /></div>
          ) : listError ? null : plantations.length === 0 ? (
            <EmptyState message="Aucune plantation hors-échantillon pour cette brigade." />
          ) : (
            <>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white sm:hidden">
              {plantations.map((p) => {
                const locked = p.is_locked;
                return (
                  <li key={p.id} className={`p-3 ${locked ? "bg-gray-50/70" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{p.pda_number || "Sans N° PDA"}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-600">{p.producer_name || "Producteur non renseigné"}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{[p.village, p.commune].filter(Boolean).join(", ") || "Localisation non renseignée"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {locked ? "Utilisée" : "Disponible"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">
                        {p.brigade_name || "Brigade inconnue"}{p.superficie != null ? ` · ${formatNumber(p.superficie)} ha` : ""}
                        {locked && p.locked_by_name ? <span className="block">Par {p.locked_by_name}</span> : null}
                      </div>
                      {locked ? (
                        p.locked_by_me && (
                          <button type="button" className="btn-secondary min-h-10 shrink-0 px-3 py-2 text-xs" disabled={saving} onClick={() => handleUnlock(p)}>
                            Dégriser
                          </button>
                        )
                      ) : (
                        <button type="button" className="btn-primary min-h-10 shrink-0 px-3 py-2 text-xs" disabled={saving} onClick={() => openUseModal(p)}>
                          Marquer utilisée
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto rounded-xl border bg-white sm:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">N°PDA</th>
                    <th className="px-4 py-3 text-left">Producteur</th>
                    <th className="px-4 py-3 text-left">Localisation</th>
                    <th className="px-4 py-3 text-right">Superficie (ha)</th>
                    <th className="px-4 py-3 text-left">Brigade</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {plantations.map((p) => {
                    const locked = p.is_locked;
                    return (
                      <tr key={p.id} className={locked ? "bg-gray-50/70 opacity-70" : "hover:bg-gray-50"}>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.pda_number || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{p.producer_name || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {[p.village, p.commune, p.departement].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {p.superficie != null ? formatNumber(p.superficie) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.brigade_name || "—"}</td>
                        <td className="px-4 py-3">
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <Lock size={11} />
                              Grisée{p.locked_by_me
                                ? " (par vous)"
                                : p.locked_by_name ? ` par ${p.locked_by_name}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <CheckCircle2 size={11} /> Disponible
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {locked ? (
                              p.locked_by_me && (
                                <button
                                  type="button"
                                  className="btn-secondary text-xs px-2 py-1"
                                  disabled={saving}
                                  onClick={() => handleUnlock(p)}
                                >
                                  Dégriser
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                className="btn-primary text-xs px-2 py-1"
                                disabled={saving}
                                onClick={() => openUseModal(p)}
                              >
                                Marquer comme utilisée
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          <p className="hidden text-xs text-gray-400 sm:block">
            Une plantation hors-échantillon utilisée est grisée : elle ne peut pas être choisie
            deux fois. La plantation échantillonnée remplacée passe au statut « remplacée » dans
            Mes plantations.
          </p>
        </main>
      </div>

      {/* Modal : choisir la plantation échantillonnée à remplacer */}
      <Modal
        open={!!target}
        onClose={() => !saving && closeUseModal()}
        title="Marquer comme utilisée"
      >
        <div className="space-y-4">
          {target && (
            <p className="text-sm text-gray-600">
              Cette plantation sera <strong>grisée</strong> (non réutilisable). Choisissez la
              plantation <strong>échantillonnée</strong> de la brigade{" "}
              <strong>{target.brigade_name || "?"}</strong> qu'elle va remplacer :
            </p>
          )}

          {samplesLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : sampleOptions.length === 0 ? (
            <EmptyState message="Aucune plantation échantillonnée disponible dans cette brigade (toutes déjà remplacées ?)." />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {sampleOptions.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedOriginal?.id === s.id
                      ? "border-forest-600 bg-forest-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="original"
                    className="accent-forest-600 shrink-0"
                    checked={selectedOriginal?.id === s.id}
                    onChange={() => setSelectedOriginal(s)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800">{s.pda_number || "—"}</span>
                    <span className="block text-xs text-gray-500">
                      {s.producer_name || "—"} · {[s.village, s.commune].filter(Boolean).join(", ") || "—"}
                      {s.superficie != null ? ` · ${formatNumber(s.superficie)} ha` : ""}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-amber-600">Échantillonnée</span>
                </label>
              ))}
            </div>
          )}

          {actionError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={closeUseModal}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving || !selectedOriginal}
              onClick={handleConfirmReplacement}
            >
              {saving ? <Spinner size={14} /> : <CheckCircle2 size={14} />}
              Remplacer cette plantation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

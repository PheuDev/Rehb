/**
 * Page "Mes fiches" — fiches d'audit créées par le binôme connecté.
 *
 * Affiche la liste des fiches avec les informations essentielles.
 * Un lien permet d'ouvrir la fiche complète dans la page principale.
 */
import { useEffect, useState, useCallback } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import { useNavigate } from "react-router-dom";
import { ExternalLink, RefreshCw, FileText } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { SkeletonTable, EmptyState } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { listBinomeFiches } from "../api/terrain.js";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function MesFichesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const [fiches, setFiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const binomeId = user?.binome_id;

  const loadFiches = useCallback(async () => {
    if (!binomeId) return;
    setLoading(true);
    setError("");
    try {
      const data = await listBinomeFiches(binomeId);
      setFiches(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [binomeId]);

  useEffect(() => { loadFiches(); }, [loadFiches]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mes fiches</h2>
              <p className="text-sm text-gray-500 mt-1">
                Fiches d'audit créées par votre binôme.
              </p>
            </div>
            <button className="btn-secondary text-sm" onClick={loadFiches}>
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          {!binomeId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Votre compte n'est pas rattaché à un binôme. Contactez votre administrateur.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <SkeletonTable rows={6} columns={5} />
          ) : fiches.length === 0 ? (
            <EmptyState message="Aucune fiche créée par votre binôme pour l'instant." />
          ) : (
            <>
              {/* ── Vue cartes (mobile) ── */}
              <ul className="space-y-2 sm:hidden">
                {fiches.map((f) => (
                  <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {f.pda_number || <span className="italic text-gray-500">Sans N° PDA</span>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {f.producer_name || "Producteur non renseigné"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {[f.village, f.commune].filter(Boolean).join(", ") || "Localisation non renseignée"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-800">
                          {f.superficie_rehabilitee != null ? `${Number(f.superficie_rehabilitee).toFixed(2)} ha` : "—"}
                        </p>
                        <p className="text-xs text-gray-600">{f.annee_rehabilitation || "—"}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-1">
                      <div className="min-w-0 text-xs text-gray-600">
                        <p className="truncate">{f.brigade_name || "Brigade non renseignée"}</p>
                        <p>Créée le {formatDate(f.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        className="touch rounded-lg text-gray-600 hover:bg-forest-50 hover:text-forest-600"
                        aria-label={`Voir la fiche ${f.pda_number || f.id} dans la liste principale`}
                        title="Voir dans la liste principale"
                        onClick={() => navigate(`/anacardier?q=${f.pda_number || f.id}`)}
                      >
                        <ExternalLink size={17} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ── Vue tableau (≥ sm) ── */}
              <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
                <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">N°PDA</th>
                    <th className="px-4 py-3 text-left">Producteur</th>
                    <th className="px-4 py-3 text-left">Commune / Village</th>
                    <th className="px-4 py-3 text-left">Brigade</th>
                    <th className="px-4 py-3 text-right">Superficie (ha)</th>
                    <th className="px-4 py-3 text-left">Année</th>
                    <th className="px-4 py-3 text-left">Créée le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fiches.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} className="text-forest-500 shrink-0" />
                          <span className="font-medium text-gray-800">
                            {f.pda_number || <span className="italic text-gray-500">—</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.producer_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {[f.village, f.commune].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.brigade_name || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {f.superficie_rehabilitee != null
                          ? Number(f.superficie_rehabilitee).toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.annee_rehabilitation || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(f.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="touch rounded-lg text-gray-600 hover:bg-forest-50 hover:text-forest-600"
                          aria-label={`Voir la fiche ${f.pda_number || f.id} dans la liste principale`}
                          title="Voir dans la liste principale"
                          onClick={() => navigate(`/anacardier?q=${f.pda_number || f.id}`)}>
                          <ExternalLink size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          {fiches.length > 0 && (
            <p className="text-xs text-gray-500 text-right">{fiches.length} fiche(s)</p>
          )}
        </main>
      </div>
    </div>
  );
}

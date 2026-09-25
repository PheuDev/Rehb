/**
 * Page "Mes fiches" — fiches d'audit créées par le binôme connecté.
 *
 * Affiche la liste des fiches avec les informations essentielles.
 * Un lien permet d'ouvrir la fiche complète dans la page principale.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, RefreshCw, FileText } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
            <div className="flex justify-center py-16"><Spinner size={32} /></div>
          ) : fiches.length === 0 ? (
            <EmptyState message="Aucune fiche créée par votre binôme pour l'instant." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
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
                            {f.pda_number || <span className="italic text-gray-400">—</span>}
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
                          className="p-1 text-gray-400 hover:text-forest-600 hover:bg-forest-50 rounded"
                          title="Voir dans la liste principale"
                          onClick={() => navigate(`/?q=${f.pda_number || f.id}`)}>
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fiches.length > 0 && (
            <p className="text-xs text-gray-400 text-right">{fiches.length} fiche(s)</p>
          )}
        </main>
      </div>
    </div>
  );
}

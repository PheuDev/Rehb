/**
 * Page Terrain — pour les binômes.
 *
 * Parcours :
 *  1. Liste des plantations attribuées au binôme
 *  2. Pour chaque plantation : signaler introuvable → choisir un remplacement
 *  3. Depuis une plantation (attribuée ou remplacement) → Créer une fiche d'audit
 */
import { useEffect, useState, useCallback } from "react";
import { Search, AlertTriangle, CheckCircle2, ArrowRight, Plus, RefreshCw, Download } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Modal, Spinner, EmptyState } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  listBiномePlantations,
  listTeamPlantations,
  listAvailableReplacements,
  createReplacement,
  listBinomeReplacements,
  exportBinomePlantationsExcel,
  exportTeamPlantationsExcel,
} from "../api/terrain.js";
import { createRehabilitation, updateRehabilitation } from "../api/rehabilitations.js";
import { linkFicheToPlantation } from "../api/terrain.js";

// ─── Carte plantation ─────────────────────────────────────────────────────────
function PlantationCard({ plantation, onSignal, onAudit, isReplacement = false, readOnly = false }) {
  const replaced = plantation.is_replaced;
  return (
    <div className={`rounded-xl border bg-white p-4 space-y-2 ${replaced ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800">
            {plantation.pda_number || <span className="italic text-gray-400">Sans N°PDA</span>}
            {isReplacement && (
              <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Remplacement</span>
            )}
          </p>
          <p className="text-sm text-gray-600">{plantation.producer_name || "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {[plantation.village, plantation.commune, plantation.departement].filter(Boolean).join(", ") || "Localisation inconnue"}
          </p>
          {plantation.superficie && (
            <p className="text-xs text-gray-500 mt-0.5">{plantation.superficie} ha</p>
          )}
        </div>
        {replaced && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
            <AlertTriangle size={11} /> Remplacée
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {!readOnly && !replaced && !isReplacement && (
          <button className="btn-secondary text-xs py-1 px-3 flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
            onClick={() => onSignal(plantation)}>
            <AlertTriangle size={13} /> Introuvable
          </button>
        )}
        <button className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
          onClick={() => onAudit(plantation)}>
          <Plus size={13} /> Fiche d'audit
        </button>
      </div>
    </div>
  );
}

// ─── Modal Remplacement ────────────────────────────────────────────────────────
function ReplacementModal({ open, onClose, binomeId, originalPlantation, onSuccess }) {
  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!open || !binomeId) return;
    setLoading(true);
    try {
      const data = await listAvailableReplacements(binomeId, search ? { q: search } : {});
      setAvailable(data);
    } catch { setAvailable([]); }
    finally { setLoading(false); }
  }, [open, binomeId, search]);

  useEffect(() => { load(); }, [load]);

  async function handleSelect(replacement) {
    setSaving(true);
    setError("");
    try {
      await createReplacement(originalPlantation.id, replacement.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sélection.");
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={`Remplacement — ${originalPlantation?.pda_number || "plantation introuvable"}`}
      size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choisissez une plantation hors-échantillon pour remplacer{" "}
          <strong>{originalPlantation?.pda_number || "cette plantation"}</strong>.
          Une fois sélectionnée, elle sera verrouillée pour votre binôme.
        </p>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Rechercher par N°PDA, producteur, commune…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : available.length === 0 ? (
          <EmptyState message="Aucune plantation de remplacement disponible." />
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {available.map(p => (
              <div key={p.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => !saving && handleSelect(p)}>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {p.pda_number || <span className="italic text-gray-400">Sans N°PDA</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.producer_name || "—"} · {[p.village, p.commune].filter(Boolean).join(", ") || "—"}
                    {p.superficie && ` · ${p.superficie} ha`}
                  </p>
                </div>
                <ArrowRight size={15} className="text-forest-600 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal Fiche d'audit rapide ────────────────────────────────────────────────
function AuditModal({ open, onClose, plantation }) {
  const [form, setForm] = useState({
    observations: "",
    superficie_rehabilitee: "",
    annee_rehabilitation: new Date().getFullYear(),
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && plantation) {
      setForm(f => ({
        ...f,
        pda_number: plantation.pda_number || "",
        producer_name: plantation.producer_name || "",
        producer_phone: plantation.producer_phone || "",
        departement: plantation.departement || "",
        commune: plantation.commune || "",
        arrondissement: plantation.arrondissement || "",
        village: plantation.village || "",
        superficie_rehabilitee: plantation.superficie || "",
        brigade_name: plantation.brigade_name || "",
      }));
    }
  }, [open, plantation]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        superficie_rehabilitee: form.superficie_rehabilitee ? parseFloat(form.superficie_rehabilitee) : null,
        annee_rehabilitation: form.annee_rehabilitation ? parseInt(form.annee_rehabilitation) : null,
      };
      const fiche = await createRehabilitation(payload);
      // Lier à la plantation
      if (plantation?.id) {
        await linkFicheToPlantation(fiche.id, plantation.id);
      }
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la création de la fiche.");
    } finally { setSaving(false); }
  }

  function handleClose() {
    setSuccess(false); setError("");
    setForm({ observations: "", superficie_rehabilitee: "", annee_rehabilitation: new Date().getFullYear() });
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose}
      title={`Fiche d'audit — ${plantation?.pda_number || "Nouvelle fiche"}`}
      size="md"
      footer={
        success ? (
          <button className="btn-primary" onClick={handleClose}>Fermer</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={handleClose} disabled={saving}>Annuler</button>
            <button className="btn-primary" form="audit-form" type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Créer la fiche"}
            </button>
          </>
        )
      }>
      {success ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <p className="font-medium text-gray-800">Fiche créée avec succès.</p>
          <p className="text-sm text-gray-500">Retrouvez-la dans "Mes fiches".</p>
        </div>
      ) : (
        <form id="audit-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">N°PDA</label>
              <input className="input" value={form.pda_number || ""}
                onChange={e => setForm(p => ({ ...p, pda_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">Année</label>
              <input className="input" type="number" min="1990" max="2100"
                value={form.annee_rehabilitation}
                onChange={e => setForm(p => ({ ...p, annee_rehabilitation: e.target.value }))} />
            </div>
            <div>
              <label className="label">Producteur</label>
              <input className="input" value={form.producer_name || ""}
                onChange={e => setForm(p => ({ ...p, producer_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Superficie (ha)</label>
              <input className="input" type="number" step="0.01" min="0"
                value={form.superficie_rehabilitee || ""}
                onChange={e => setForm(p => ({ ...p, superficie_rehabilitee: e.target.value }))} />
            </div>
            <div>
              <label className="label">Commune</label>
              <input className="input" value={form.commune || ""}
                onChange={e => setForm(p => ({ ...p, commune: e.target.value }))} />
            </div>
            <div>
              <label className="label">Village</label>
              <input className="input" value={form.village || ""}
                onChange={e => setForm(p => ({ ...p, village: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={3} value={form.observations}
              onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>
      )}
    </Modal>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TerrainPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plantations, setPlantations] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signalTarget, setSignalTarget] = useState(null);
  const [auditTarget, setAuditTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  const isBinome = user?.role === "binome";
  const binomeId = isBinome ? user?.binome_id : null;
  const teamId   = !isBinome ? user?.team_id : null;

  const loadData = useCallback(async () => {
    if (!binomeId && !teamId) return;
    setLoading(true);
    try {
      if (binomeId) {
        const [p, r] = await Promise.all([
          listBiномePlantations(binomeId),
          listBinomeReplacements(binomeId),
        ]);
        setPlantations(p);
        setReplacements(r);
      } else {
        setPlantations(await listTeamPlantations(teamId));
        setReplacements([]);
      }
    } catch { /* erreur silencieuse */ }
    finally { setLoading(false); }
  }, [binomeId, teamId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Plantations de remplacement enrichies
  const replacementPlantationIds = replacements.map(r => r.replacement_plantation_id);

  if (!binomeId && !teamId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center py-24">
          <div className="text-center text-gray-500 space-y-2">
            <AlertTriangle size={36} className="mx-auto text-amber-400" />
            <p className="font-medium">Votre compte n'est rattaché à aucune équipe ni binôme.</p>
            <p className="text-sm">Contactez votre administrateur.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mes plantations</h2>
              <p className="text-sm text-gray-500 mt-1">
                {isBinome
                  ? "Plantations attribuées à votre binôme pour audit."
                  : "Plantations reçues par votre équipe (brigades qui lui sont confiées)."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={exporting || plantations.length === 0}
                onClick={async () => {
                  setExporting(true);
                  try {
                    if (binomeId) await exportBinomePlantationsExcel(binomeId);
                    else if (teamId) await exportTeamPlantationsExcel(teamId);
                  }
                  finally { setExporting(false); }
                }}
              >
                {exporting ? <Spinner size={14} /> : <Download size={14} />}
                Excel
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={loadData}>
                <RefreshCw size={14} /> Actualiser
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={32} /></div>
          ) : (
            <>
              {/* Plantations de l'échantillon */}
              {plantations.length === 0 ? (
                <EmptyState message={isBinome
                  ? "Aucune plantation attribuée à votre binôme."
                  : "Aucune plantation reçue par votre équipe pour l'instant."} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plantations.map(p => (
                    <PlantationCard key={p.id} plantation={p}
                      readOnly={!isBinome}
                      onSignal={setSignalTarget}
                      onAudit={setAuditTarget} />
                  ))}
                </div>
              )}

              {/* Plantations de remplacement sélectionnées */}
              {isBinome && replacements.length > 0 && (
                <>
                  <h3 className="text-base font-semibold text-gray-700 pt-2">
                    Remplacements sélectionnés ({replacements.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {replacements.map(r => {
                      // On affiche la plantation de remplacement avec les données disponibles
                      const mockPlantation = {
                        id: r.replacement_plantation_id,
                        pda_number: `Remplacement #${r.replacement_plantation_id}`,
                      };
                      return (
                        <PlantationCard key={r.id}
                          plantation={mockPlantation}
                          onSignal={() => {}}
                          onAudit={() => setAuditTarget(mockPlantation)}
                          isReplacement />
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal remplacement */}
      {signalTarget && (
        <ReplacementModal
          open={!!signalTarget}
          onClose={() => setSignalTarget(null)}
          binomeId={binomeId}
          originalPlantation={signalTarget}
          onSuccess={loadData}
        />
      )}

      {/* Modal fiche d'audit */}
      <AuditModal
        open={!!auditTarget}
        onClose={() => setAuditTarget(null)}
        plantation={auditTarget}
      />
    </div>
  );
}

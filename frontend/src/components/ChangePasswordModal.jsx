/**
 * Modal de changement de mot de passe — accessible depuis n'importe quelle page.
 * Appelée depuis AppHeader ou tout autre endroit.
 */
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Modal } from "./ui.jsx";
import { changePassword } from "../api/terrain.js";

export default function ChangePasswordModal({ open, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrent(""); setNext(""); setConfirm("");
    setError(""); setSuccess(false); setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (next.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors du changement de mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Changer mon mot de passe"
      size="sm"
      footer={
        success ? (
          <button className="btn-primary" onClick={handleClose}>Fermer</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={handleClose} disabled={loading}>Annuler</button>
            <button className="btn-primary" form="change-pwd-form" type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <KeyRound size={22} />
          </div>
          <p className="font-medium text-gray-800">Mot de passe modifié avec succès.</p>
          <p className="text-sm text-gray-500">Reconnectez-vous si nécessaire.</p>
        </div>
      ) : (
        <form id="change-pwd-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="label">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                className="input pr-10"
                required
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowCurrent(v => !v)}>
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="label">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNext ? "text" : "password"}
                className="input pr-10"
                required
                minLength={6}
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowNext(v => !v)}>
                {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirmation */}
          <div>
            <label className="label">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              className="input"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

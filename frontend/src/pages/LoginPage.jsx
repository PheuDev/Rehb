import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TreeDeciduous, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { loginFn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginFn(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        "Identifiants incorrects ou serveur indisponible.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* ── Logo ──────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-600 text-white shadow-md">
            <TreeDeciduous size={28} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Gestion des réhabilitations
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Connectez-vous pour continuer
            </p>
          </div>
        </div>

        {/* ── Formulaire ────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-5">

            {/* Nom d'utilisateur */}
            <div>
              <label htmlFor="username" className="label">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="ex : jean.dupont"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {error}
              </p>
            )}

            {/* Bouton soumettre */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Connexion…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={16} />
                  Se connecter
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * AuthContext — gestion globale de l'authentification.
 *
 * Fournit :
 *  - user      : profil courant ({ username, full_name, role, team_id, binome_id }) ou null
 *  - token     : JWT brut ou null
 *  - loading   : true pendant la vérification initiale du token
 *  - loginFn   : (username, password) => Promise<void>
 *  - logoutFn  : () => void
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { login as apiLogin, getMe } from "../api/auth.js";
import client from "../api/client.js";

const TOKEN_KEY = "rehab_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // vérifie le token au montage

  // ── Synchronise l'en-tête Axios dès que le token change ──────────────
  useEffect(() => {
    if (token) {
      client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete client.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // ── Vérification initiale : token présent → charge le profil ─────────
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((profile) => setUser(profile))
      .catch(() => {
        // Token expiré ou invalide → nettoyer
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login ─────────────────────────────────────────────────────────────
  const loginFn = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    const { access_token, ...profile } = data;

    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    client.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(profile);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────
  const logoutFn = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    delete client.defaults.headers.common["Authorization"];
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginFn, logoutFn }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook — accède au contexte auth depuis n'importe quel composant. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

import axios from "axios";

// VITE_API_URL doit pointer sur la racine de l'API (/api), ex : "/api"
// ou "https://back.onrender.com/api". On normalise pour tolérer une URL
// saisie sans le suffixe "/api" (ex : "https://back.onrender.com").
const rawBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const baseURL = rawBase.endsWith("/api") ? rawBase : rawBase + "/api";

const client = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Intercepteur de réponse ───────────────────────────────────────────────────
// Si le serveur retourne 401, le token est expiré ou absent :
// on nettoie le stockage local et on redirige vers /login.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("rehab_token");
      delete client.defaults.headers.common["Authorization"];
      // Redirection douce — ne pas importer useNavigate ici (hors composant React)
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;

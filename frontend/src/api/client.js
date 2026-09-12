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

export default client;

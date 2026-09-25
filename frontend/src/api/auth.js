import client from "./client.js";

/**
 * Authentifie un utilisateur et retourne le token + infos profil.
 * @param {string} username
 * @param {string} password
 */
export async function login(username, password) {
  const { data } = await client.post("/auth/login", { username, password });
  return data; // { access_token, token_type, role, username, full_name, team_id, binome_id }
}

/**
 * Retourne le profil de l'utilisateur courant (nécessite un token valide).
 */
export async function getMe() {
  const { data } = await client.get("/auth/me");
  return data;
}

/**
 * Appelle le endpoint de logout (stateless — sert surtout à nettoyer côté client).
 */
export async function logout() {
  try {
    await client.post("/auth/logout");
  } catch {
    // ignorer les erreurs réseau au logout
  }
}

/**
 * API Phase 2 — Terrain : brigades, plantations, attributions, remplacements.
 */
import client from "./client.js";

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function changePassword(currentPassword, newPassword) {
  const { data } = await client.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

// ── Brigades (entités) ────────────────────────────────────────────────────────
export async function listBrigadeEntities(params) {
  const { data } = await client.get("/brigades", { params });
  return data;
}

export async function createBrigadeEntity(payload) {
  const { data } = await client.post("/brigades", payload);
  return data;
}

export async function updateBrigadeEntity(id, payload) {
  const { data } = await client.put(`/brigades/${id}`, payload);
  return data;
}

export async function deleteBrigadeEntity(id) {
  await client.delete(`/brigades/${id}`);
}

// ── Affectations brigade → équipe ─────────────────────────────────────────────
export async function assignBrigadeToTeam(brigadeId, teamId, campaign) {
  const { data } = await client.post(`/brigades/${brigadeId}/assign`, {
    team_id: teamId,
    campaign,
  });
  return data;
}

export async function removeAssignment(brigadeId, assignmentId) {
  await client.delete(`/brigades/${brigadeId}/assign/${assignmentId}`);
}

export async function listTeamBrigades(teamId, campaign) {
  const { data } = await client.get(`/teams/${teamId}/brigades`, {
    params: campaign ? { campaign } : {},
  });
  return data;
}

// ── Équipes ───────────────────────────────────────────────────────────────────
export async function listTeams(params) {
  const { data } = await client.get("/teams", { params });
  return data;
}

export async function createTeam(payload) {
  const { data } = await client.post("/teams", payload);
  return data;
}

export async function updateTeam(id, payload) {
  const { data } = await client.put(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id) {
  await client.delete(`/teams/${id}`);
}

// ── Binômes ───────────────────────────────────────────────────────────────────
export async function listBinomes(teamId) {
  const { data } = await client.get(`/teams/${teamId}/binomes`);
  return data;
}

export async function createBinome(teamId, name) {
  const { data } = await client.post(`/teams/${teamId}/binomes`, { name });
  return data;
}

export async function deleteBinome(binomeId) {
  await client.delete(`/binomes/${binomeId}`);
}

// ── Utilisateurs ──────────────────────────────────────────────────────────────
export async function listUsers(params) {
  const { data } = await client.get("/users", { params });
  return data;
}

export async function createUser(payload) {
  const { data } = await client.post("/users", payload);
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await client.put(`/users/${id}`, payload);
  return data;
}

export async function resetUserPassword(id, newPassword) {
  const { data } = await client.post(`/users/${id}/reset-password`, {
    new_password: newPassword,
  });
  return data;
}

// ── Plantations ───────────────────────────────────────────────────────────────
export async function listPlantations(params) {
  const { data } = await client.get("/plantations", { params });
  return data;
}

export async function createPlantation(payload) {
  const { data } = await client.post("/plantations", payload);
  return data;
}

export async function bulkCreatePlantations(list) {
  const { data } = await client.post("/plantations/bulk", list);
  return data;
}

export async function deletePlantation(id) {
  await client.delete(`/plantations/${id}`);
}

// ── Attributions plantation → binôme ──────────────────────────────────────────
export async function listBiномePlantations(binomeId) {
  const { data } = await client.get(`/binomes/${binomeId}/plantations`);
  return data;
}

export async function assignPlantationsToBinome(binomeId, plantationIds) {
  const { data } = await client.post(`/binomes/${binomeId}/plantations`, {
    plantation_ids: plantationIds,
  });
  return data;
}

export async function removeBiномePlantation(binomeId, plantationId) {
  await client.delete(`/binomes/${binomeId}/plantations/${plantationId}`);
}

// ── Remplacements ─────────────────────────────────────────────────────────────
export async function listAvailableReplacements(binomeId, params) {
  const { data } = await client.get(`/binomes/${binomeId}/available-replacements`, { params });
  return data;
}

export async function createReplacement(originalId, replacementId) {
  const { data } = await client.post("/replacements", {
    original_plantation_id: originalId,
    replacement_plantation_id: replacementId,
  });
  return data;
}

export async function listBinomeReplacements(binomeId) {
  const { data } = await client.get(`/binomes/${binomeId}/replacements`);
  return data;
}

// ── Mes fiches ────────────────────────────────────────────────────────────────
export async function listBinomeFiches(binomeId) {
  const { data } = await client.get(`/binomes/${binomeId}/rehabilitations`);
  return data;
}

export async function linkFicheToPlantation(ficheId, plantationId) {
  const { data } = await client.post(
    `/rehabilitations/${ficheId}/link-plantation`,
    null,
    { params: { plantation_id: plantationId } }
  );
  return data;
}

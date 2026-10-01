import client from "./client.js";

function downloadBlob(data, filename) {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function listAnanasPlantations(params) {
  const { data } = await client.get("/ananas/plantations", { params });
  return data;
}

export async function getAnanasStats() {
  const { data } = await client.get("/ananas/stats");
  return data;
}

export async function getAnanasFilters() {
  const { data } = await client.get("/ananas/filters");
  return data;
}

export async function downloadAnanasTemplate() {
  const { data } = await client.get("/ananas/import-template", { responseType: "blob" });
  downloadBlob(data, "modele_import_ananas.xlsx");
}

export async function importAnanasExcel(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/ananas/import-excel", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function exportAnanasPlantations(params) {
  const { data } = await client.get("/ananas/export-excel", { params, responseType: "blob" });
  downloadBlob(data, "plantations_ananas.xlsx");
}

export async function updateAnanasPlantation(id, payload) {
  const { data } = await client.patch(`/ananas/plantations/${id}`, payload);
  return data;
}

export async function deleteAnanasPlantation(id) {
  await client.delete(`/ananas/plantations/${id}`);
}

export async function clearAnanasDatabase() {
  const { data } = await client.delete("/ananas/database");
  return data;
}

export async function getAnanasAuditSample() {
  const { data } = await client.get("/ananas/audit-sample");
  return data;
}

export async function exportAnanasAuditSample(snapshot) {
  const { data } = await client.post("/ananas/audit-sample/export-excel", { snapshot }, { responseType: "blob" });
  downloadBlob(data, "echantillon_ananas.xlsx");
}

export async function saveAnanasAuditSuggestion(payload) {
  const { data } = await client.post("/ananas/audit-suggestions", payload);
  return data;
}

export async function listAnanasAuditSuggestions() {
  const { data } = await client.get("/ananas/audit-suggestions");
  return data;
}

export async function getAnanasAuditSuggestion(id) {
  const { data } = await client.get(`/ananas/audit-suggestions/${id}`);
  return data;
}

export async function exportSavedAnanasAuditSuggestion(id) {
  const { data } = await client.get(`/ananas/audit-suggestions/${id}/export-excel`, { responseType: "blob" });
  downloadBlob(data, `suggestion_ananas_${id}.xlsx`);
}

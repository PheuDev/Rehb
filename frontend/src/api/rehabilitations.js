import client from "./client.js";

export async function listRehabilitations(params) {
  const { data } = await client.get("/rehabilitations", { params });
  return data;
}

export async function getRehabilitation(id) {
  const { data } = await client.get(`/rehabilitations/${id}`);
  return data;
}

export async function createRehabilitation(payload) {
  const { data } = await client.post("/rehabilitations", payload);
  return data;
}

export async function updateRehabilitation(id, payload) {
  const { data } = await client.put(`/rehabilitations/${id}`, payload);
  return data;
}

export async function deleteRehabilitation(id) {
  const { data } = await client.delete(`/rehabilitations/${id}`);
  return data;
}

export async function getFilters() {
  const { data } = await client.get("/rehabilitations/filters");
  return data;
}

export async function getStats() {
  const { data } = await client.get("/rehabilitations/stats");
  return data;
}

function downloadBlob(data, filename) {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportCsv(params) {
  const response = await client.get("/rehabilitations/export", { params, responseType: "blob" });
  downloadBlob(response.data, "rehabilitations.csv");
}

export async function exportExcel(params) {
  const response = await client.get("/rehabilitations/export-excel", { params, responseType: "blob" });
  downloadBlob(response.data, "rehabilitations.xlsx");
}

export async function downloadImportTemplate() {
  const response = await client.get("/rehabilitations/import-template", { responseType: "blob" });
  downloadBlob(response.data, "modele_import_rehabilitations.xlsx");
}

export async function importExcel(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/rehabilitations/import-excel", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

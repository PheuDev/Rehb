export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Recalcule la classe de superficie côté client, pour un aperçu en temps réel. */
export function computeSupClass(superficie) {
  const s = Number(superficie);
  if (Number.isNaN(s)) return "—";
  if (s < 1) return "S < 1 ha";
  if (s < 2) return "1 ≤ S < 2 ha";
  if (s < 3) return "2 ≤ S < 3 ha";
  if (s < 5) return "3 ≤ S < 5 ha";
  if (s < 10) return "5 ≤ S < 10 ha";
  if (s < 20) return "10 ≤ S < 20 ha";
  if (s <= 30) return "20 ≤ S ≤ 30 ha";
  return "S > 30 ha";
}

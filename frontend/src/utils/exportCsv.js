/**
 * Génère et télécharge un fichier CSV (séparateur ";", UTF-8 BOM).
 * Excel ouvre ce format nativement sans configuration.
 *
 * @param {Array<Object>} rows     - Données à exporter
 * @param {Array<{header: string, key: string, format?: (v, row) => string}>} columns
 * @param {string} filename        - Nom du fichier sans extension
 */
export function downloadAsCsv(rows, columns, filename) {
  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    // Si la valeur contient un ";", des guillemets ou un saut de ligne, on entoure
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escape(c.header)).join(";");
  const dataLines = rows.map((row) =>
    columns
      .map((c) => escape(c.format ? c.format(row[c.key], row) : row[c.key]))
      .join(";")
  );

  // BOM UTF-8 (\uFEFF) pour que Excel détecte l'encodage automatiquement
  const csv = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

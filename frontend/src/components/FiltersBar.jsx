import { Search, RotateCcw, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Input, Select } from "./ui.jsx";
import { SUP_CLASSES } from "../utils/constants.js";

export default function FiltersBar({ filters, filterOptions, onChange, onReset, onExport, onExportExcel, onImportExcel }) {
  const handle = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Rechercher (PDA, village, brigade, producteur...)"
            value={filters.q}
            onChange={handle("q")}
          />
        </div>

        <Select value={filters.departement} onChange={handle("departement")}>
          <option value="">Tous les départements</option>
          {filterOptions?.departements?.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>

        <Select value={filters.commune} onChange={handle("commune")}>
          <option value="">Toutes les communes</option>
          {filterOptions?.communes?.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        <Select value={filters.annee} onChange={handle("annee")}>
          <option value="">Toutes les années</option>
          {filterOptions?.annees?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select value={filters.sup_class} onChange={handle("sup_class")}>
          <option value="">Toutes les classes</option>
          {SUP_CLASSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onReset} className="btn-secondary">
          <RotateCcw size={16} /> Réinitialiser
        </button>
        <button onClick={onExport} className="btn-secondary">
          <Download size={16} /> Exporter CSV
        </button>
        <button onClick={onExportExcel} className="btn-secondary">
          <FileSpreadsheet size={16} /> Exporter Excel
        </button>
        <button onClick={onImportExcel} className="btn-secondary">
          <UploadCloud size={16} /> Importer Excel
        </button>
      </div>
    </div>
  );
}

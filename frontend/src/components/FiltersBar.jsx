import { Search, RotateCcw, Download, FileSpreadsheet, UploadCloud, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input, Select } from "./ui.jsx";
import { SUP_CLASSES, SORT_COLUMNS } from "../utils/constants.js";

export default function FiltersBar({
  filters,
  filterOptions,
  onChange,
  onReset,
  onExport,
  onExportExcel,
  onImportExcel,
  onClearAll,
  completionMode,
  sortBy,
  sortOrder,
  onSort,
}) {
  const handle = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">

      {/* ── Ligne 1 : recherche + filtres ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {/* Recherche plein texte */}
        <div className="relative xl:col-span-2">
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

        <Select value={filters.village ?? ""} onChange={handle("village")}>
          <option value="">Tous les villages</option>
          {filterOptions?.villages?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>

        <Select value={filters.brigade ?? ""} onChange={handle("brigade")}>
          <option value="">Toutes les brigades</option>
          {filterOptions?.brigades?.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>

        <Select value={filters.annee} onChange={handle("annee")}>
          <option value="">Toutes les années</option>
          {filterOptions?.annees?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </div>

      {/* ── Ligne 2 : classe + tri rapide ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtre classe de superficie */}
        <div className="w-48 shrink-0">
          <Select value={filters.sup_class} onChange={handle("sup_class")}>
            <option value="">Toutes les classes</option>
            {SUP_CLASSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        {/* Séparateur */}
        <div className="hidden h-6 w-px bg-gray-200 sm:block" />

        {/* Tri rapide — pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Trier par</span>
          {Object.entries(SORT_COLUMNS).map(([key, label]) => {
            const active = sortBy === key;
            const isAsc = sortOrder === "asc";
            const Icon = active ? (isAsc ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <button
                key={key}
                onClick={() => onSort(key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-forest-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-forest-50 hover:text-forest-700"
                }`}
              >
                {label}
                <Icon size={11} className={active ? "" : "opacity-40"} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Ligne 3 : actions ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <button onClick={onReset} className="btn-secondary">
          <RotateCcw size={15} /> Réinitialiser
        </button>
        <button onClick={onExport} className="btn-secondary">
          <Download size={15} /> Exporter CSV
        </button>
        <button onClick={onExportExcel} className="btn-secondary">
          <FileSpreadsheet size={15} />
          {completionMode ? "Exporter fiches à compléter" : "Exporter Excel"}
        </button>
        <button onClick={onImportExcel} className="btn-secondary">
          <UploadCloud size={15} /> Importer Excel
        </button>
        <button onClick={onClearAll} className="btn-danger ml-auto">
          Vider la BD
        </button>
      </div>
    </div>
  );
}

import { Search, RotateCcw, Download, FileSpreadsheet, UploadCloud, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Select, BrigadeCombobox } from "./ui.jsx";
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

  // Sur mobile, les filtres avancés sont repliés par défaut pour laisser la
  // place aux données (à partir de lg, ils restent toujours visibles).
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeCount = [
    filters.departement,
    filters.commune,
    filters.village,
    filters.brigade,
    filters.annee,
    filters.sup_class,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">

      {/* ── Ligne 1 : recherche plein texte + bouton filtres (mobile) ── */}
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            className="input pl-9"
            placeholder="Rechercher (PDA, village, brigade, producteur...)"
            aria-label="Recherche plein texte"
            value={filters.q}
            onChange={handle("q")}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          aria-controls="filtres-avances"
          className="btn-secondary shrink-0 px-3 lg:hidden"
        >
          <SlidersHorizontal size={16} />
          Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
          <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── Ligne 2 : filtres avancés ── */}
      <div
        id="filtres-avances"
        className={`${showAdvanced ? "grid" : "hidden lg:grid"} grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`}
      >
        <Select value={filters.departement} onChange={handle("departement")} aria-label="Filtrer par département">
          <option value="">Tous les départements</option>
          {filterOptions?.departements?.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>

        <Select value={filters.commune} onChange={handle("commune")} aria-label="Filtrer par commune">
          <option value="">Toutes les communes</option>
          {filterOptions?.communes?.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        <Select value={filters.village ?? ""} onChange={handle("village")} aria-label="Filtrer par village">
          <option value="">Tous les villages</option>
          {filterOptions?.villages?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>

        <BrigadeCombobox
          value={filters.brigade ?? ""}
          onChange={(val) => onChange({ ...filters, brigade: val })}
          options={filterOptions?.brigades ?? []}
          placeholder="Toutes les brigades"
        />

        <Select value={filters.annee} onChange={handle("annee")} aria-label="Filtrer par année">
          <option value="">Toutes les années</option>
          {filterOptions?.annees?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select value={filters.sup_class} onChange={handle("sup_class")} aria-label="Filtrer par classe de superficie">
          <option value="">Toutes les classes</option>
          {SUP_CLASSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {/* ── Ligne 3 : tri rapide ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trier par</span>
        {Object.entries(SORT_COLUMNS).map(([key, label]) => {
          const active = sortBy === key;
          const isAsc = sortOrder === "asc";
          const Icon = active ? (isAsc ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onSort(key)}
              className={`inline-flex min-h-[2.25rem] items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-forest-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-forest-50 hover:text-forest-700"
              }`}
            >
              {label}
              <Icon size={11} className={active ? "" : "opacity-40"} />
            </button>
          );
        })}
      </div>

      {/* ── Ligne 4 : actions ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={onReset} className="btn-secondary">
          <RotateCcw size={15} /> Réinitialiser
        </button>
        <button type="button" onClick={onExport} className="btn-secondary">
          <Download size={15} /> Exporter CSV
        </button>
        <button type="button" onClick={onExportExcel} className="btn-secondary">
          <FileSpreadsheet size={15} />
          {completionMode ? "Exporter fiches à compléter" : "Exporter Excel"}
        </button>
        <button type="button" onClick={onImportExcel} className="btn-secondary">
          <UploadCloud size={15} /> Importer Excel
        </button>
        <button type="button" onClick={onClearAll} className="btn-danger sm:ml-auto">
          Vider la BD
        </button>
      </div>
    </div>
  );
}

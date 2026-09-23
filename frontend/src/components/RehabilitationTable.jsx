import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Spinner, EmptyState } from "./ui.jsx";
import { formatNumber } from "../utils/format.js";
import { SUP_CLASS_COLORS, OPERATIONS, SORT_COLUMNS } from "../utils/constants.js";

const COLUMNS = [
  { key: "selection", label: "Sélection" },
  { key: "pda_number", label: "N° PDA" },
  { key: "village", label: "Localisation" },
  { key: "brigade_name", label: "Brigade" },
  { key: "producer_name", label: "Producteur" },
  { key: "superficie_rehabilitee", label: "Superficie" },
  { key: "annee_rehabilitation", label: "Année" },
  { key: null, label: "Opérations" },
  { key: null, label: "Actions" },
];

function SortIcon({ active, order }) {
  if (!active) return <ArrowUpDown size={14} className="text-gray-300" />;
  return order === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
}

// ─── Barre de tri rapide ──────────────────────────────────────────────────────
function SortBar({ sortBy, sortOrder, onSort }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Trier par
      </span>
      {Object.entries(SORT_COLUMNS).map(([key, label]) => {
        const active = sortBy === key;
        const isAsc = sortOrder === "asc";
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
            {active
              ? isAsc
                ? <ArrowUp size={11} />
                : <ArrowDown size={11} />
              : <ArrowUpDown size={11} className="opacity-40" />}
          </button>
        );
      })}
    </div>
  );
}

export default function RehabilitationTable({
  items,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false,
}) {
  return (
    <div className="space-y-2">
      <SortBar sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {COLUMNS.map((col) => {
              const isSelectionCol = col.key === "selection";
              return (
                <th
                  key={col.label}
                  onClick={isSelectionCol || !col.key ? undefined : () => onSort(col.key)}
                  className={`px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap ${
                    !isSelectionCol && col.key ? "cursor-pointer select-none hover:text-gray-900" : ""
                  }`}
                >
                  {isSelectionCol ? (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
                      aria-label="Tout sélectionner"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon active={sortBy === col.key} order={sortOrder} />}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-16 text-center">
                <div className="flex justify-center"><Spinner /></div>
              </td>
            </tr>
          )}

          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length}>
                <EmptyState message="Aucune fiche de réhabilitation ne correspond aux critères." />
              </td>
            </tr>
          )}

          {!loading &&
            items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
                    aria-label={`Sélectionner la fiche ${item.pda_number}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{item.pda_number}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.village}</div>
                  <div className="text-xs text-gray-500">
                    {item.commune}, {item.arrondissement} — {item.departement}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.brigade_name || "—"}</div>
                  <div className="text-xs text-gray-500">{item.brigade_manager_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.producer_name || "—"}</div>
                  <div className="text-xs text-gray-500">{item.producer_phone}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium">{formatNumber(item.superficie_rehabilitee)} ha</div>
                  <span className={`badge mt-1 ${SUP_CLASS_COLORS[item.sup_class] || "bg-gray-100 text-gray-700"}`}>
                    {item.sup_class}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{item.annee_rehabilitation}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {OPERATIONS.map((op) => {
                      const value = item[`${op.key}_superficie`];
                      if (!value) return null;
                      return (
                        <span key={op.key} className="badge bg-forest-50 text-forest-700 border border-forest-200">
                          {op.label}: {formatNumber(value)} ha
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-forest-50 hover:text-forest-700"
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

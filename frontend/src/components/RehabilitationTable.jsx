import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { EmptyState, SkeletonTable } from "./ui.jsx";
import { formatNumber } from "../utils/format.js";
import { SUP_CLASS_COLORS, OPERATIONS } from "../utils/constants.js";

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
  if (!active) return <ArrowUpDown size={14} className="text-gray-500" />;
  return order === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
}

/** Badges des opérations sylvicoles (vue cartes et tableau). */
function OperationBadges({ item, emptyLabel = "-" }) {
  const filled = OPERATIONS.filter((op) => item[`${op.key}_superficie`]);
  if (filled.length === 0) return <span className="text-xs text-gray-500">{emptyLabel}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {filled.map((op) => (
        <span key={op.key} className="badge border border-forest-200 bg-forest-50 text-forest-700">
          {op.label}: {formatNumber(item[`${op.key}_superficie`])} ha
        </span>
      ))}
    </div>
  );
}

/** Boutons Modifier / Supprimer : cibles tactiles de 44 px, libelles accessibles. */
function RowActions({ item, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="touch rounded-lg text-gray-600 hover:bg-forest-50 hover:text-forest-700"
        aria-label={`Modifier la fiche ${item.pda_number}`}
        title="Modifier"
      >
        <Pencil size={17} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(item)}
        className="touch rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600"
        aria-label={`Supprimer la fiche ${item.pda_number}`}
        title="Supprimer"
      >
        <Trash2 size={17} />
      </button>
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
  if (loading) {
    return <SkeletonTable rows={6} columns={6} />;
  }

  return (
    <div className="space-y-3">
      {/* Vue cartes (mobile) : evite un defilement horizontal de 9 colonnes */}
      <ul className="space-y-2 sm:hidden">
        {items.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <EmptyState message="Aucune fiche de rehabilitation ne correspond aux criteres." />
          </li>
        )}
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggleSelect(item.id)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
                aria-label={`Sélectionner la fiche ${item.pda_number}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-gray-900">{item.pda_number}</p>
                  <span className={`badge shrink-0 ${SUP_CLASS_COLORS[item.sup_class] || "bg-gray-100 text-gray-700"}`}>
                    {item.sup_class}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-600">
                  {[item.village, item.commune, item.departement].filter(Boolean).join(" · ")}
                </p>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-gray-500">Superficie</dt>
                    <dd className="font-medium text-gray-800">{formatNumber(item.superficie_rehabilitee)} ha</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Annee</dt>
                    <dd className="font-medium text-gray-800">{item.annee_rehabilitation}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-500">Brigade</dt>
                    <dd className="text-gray-800">
                      {item.brigade_name || "-"}
                      {item.brigade_manager_name ? ` / ${item.brigade_manager_name}` : ""}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-500">Producteur</dt>
                    <dd className="text-gray-800">
                      {item.producer_name || "-"}
                      {item.producer_phone ? ` / ${item.producer_phone}` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="mt-2">
                  <p className="mb-1 text-xs text-gray-500">Operations</p>
                  <OperationBadges item={item} emptyLabel="Aucune operation renseignee" />
                </div>

                <div className="mt-2 border-t border-gray-100 pt-1">
                  <RowActions item={item} onEdit={onEdit} onDelete={onDelete} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>


      {/* Vue tableau (>= sm) : colonnes figees - selection + numero PDA */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-12 bg-gray-50 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
                  aria-label="Tout selectionner"
                />
              </th>
              {COLUMNS.slice(1).map((col) => {
                const sortable = Boolean(col.key);
                const isPivot = col.key === "pda_number";
                return (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={
                      sortable && sortBy === col.key
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    onClick={sortable ? () => onSort(col.key) : undefined}
                    className={`whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600 ${
                      isPivot ? "sticky left-12 z-20 bg-gray-50" : ""
                    } ${sortable ? "cursor-pointer select-none hover:text-gray-900" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortable && <SortIcon active={sortBy === col.key} order={sortOrder} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <EmptyState message="Aucune fiche de rehabilitation ne correspond aux criteres." />
                </td>
              </tr>
            )}

            {items.map((item) => (
              <tr key={item.id} className="group hover:bg-gray-50">
                <td className="sticky left-0 z-10 w-12 bg-white px-3 py-3 group-hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
                    aria-label={`Selectionner la fiche ${item.pda_number}`}
                  />
                </td>
                <td className="sticky left-12 z-10 whitespace-nowrap bg-white px-4 py-3 font-medium text-gray-900 group-hover:bg-gray-50">
                  {item.pda_number}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.village}</div>
                  <div className="text-xs text-gray-600">
                    {item.commune}, {item.arrondissement} - {item.departement}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.brigade_name || "-"}</div>
                  <div className="text-xs text-gray-600">{item.brigade_manager_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.producer_name || "-"}</div>
                  <div className="text-xs text-gray-600">{item.producer_phone}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium">{formatNumber(item.superficie_rehabilitee)} ha</div>
                  <span className={`badge mt-1 ${SUP_CLASS_COLORS[item.sup_class] || "bg-gray-100 text-gray-700"}`}>
                    {item.sup_class}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{item.annee_rehabilitation}</td>
                <td className="px-4 py-3">
                  <OperationBadges item={item} />
                </td>
                <td className="px-4 py-3">
                  <RowActions item={item} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

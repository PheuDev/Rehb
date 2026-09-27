import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Select } from "./ui.jsx";
import { PAGE_SIZE_OPTIONS } from "../utils/constants.js";

export default function Pagination({ pagination, onPageChange, onLimitChange }) {
  if (!pagination) return null;
  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const navButton = "btn-secondary h-11 w-11 px-0";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-3 py-3 sm:flex-row sm:px-4">
      <div className="flex w-full items-center justify-between gap-2 text-sm text-gray-600 sm:w-auto sm:justify-start">
        <span className="whitespace-nowrap">
          {start}–{end} sur {total}
        </span>
        <Select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          aria-label="Nombre de lignes par page"
          className="w-28"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
      </div>

      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
        <button type="button" aria-label="Première page" title="Première page" className={navButton} disabled={!hasPrev} onClick={() => onPageChange(1)}>
          <ChevronsLeft size={16} />
        </button>
        <button type="button" aria-label="Page précédente" title="Page précédente" className={navButton} disabled={!hasPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-sm text-gray-700 sm:px-3">
          Page {page} / {totalPages}
        </span>
        <button type="button" aria-label="Page suivante" title="Page suivante" className={navButton} disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
        <button type="button" aria-label="Dernière page" title="Dernière page" className={navButton} disabled={!hasNext} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

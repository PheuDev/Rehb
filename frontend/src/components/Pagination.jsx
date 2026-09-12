import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Select } from "./ui.jsx";
import { PAGE_SIZE_OPTIONS } from "../utils/constants.js";

export default function Pagination({ pagination, onPageChange, onLimitChange }) {
  if (!pagination) return null;
  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>
          {start}–{end} sur {total}
        </span>
        <Select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} className="w-24">
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <button className="btn-secondary px-2" disabled={!hasPrev} onClick={() => onPageChange(1)}>
          <ChevronsLeft size={16} />
        </button>
        <button className="btn-secondary px-2" disabled={!hasPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 text-sm text-gray-600">
          Page {page} / {totalPages}
        </span>
        <button className="btn-secondary px-2" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
        <button className="btn-secondary px-2" disabled={!hasNext} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

import { X, Loader2, Inbox, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visibleFocusables(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

// Pile des modales ouvertes : seul le dernier ouvert réagit à Échap.
const modalStack = [];

export function Input({ label, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className={`input ${error ? "border-red-400 focus:ring-red-400" : ""}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className={`input ${error ? "border-red-400 focus:ring-red-400" : ""}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className={`input bg-white ${error ? "border-red-400 focus:ring-red-400" : ""}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "lg" }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const stackKeyRef = useRef(null);
  if (stackKeyRef.current === null) stackKeyRef.current = Symbol("modal");

  // Référence stable : évite de relancer l'effet (donc de re-capter le focus)
  // à chaque rendu du parent quand `onClose` est une fonction inline.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((event) => {
    // Seule la modale la plus récente gère le clavier.
    if (modalStack[modalStack.length - 1] !== stackKeyRef.current) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== "Tab") return;

    const focusables = visibleFocusables(panelRef.current);
    if (focusables.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const key = stackKeyRef.current;

    modalStack.push(key);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Donne le focus au premier champ utile (ou au panneau) à l'ouverture.
    const focusTimer = window.setTimeout(() => {
      const target = visibleFocusables(panelRef.current)[0];
      (target || panelRef.current)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      const index = modalStack.lastIndexOf(key);
      if (index !== -1) modalStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex w-full ${sizes[size]} max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:max-h-[90vh] sm:rounded-xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <h2 id={titleId} className="min-w-0 text-base font-semibold text-gray-900 sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="touch -mr-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * BrigadeCombobox — champ texte avec liste déroulante filtrée.
 * Props :
 *   value      : valeur courante (string)
 *   onChange   : (value: string) => void
 *   options    : string[]
 *   placeholder: string (optionnel)
 */
export function BrigadeCombobox({ value, onChange, options = [], placeholder = "Toutes les brigades" }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef(null);

  // Synchronise si value est modifiée de l'extérieur (ex : reset)
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Ferme la liste si clic hors du composant
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(inputValue.toLowerCase())
  );
  // Index 0 = option « Toutes les brigades », puis les résultats filtrés.
  const choices = ["", ...filtered];

  function handleSelect(option) {
    setInputValue(option);
    onChange(option);
    setOpen(false);
    setHighlight(-1);
  }

  function handleClear() {
    setInputValue("");
    onChange("");
    setOpen(false);
  }

  function handleInputChange(e) {
    setInputValue(e.target.value);
    setOpen(true);
    setHighlight(-1);
    // Si le champ est vidé on efface aussi le filtre
    if (e.target.value === "") onChange("");
  }

  // Navigation clavier : Échap ferme, flèches parcourent, Entrée sélectionne.
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((prev) => {
        const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
        if (next < 0) return choices.length - 1;
        if (next >= choices.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === "Enter" && open && highlight >= 0) {
      e.preventDefault();
      handleSelect(choices[highlight]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          className="input w-full pr-10"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {inputValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Effacer ce filtre"
            className="absolute right-0 mr-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={15} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 text-gray-500"
          />
        )}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {/* Option "toutes" */}
          <li
            onMouseDown={() => handleSelect("")}
            className={`cursor-pointer px-3 py-2 hover:bg-forest-50 hover:text-forest-700 ${
              value === "" ? "font-semibold text-forest-700" : "text-gray-600"
            } ${highlight === 0 ? "bg-forest-50" : ""}`}
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 italic text-gray-500">Aucun résultat</li>
          ) : (
            filtered.map((o, index) => (
              <li
                key={o}
                onMouseDown={() => handleSelect(o)}
                className={`cursor-pointer px-3 py-2 hover:bg-forest-50 hover:text-forest-700 ${
                  value === o ? "bg-forest-50 font-semibold text-forest-700" : "text-gray-700"
                } ${highlight === index + 1 ? "bg-forest-50" : ""}`}
              >
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function Spinner({ size = 24 }) {
  return <Loader2 className="animate-spin text-forest-600" size={size} />;
}

/**
 * Squelettes de chargement — remplacent les spinners centrés pour éviter
 * les sauts de mise en page (CLS) et donner un aperçu de la structure.
 */
export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export function SkeletonTable({ rows = 6, columns = 5, className = "" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}
    >
      <span className="sr-only">Chargement des données…</span>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-3">
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton key={colIndex} className={`h-4 ${colIndex === 0 ? "w-24" : "flex-1"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 4, className = "" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${className}`}
    >
      <span className="sr-only">Chargement des données…</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message = "Aucune donnée trouvée." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-500 sm:py-16">
      <Inbox size={32} className="text-gray-500 sm:h-10 sm:w-10" />
      <p className="text-sm">{message}</p>
    </div>
  );
}


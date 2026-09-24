import { X, Loader2, Inbox, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${sizes[size]} max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col`}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
        {footer && <div className="border-t px-6 py-4 flex justify-end gap-2">{footer}</div>}
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

  function handleSelect(option) {
    setInputValue(option);
    onChange(option);
    setOpen(false);
  }

  function handleClear() {
    setInputValue("");
    onChange("");
    setOpen(false);
  }

  function handleInputChange(e) {
    setInputValue(e.target.value);
    setOpen(true);
    // Si le champ est vidé on efface aussi le filtre
    if (e.target.value === "") onChange("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          className="input pr-8 w-full"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {inputValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 text-gray-400"
          />
        )}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-sm">
          {/* Option "toutes" */}
          <li
            onMouseDown={() => handleSelect("")}
            className={`cursor-pointer px-3 py-1.5 hover:bg-forest-50 hover:text-forest-700 ${
              value === "" ? "font-semibold text-forest-700" : "text-gray-500"
            }`}
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-gray-400 italic">Aucun résultat</li>
          ) : (
            filtered.map((o) => (
              <li
                key={o}
                onMouseDown={() => handleSelect(o)}
                className={`cursor-pointer px-3 py-1.5 hover:bg-forest-50 hover:text-forest-700 ${
                  value === o ? "font-semibold text-forest-700 bg-forest-50" : "text-gray-700"
                }`}
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

export function EmptyState({ message = "Aucune donnée trouvée." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
      <Inbox size={40} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

import { X, Loader2, Inbox } from "lucide-react";

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

import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg sm:inset-x-auto sm:right-4 sm:max-w-md"
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 shrink-0 text-forest-600" size={20} />
      ) : (
        <XCircle className="mt-0.5 shrink-0 text-red-600" size={20} />
      )}
      <p className="min-w-0 flex-1 text-sm text-gray-700">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la notification"
        className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <X size={16} />
      </button>
    </div>
  );
}


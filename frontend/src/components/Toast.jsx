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
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg">
      {isSuccess ? (
        <CheckCircle2 className="text-forest-600" size={20} />
      ) : (
        <XCircle className="text-red-600" size={20} />
      )}
      <p className="text-sm text-gray-700">{toast.message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>
    </div>
  );
}

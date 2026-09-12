import { Modal } from "./ui.jsx";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title || "Confirmation"}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Suppression..." : "Supprimer"}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </Modal>
  );
}

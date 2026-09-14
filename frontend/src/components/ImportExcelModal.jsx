import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";
import { Modal } from "./ui.jsx";
import { importExcel, downloadImportTemplate } from "../api/rehabilitations.js";

export default function ImportExcelModal({ open, onClose, onImported }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const data = await importExcel(file);
      setResult(data);
      if (data.importees > 0) onImported();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de l'import du fichier.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importer des fiches depuis Excel"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>Fermer</button>
          <button className="btn-primary" onClick={handleImport} disabled={!file || importing}>
            {importing ? "Import en cours..." : "Importer"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          <p className="mb-2">
            Le fichier doit respecter exactement la même structure de colonnes que le fichier source
            (feuille <strong>REHAB-2024</strong>).
          </p>
          <button
            type="button"
            onClick={downloadImportTemplate}
            className="inline-flex items-center gap-1 font-medium text-forest-700 hover:underline"
          >
            <FileSpreadsheet size={14} /> Télécharger le modèle Excel à remplir
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-forest-400">
          <UploadCloud className="text-gray-400" size={28} />
          <span className="text-sm text-gray-600">
            {file ? file.name : "Cliquez pour choisir un fichier .xlsx"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg bg-forest-50 p-3 text-sm text-forest-700">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                {result.importees} fiche(s) importée(s) avec succès sur {result.total} ligne(s) traitée(s).
              </span>
            </div>
            {result.aCompleter > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <ClipboardList size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  {result.aCompleter} fiche(s) contiennent des informations manquantes ou illisibles.
                  Retrouvez-les dans l'onglet « Fiches à compléter » : vous pourrez exporter la
                  liste en Excel, avec les emplacements vides colorés en rouge.
                </span>
              </div>
            )}

            {result.erreurs?.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="mb-1 font-medium">{result.erreurs.length} ligne(s) ignorée(s) :</p>
                <ul className="space-y-1">
                  {result.erreurs.map((e) => (
                    <li key={e.ligne}>
                      Ligne {e.ligne} : {e.erreurs.join(" ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

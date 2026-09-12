import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Modal, Input, Textarea } from "./ui.jsx";
import { EMPTY_FORM, OPERATIONS, SUP_CLASS_COLORS, FORM_STEPS } from "../utils/constants.js";
import { computeSupClass } from "../utils/format.js";

const PHONE_REGEX = /^[0-9+\-\s]{6,20}$/;

function validateField(field, form) {
  switch (field) {
    case "pda_number":
      return form.pda_number?.trim() ? null : "Le N° PDA est obligatoire.";
    case "departement":
      return form.departement?.trim() ? null : "Le département est obligatoire.";
    case "commune":
      return form.commune?.trim() ? null : "La commune est obligatoire.";
    case "arrondissement":
      return form.arrondissement?.trim() ? null : "L'arrondissement est obligatoire.";
    case "village":
      return form.village?.trim() ? null : "Le village est obligatoire.";
    case "annee_rehabilitation": {
      const annee = Number(form.annee_rehabilitation);
      return !annee || annee < 1990 || annee > 2100
        ? "L'année doit être comprise entre 1990 et 2100."
        : null;
    }
    case "superficie_rehabilitee": {
      const s = Number(form.superficie_rehabilitee);
      return form.superficie_rehabilitee === "" || Number.isNaN(s) || s < 0
        ? "La superficie réhabilitée est obligatoire et doit être positive."
        : null;
    }
    default: {
      if (field.endsWith("_phone")) {
        const value = form[field];
        if (value && !PHONE_REGEX.test(value)) {
          return "Format de téléphone invalide (6 à 20 caractères : chiffres, +, espaces, tirets).";
        }
      }
      if (field.endsWith("_superficie")) {
        const value = form[field];
        if (value !== "" && value !== null && value !== undefined && Number(value) < 0) {
          return "La superficie doit être positive.";
        }
      }
      return null;
    }
  }
}

function validateStep(step, form) {
  const errors = {};
  step.fields.forEach((field) => {
    const error = validateField(field, form);
    if (error) errors[field] = error;
  });
  return errors;
}

function validateAll(form) {
  let errors = {};
  FORM_STEPS.forEach((step) => {
    errors = { ...errors, ...validateStep(step, form) };
  });
  return errors;
}

function toPayload(form) {
  const numericFields = [
    "annee_rehabilitation",
    "superficie_rehabilitee",
    "desherbage_superficie",
    "eclaircie_superficie",
    "elagage_superficie",
    "debardage_superficie",
  ];
  const payload = { ...form };
  numericFields.forEach((field) => {
    payload[field] = payload[field] === "" ? null : Number(payload[field]);
  });
  payload.annee_rehabilitation = Number(form.annee_rehabilitation);
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });
  return payload;
}

/** Navigation latérale : une entrée par section du formulaire. */
function SectionNav({ currentIndex, furthestIndex, stepHasError, onJump }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 sm:w-48 sm:flex-shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:pb-0 sm:pr-4">
      {FORM_STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        const isReachable = index <= furthestIndex;
        const hasError = stepHasError(step);
        return (
          <button
            key={step.key}
            type="button"
            disabled={!isReachable}
            onClick={() => isReachable && onJump(index)}
            className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:flex-shrink ${
              isCurrent
                ? "bg-forest-600 text-white"
                : isReachable
                ? "text-gray-700 hover:bg-forest-50"
                : "cursor-not-allowed text-gray-300"
            }`}
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                isCurrent
                  ? "border-white text-white"
                  : isDone
                  ? "border-forest-600 bg-forest-50 text-forest-700"
                  : "border-gray-300 text-gray-400"
              }`}
            >
              {isDone ? <Check size={13} /> : index + 1}
            </span>
            <span className="whitespace-nowrap sm:whitespace-normal">{step.label}</span>
            {hasError && <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />}
          </button>
        );
      })}
    </nav>
  );
}

export default function RehabilitationFormModal({ open, initialData, onClose, onSubmit, submitting, serverErrors }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
      setErrors({});
      setStepIndex(0);
      // En édition, toutes les sections sont déjà accessibles (les données existent déjà).
      setFurthestIndex(initialData ? FORM_STEPS.length - 1 : 0);
    }
  }, [open, initialData]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const currentStep = FORM_STEPS[stepIndex];
  const isLastStep = stepIndex === FORM_STEPS.length - 1;
  const allErrors = { ...errors, ...(serverErrors || {}) };
  const stepHasError = (step) => step.fields.some((f) => allErrors[f]);

  function goToStep(index) {
    // En avançant vers une section pas encore validée, on valide d'abord la section courante.
    if (index > stepIndex) {
      const stepErrors = validateStep(currentStep, form);
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      if (Object.keys(stepErrors).length > 0) return;
    }
    setStepIndex(index);
    setFurthestIndex((prev) => Math.max(prev, index));
  }

  function handleNext() {
    goToStep(Math.min(stepIndex + 1, FORM_STEPS.length - 1));
  }

  function handlePrevious() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!isLastStep) {
      handleNext();
      return;
    }
    const validationErrors = validateAll(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstBadStepIndex = FORM_STEPS.findIndex((step) =>
        step.fields.some((f) => validationErrors[f])
      );
      if (firstBadStepIndex !== -1) {
        setFurthestIndex((prev) => Math.max(prev, firstBadStepIndex));
        setStepIndex(firstBadStepIndex);
      }
      return;
    }
    onSubmit(toPayload(form));
  }

  const supClassPreview = computeSupClass(form.superficie_rehabilitee);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Modifier la fiche de réhabilitation" : "Nouvelle fiche de réhabilitation"}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <button type="button" className="btn-secondary" onClick={handlePrevious} disabled={stepIndex === 0 || submitting}>
            Précédent
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" form="rehab-form" className="btn-primary" disabled={submitting}>
              {isLastStep ? (submitting ? "Enregistrement..." : "Enregistrer") : "Suivant"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <SectionNav
          currentIndex={stepIndex}
          furthestIndex={furthestIndex}
          stepHasError={stepHasError}
          onJump={goToStep}
        />

        <div className="min-w-0 flex-1">
          <p className="mb-4 text-sm text-gray-500">
            Section {stepIndex + 1} / {FORM_STEPS.length} — {currentStep.label}
          </p>

          <form id="rehab-form" onSubmit={handleSubmit} className="space-y-4">
            {currentStep.key === "identification" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="N° PDA *" value={form.pda_number} onChange={handleChange("pda_number")} error={allErrors.pda_number} />
                <Input label="Année de réhabilitation *" type="number" min={1990} max={2100} value={form.annee_rehabilitation} onChange={handleChange("annee_rehabilitation")} error={allErrors.annee_rehabilitation} />
                <Input label="Département *" value={form.departement} onChange={handleChange("departement")} error={allErrors.departement} />
                <Input label="Commune *" value={form.commune} onChange={handleChange("commune")} error={allErrors.commune} />
                <Input label="Arrondissement *" value={form.arrondissement} onChange={handleChange("arrondissement")} error={allErrors.arrondissement} />
                <Input label="Village *" value={form.village} onChange={handleChange("village")} error={allErrors.village} />
              </div>
            )}

            {currentStep.key === "brigade" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nom de la brigade" value={form.brigade_name} onChange={handleChange("brigade_name")} error={allErrors.brigade_name} className="sm:col-span-2" />
                <Input label="Responsable de la brigade" value={form.brigade_manager_name} onChange={handleChange("brigade_manager_name")} error={allErrors.brigade_manager_name} />
                <Input label="Téléphone du responsable" value={form.brigade_manager_phone} onChange={handleChange("brigade_manager_phone")} error={allErrors.brigade_manager_phone} />
              </div>
            )}

            {currentStep.key === "producteur" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nom et prénom du producteur" value={form.producer_name} onChange={handleChange("producer_name")} error={allErrors.producer_name} />
                <Input label="Téléphone du producteur" value={form.producer_phone} onChange={handleChange("producer_phone")} error={allErrors.producer_phone} />
              </div>
            )}

            {currentStep.key === "superficie" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
                <Input
                  label="Superficie réhabilitée (ha) *"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.superficie_rehabilitee}
                  onChange={handleChange("superficie_rehabilitee")}
                  error={allErrors.superficie_rehabilitee}
                />
                <div>
                  <label className="label">Classe de superficie (calculée)</label>
                  <span className={`badge ${SUP_CLASS_COLORS[supClassPreview] || "bg-gray-100 text-gray-700"}`}>
                    {supClassPreview}
                  </span>
                </div>
              </div>
            )}

            {currentStep.key === "operations" && (
              <div className="space-y-4">
                {OPERATIONS.map((op) => (
                  <div key={op.key} className="rounded-lg border border-gray-200 p-3">
                    <p className="mb-2 text-sm font-medium text-gray-700">{op.label}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Input
                        label="Superficie (ha)"
                        type="number"
                        step="0.01"
                        min={0}
                        value={form[`${op.key}_superficie`]}
                        onChange={handleChange(`${op.key}_superficie`)}
                        error={allErrors[`${op.key}_superficie`]}
                      />
                      <Input
                        label="Opérateur"
                        value={form[`${op.key}_operateur_nom`]}
                        onChange={handleChange(`${op.key}_operateur_nom`)}
                        error={allErrors[`${op.key}_operateur_nom`]}
                      />
                      <Input
                        label="Téléphone (Momo)"
                        value={form[`${op.key}_operateur_phone`]}
                        onChange={handleChange(`${op.key}_operateur_phone`)}
                        error={allErrors[`${op.key}_operateur_phone`]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep.key === "observations" && (
              <Textarea rows={5} value={form.observations} onChange={handleChange("observations")} placeholder="Remarques complémentaires..." />
            )}
          </form>
        </div>
      </div>
    </Modal>
  );
}

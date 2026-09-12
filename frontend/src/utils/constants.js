export const SUP_CLASSES = ["S ≤ 5 ha", "5 < S ≤ 10 ha", "10 < S ≤ 20 ha", "S > 20 ha"];

export const SUP_CLASS_COLORS = {
  "S ≤ 5 ha": "bg-gray-100 text-gray-700",
  "5 < S ≤ 10 ha": "bg-forest-100 text-forest-700",
  "10 < S ≤ 20 ha": "bg-amber-100 text-amber-700",
  "S > 20 ha": "bg-emerald-100 text-emerald-800",
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const OPERATIONS = [
  { key: "desherbage", label: "Désherbage" },
  { key: "eclaircie", label: "Éclaircie / Débitage" },
  { key: "elagage", label: "Élagage / Débitage" },
  { key: "debardage", label: "Débardage" },
];

export const EMPTY_FORM = {
  pda_number: "",
  departement: "",
  commune: "",
  arrondissement: "",
  village: "",
  annee_rehabilitation: new Date().getFullYear(),
  brigade_name: "",
  brigade_manager_name: "",
  brigade_manager_phone: "",
  producer_name: "",
  producer_phone: "",
  superficie_rehabilitee: "",
  desherbage_superficie: "",
  desherbage_operateur_nom: "",
  desherbage_operateur_phone: "",
  eclaircie_superficie: "",
  eclaircie_operateur_nom: "",
  eclaircie_operateur_phone: "",
  elagage_superficie: "",
  elagage_operateur_nom: "",
  elagage_operateur_phone: "",
  debardage_superficie: "",
  debardage_operateur_nom: "",
  debardage_operateur_phone: "",
  observations: "",
};

/**
 * Découpage du formulaire "Nouvelle fiche" en étapes, pour ne pas montrer
 * tous les champs d'un coup. Chaque étape liste les champs qu'elle valide
 * avant de laisser passer à la suivante.
 */
export const FORM_STEPS = [
  { key: "identification", label: "Identification", fields: ["pda_number", "departement", "commune", "arrondissement", "village", "annee_rehabilitation"] },
  { key: "brigade", label: "Brigade", fields: ["brigade_name", "brigade_manager_name", "brigade_manager_phone"] },
  { key: "producteur", label: "Producteur", fields: ["producer_name", "producer_phone"] },
  { key: "superficie", label: "Superficie", fields: ["superficie_rehabilitee"] },
  {
    key: "operations",
    label: "Opérations",
    fields: [
      "desherbage_superficie", "desherbage_operateur_nom", "desherbage_operateur_phone",
      "eclaircie_superficie", "eclaircie_operateur_nom", "eclaircie_operateur_phone",
      "elagage_superficie", "elagage_operateur_nom", "elagage_operateur_phone",
      "debardage_superficie", "debardage_operateur_nom", "debardage_operateur_phone",
    ],
  },
  { key: "observations", label: "Observations", fields: ["observations"] },
];

export const SORT_COLUMNS = {
  pda_number: "N° PDA",
  village: "Village",
  commune: "Commune",
  departement: "Département",
  brigade_name: "Brigade",
  producer_name: "Producteur",
  superficie_rehabilitee: "Superficie",
  sup_class: "Classe",
  annee_rehabilitation: "Année",
  created_at: "Créée le",
};

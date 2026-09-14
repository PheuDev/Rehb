"""
Utilitaires Excel : export, import et génération du modèle.

La structure des colonnes reproduit fidèlement le fichier source original
"Architecture_complète.xls" (feuille "REHAB-2024"), afin que le modèle
téléchargé, l'export et l'import restent parfaitement cohérents entre eux.
"""

import io
from datetime import datetime
from typing import Any, List, Tuple

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from pydantic import ValidationError

from app.schemas import RehabilitationCreate
from app.completion import COMPLETION_FIELDS, is_missing, missing_fields

SHEET_NAME = "REHAB-2024"

# (en-tête Excel, champ interne, type, obligatoire)
COLUMNS: List[Tuple[str, str, type, bool]] = [
    ("N°PDA", "pda_number", str, True),
    ("DEPARTEMENT", "departement", str, True),
    ("COMMUNE", "commune", str, True),
    ("ARRONDISSEMENT", "arrondissement", str, True),
    ("VILLAGE", "village", str, True),
    ("NOM ET PRENOM DU RESPONSABLE DE LA BRIGADE", "brigade_manager_name", str, False),
    ("N°TELEPHONE FONCTIONNEL DU RESPONSABLE", "brigade_manager_phone", str, False),
    ("NOM DE LA BRIGADE", "brigade_name", str, False),
    ("NOM ET PRENOM DU PRODUCTEUR BENEFICIAIRE", "producer_name", str, False),
    ("N°TELEPHONE FONCTIONNEL DU PRODUCTEUR BENEFICIAIRE", "producer_phone", str, False),
    ("SUPERFICIE (HA) REHABILITEE", "superficie_rehabilitee", float, True),
    ("ANNEE DE LA REHABILITATION", "annee_rehabilitation", int, True),
    ("DESHERBAGE (SUPERFICIE EN HA)", "desherbage_superficie", float, False),
    ("NOM ET PRENOM DE L'OPERATEUR DU DESHERBAGE", "desherbage_operateur_nom", str, False),
    ("N°TELEPHONE FONCTIONNEL (MOMO) DE L'OPERATEUR DU DESHERBAGE", "desherbage_operateur_phone", str, False),
    ("ECLAIRCIE/DEBITAGE (SUPERFICIE EN HA)", "eclaircie_superficie", float, False),
    ("NOM ET PRENOM DE L'OPERATEUR DE L'ECLAIRCIE", "eclaircie_operateur_nom", str, False),
    ("N°TELEPHONE FONCTIONNEL (MOMO) DE L'OPERATEUR DE L'ECLAIRCIE/DEBITAGE", "eclaircie_operateur_phone", str, False),
    ("ELAGAGE/DEBITAGE (SUPERFICIE EN HA)", "elagage_superficie", float, False),
    ("NOM ET PRENOM DE L'OPERATEUR DE L'ELAGAGE/DEBITAGE", "elagage_operateur_nom", str, False),
    ("N°TELEPHONE FONCTIONNEL (MOMO) DE L'OPERATEUR DE L'ELAGAGE", "elagage_operateur_phone", str, False),
    ("DEBARDAGE (SUPERFICIE EN HA)", "debardage_superficie", float, False),
    ("NOM ET PRENOM DE L'OPERATEUR DE DEBARDAGE", "debardage_operateur_nom", str, False),
    ("N°TELEPHONE FONCTIONNEL (MOMO) DE L'OPERATEUR DE DEBARDAGE", "debardage_operateur_phone", str, False),
    ("OBSERVATIONS", "observations", str, False),
]

# Colonnes calculées, affichées uniquement à l'export (jamais attendues à l'import)
EXPORT_ONLY_COLUMNS: List[Tuple[str, str]] = [("SUP_CLASS", "sup_class")]

HEADER_FILL = PatternFill(start_color="2D6846", end_color="2D6846", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
MISSING_FILL = PatternFill(start_color="FECACA", end_color="FECACA", fill_type="solid")


def _normalize(label: str) -> str:
    return " ".join(str(label).strip().upper().split())


def _type_hint(ftype: type) -> str:
    return {str: "Texte", float: "Nombre décimal (ex : 3.5)", int: "Nombre entier"}.get(ftype, "Texte")


# ---------------------------------------------------------------------------
# Génération du modèle Excel à remplir (mêmes colonnes que le fichier source)
# ---------------------------------------------------------------------------
def build_template_workbook() -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET_NAME

    headers = [c[0] for c in COLUMNS]
    ws.append(headers)
    for col_idx, _ in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = 24
    ws.freeze_panes = "A2"

    notes = wb.create_sheet("Instructions")
    notes.append(["Colonne", "Obligatoire", "Format attendu"])
    for label, _, ftype, required in COLUMNS:
        notes.append([label, "Oui" if required else "Non", _type_hint(ftype)])
    notes.append([])
    notes.append(["La colonne SUP_CLASS n'est pas demandée : elle est calculée automatiquement."])
    notes.append(["Ne modifiez pas les en-têtes de la feuille 'REHAB-2024' : l'import s'appuie dessus."])
    notes.append(["Les cellules peuvent rester vides (informations pas encore disponibles) : la fiche est importée quand même et apparaît dans l'onglet « Fiches à compléter » ; son export Excel colore les emplacements vides en rouge."])
    for col_idx, width in enumerate([45, 14, 30], start=1):
        notes.column_dimensions[get_column_letter(col_idx)].width = width
    for cell in notes[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL

    return wb


# ---------------------------------------------------------------------------
# Export des fiches existantes vers un fichier Excel (respecte les filtres)
# ---------------------------------------------------------------------------
def build_export_workbook(rows) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET_NAME

    all_columns = COLUMNS + [(label, field, str, False) for label, field in EXPORT_ONLY_COLUMNS]
    headers = [c[0] for c in all_columns]
    ws.append(headers)
    for col_idx, _ in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        ws.column_dimensions[get_column_letter(col_idx)].width = 22
    ws.freeze_panes = "A2"

    for row in rows:
        values = []
        for _, field, _, _ in all_columns:
            values.append(getattr(row, field, None))
        ws.append(values)

    return wb


def build_incomplete_export_workbook(rows) -> Workbook:
    """Exporte les fiches incomplètes en colorant chaque donnée absente en rouge."""
    wb = build_export_workbook(rows)
    ws = wb.active
    field_to_column = {field: index for index, (_, field, _, _) in enumerate(COLUMNS, start=1)}

    # Une colonne explicite rend aussi l'export lisible sans devoir inspecter
    # chaque cellule colorée.
    missing_column = len(COLUMNS) + len(EXPORT_ONLY_COLUMNS) + 1
    header = ws.cell(row=1, column=missing_column, value="INFORMATIONS À COMPLÉTER")
    header.fill = HEADER_FILL
    header.font = HEADER_FONT
    header.alignment = Alignment(wrap_text=True, vertical="center")
    ws.column_dimensions[get_column_letter(missing_column)].width = 45

    for row_index, row in enumerate(rows, start=2):
        for _, field in COMPLETION_FIELDS:
            if is_missing(getattr(row, field, None)):
                ws.cell(row=row_index, column=field_to_column[field]).fill = MISSING_FILL
        ws.cell(row=row_index, column=missing_column, value=", ".join(missing_fields(row)))
        ws.cell(row=row_index, column=missing_column).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[row_index].height = 42

    ws.auto_filter.ref = f"A1:{get_column_letter(missing_column)}{max(ws.max_row, 1)}"
    return wb


# ---------------------------------------------------------------------------
# Lecture / validation d'un fichier Excel importé
# ---------------------------------------------------------------------------
def _convert_value(raw: Any, ftype: type):
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        return None
    if ftype is str:
        # Excel stocke souvent les téléphones/N° PDA en nombre : on évite le
        # "96637137.0" en convertissant les flottants entiers.
        if isinstance(raw, float) and raw.is_integer():
            raw = int(raw)
        return str(raw).strip()
    if ftype is float:
        if isinstance(raw, str):
            raw = raw.replace(",", ".").strip()
            # Saisies fréquentes : lettre "O" à la place du zéro ("2,O7").
            if raw and not raw.isdigit():
                raw = raw.replace("O", "0").replace("o", "0")
        return float(raw)
    if ftype is int:
        if isinstance(raw, str):
            # Séparateurs de milliers : "2 024" (espace/insécable) -> "2024".
            raw = raw.replace(" ", "").replace("\u00a0", "").strip()
        return int(float(raw))
    return raw


def parse_import_workbook(content: bytes):
    """Lit un fichier Excel importe.

    Retourne (payloads_valides, erreurs, nb_a_completer).

    Tolerance : une cellule vide ou illisible (format invalide, ex : « 2,O7 »)
    ne rejette PLUS la ligne entière. La donnée est laissée vide, la valeur
    d'origine est conservée en note dans Observations, et la fiche importée
    est comptée dans `nb_a_completer` pour apparaître dans l'onglet
    « Fiches à compléter » (export Excel avec cellules vides en rouge).
    """
    wb = load_workbook(io.BytesIO(content), data_only=True)
    ws = wb[SHEET_NAME] if SHEET_NAME in wb.sheetnames else wb.active

    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
    header_index = {}
    for idx, raw_label in enumerate(header_row):
        if raw_label is None:
            continue
        header_index[_normalize(raw_label)] = idx

    field_labels = {field: label for label, field, _, _ in COLUMNS}

    valid_payloads: List[RehabilitationCreate] = []
    errors = []
    incomplete_count = 0

    for row_number, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if row is None or all(cell in (None, "") for cell in row):
            continue  # ligne vide, on l'ignore silencieusement

        data = {}
        avertissements = []
        for label, field, ftype, _ in COLUMNS:
            col_idx = header_index.get(_normalize(label))
            raw_value = row[col_idx] if col_idx is not None and col_idx < len(row) else None
            try:
                data[field] = _convert_value(raw_value, ftype)
            except (ValueError, TypeError):
                data[field] = None
                if raw_value is not None and str(raw_value).strip() != "":
                    avertissements.append(
                        f"{label} : valeur « {raw_value} » illisible, laissée vide."
                    )

        # Pydantic peut encore rejeter une valeur convertie (téléphone avec
        # caractères interdits, année hors bornes, nombre négatif...) : on
        # neutralise le champ fautif et on réessaie, au lieu d'écarter la
        # fiche entière.
        payload = None
        for _attempt in range(2):
            try:
                payload = RehabilitationCreate(**data)
                break
            except ValidationError as exc:
                faulty_fields = [
                    err["loc"][0]
                    for err in exc.errors()
                    if err.get("loc") and isinstance(err["loc"][0], str)
                ]
                if not faulty_fields or _attempt == 1:
                    errors.append({
                        "ligne": row_number,
                        "erreurs": [err.get("msg", "Champ invalide.") for err in exc.errors()],
                    })
                    break
                for field in faulty_fields:
                    if data.get(field) not in (None, ""):
                        avertissements.append(
                            f"{field_labels.get(field, field)} : valeur non conforme, laissée vide."
                        )
                    data[field] = None

        if payload is None:
            continue

        # On garde la trace des valeurs d'origine illisibles directement dans
        # la fiche, pour que l'utilisateur sache quoi corriger et o\u00f9.
        if avertissements:
            note = "Import Excel - à vérifier : " + " ; ".join(avertissements)
            data["observations"] = (
                f"{data['observations']}\n{note}" if data.get("observations") else note
            )
            payload = RehabilitationCreate(**data)

        if missing_fields(payload):
            incomplete_count += 1

        valid_payloads.append(payload)

    return valid_payloads, errors, incomplete_count

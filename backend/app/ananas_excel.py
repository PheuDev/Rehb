"""Excel structure and typed import/export helpers for the Ananas system."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from io import BytesIO
from typing import Any
import unicodedata

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
import xlrd


SHEET_NAME = "Plantations Ananas"
COORDINATE_HEADER = "Coordonnées Géographiques"
HEADERS = [
    "N",
    "Nom et prénoms",
    "Sexe",
    "Commune",
    "Arrondissement",
    "Village/Hameau",
    COORDINATE_HEADER,
    None,  # La cellule est comprise dans l'en-tête fusionné G1:H1 de la pièce jointe.
    "Superficie déclarée (ha)",
    "Superficie trackée (ha)",
    "Type de friche",
    "Type d’espèce végétale",
    "Type de sol",
    "Précédents culturaux",
    "Décision de l'équipe de validation",
    "Décision ATDA7",
    "Sup attribuée / confirmée (ha)",
]

WIDTHS = [8, 28, 10, 18, 20, 22, 16, 16, 20, 20, 22, 24, 20, 24, 28, 20, 24]
TEXT_FIELDS = {
    1: "nom_prenoms",
    2: "sexe",
    3: "commune",
    4: "arrondissement",
    5: "village_hameau",
    10: "type_friche",
    11: "type_espece_vegetale",
    12: "type_sol",
    13: "precedents_culturaux",
    14: "decision_equipe_validation",
    15: "decision_atda7",
}
NUMERIC_FIELDS = {
    6: "coord_x",
    7: "coord_y",
    8: "superficie_declaree",
    9: "superficie_trackee",
    16: "superficie_confirmee",
}


def _decimal_value(value: Any, *, integer: bool = False) -> Decimal | int | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError("une valeur booléenne n'est pas un nombre valide")
    try:
        parsed = Decimal(str(value).strip().replace(" ", "").replace(",", ".").replace(";", "."))
    except (InvalidOperation, ValueError):
        raise ValueError("une valeur numérique est attendue")
    if not parsed.is_finite():
        raise ValueError("le nombre doit être fini")
    if integer:
        if parsed != parsed.to_integral_value():
            raise ValueError("un nombre entier est attendu")
        return int(parsed)
    if parsed < 0:
        raise ValueError("la valeur ne peut pas être négative")
    return parsed


def _text_value(value: Any, header: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"une valeur texte est attendue dans « {header} »")
    cleaned = value.strip()
    return cleaned or None


def _coordinate_value(value: Any) -> Decimal | None:
    if isinstance(value, str):
        text = value.strip().replace("º", "°").replace(" ", "").rstrip("°").strip()
        # The supplied workbook mixes projected coordinates, decimal degrees,
        # and degree/minute strings such as 6°37.8580 or 6°536281.
        degree_separator = text.find("°")
        if degree_separator < 0 and text.count(".") + text.count(",") > 1:
            degree_separator = min(position for position in (text.find("."), text.find(",")) if position >= 0)
        if degree_separator >= 0:
            degrees_text = text[:degree_separator]
            minutes_text = text[degree_separator + 1:].replace(",", ".")
            if "." not in minutes_text and len(minutes_text) > 2:
                minutes_text = f"{minutes_text[:2]}.{minutes_text[2:]}"
            try:
                degrees = Decimal(degrees_text)
                minutes = Decimal(minutes_text)
            except InvalidOperation as exc:
                raise ValueError("une coordonnée numérique est attendue") from exc
            return (degrees + minutes / Decimal("60")).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        if "O" in text or "o" in text:
            text = text.replace("O", "0").replace("o", "0")
        value = text
    return _decimal_value(value)


def _normalize_header(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    decomposed = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(char for char in decomposed if char.isalnum())


def _validate_header_values(actual: list[Any]) -> None:
    for index, expected in enumerate(HEADERS):
        if expected is None:
            continue
        if _normalize_header(actual[index]) != _normalize_header(expected):
            cell = get_column_letter(index + 1)
            raise ValueError(
                f"L'en-tête {cell}1 ne correspond pas au modèle Ananas : "
                f"« {actual[index] or 'vide'} » au lieu de « {expected} »."
            )
    if actual[7] not in (None, ""):
        raise ValueError("La cellule H1 doit rester vide sous l'en-tête fusionné G1:H1.")


def _has_xy_subheaders(get_value) -> bool:
    return (get_value(1, 6), get_value(1, 7)) == ("X", "Y")


def _validate_xlsx_headers(ws) -> int:
    actual = [ws.cell(1, column).value for column in range(1, len(HEADERS) + 1)]
    _validate_header_values(actual)
    if any(ws.cell(1, column).value not in (None, "") for column in range(len(HEADERS) + 1, ws.max_column + 1)):
        raise ValueError("Le classeur contient des colonnes supplémentaires après « Sup attribuée / confirmée (ha) ».")
    if "G1:H1" not in {str(rng) for rng in ws.merged_cells.ranges}:
        raise ValueError("L'en-tête « Coordonnées Géographiques » doit être fusionné de G1 à H1.")

    if _has_xy_subheaders(lambda row, col: ws.cell(row + 1, col + 1).value):
        if any(ws.cell(2, column).value not in (None, "") for column in (*range(1, 7), *range(9, len(HEADERS) + 1))):
            raise ValueError("La deuxième ligne d'en-tête doit contenir uniquement X en G et Y en H.")
        if any(ws.cell(2, column).value not in (None, "") for column in range(len(HEADERS) + 1, ws.max_column + 1)):
            raise ValueError("Le classeur contient des en-têtes supplémentaires sur la deuxième ligne.")
        return 3
    return 2


def _validate_xls_headers(sheet) -> int:
    actual = [sheet.cell_value(0, column) if column < sheet.ncols else None for column in range(len(HEADERS))]
    _validate_header_values(actual)
    if sheet.ncols > len(HEADERS) and any(sheet.cell_value(0, column) not in (None, "") for column in range(len(HEADERS), sheet.ncols)):
        raise ValueError("Le classeur contient des colonnes supplémentaires après « Sup attribuée / confirmée (ha) ».")
    if (0, 1, 6, 8) not in sheet.merged_cells:
        raise ValueError("L'en-tête « Coordonnées Géographiques » doit être fusionné de G1 à H1.")

    has_xy = sheet.nrows > 1 and _has_xy_subheaders(
        lambda row, col: sheet.cell_value(row, col) if row < sheet.nrows and col < sheet.ncols else None
    )
    if has_xy:
        if any(sheet.cell_value(1, column) not in (None, "") for column in (*range(0, 6), *range(8, min(len(HEADERS), sheet.ncols)))):
            raise ValueError("La deuxième ligne d'en-tête doit contenir uniquement X en G et Y en H.")
        return 3
    return 2


def parse_import_workbook(content: bytes) -> tuple[list[dict], list[dict]]:
    is_xls = content.startswith(bytes.fromhex("D0CF11E0A1B11AE1"))
    workbook = None
    try:
        if is_xls:
            workbook = xlrd.open_workbook(file_contents=content, formatting_info=True)
            sheet = workbook.sheet_by_index(0)
            if sheet.nrows < 1:
                raise ValueError("Le classeur ne contient aucune ligne d'en-tête.")
            first_data_row = _validate_xls_headers(sheet)
            max_row = sheet.nrows
            max_column = sheet.ncols
            get_value = lambda row, column: sheet.cell_value(row - 1, column - 1) if column <= sheet.ncols else None
        else:
            workbook = load_workbook(BytesIO(content), read_only=False, data_only=True)
            ws = workbook.active
            if ws.max_row < 1:
                raise ValueError("Le classeur ne contient aucune ligne d'en-tête.")
            first_data_row = _validate_xlsx_headers(ws)
            max_row = ws.max_row
            max_column = ws.max_column
            get_value = lambda row, column: ws.cell(row, column).value
    except ValueError:
        if workbook is not None and not is_xls:
            workbook.close()
        raise
    except Exception as exc:
        if workbook is not None and not is_xls:
            workbook.close()
        raise ValueError("Le fichier Excel est illisible ou endommagé.") from exc

    valid_rows: list[dict] = []
    row_errors: list[dict] = []
    for row_number in range(first_data_row, max_row + 1):
        values = [get_value(row_number, column) for column in range(1, len(HEADERS) + 1)]
        if all(value is None or (isinstance(value, str) and not value.strip()) for value in values):
            continue

        errors = []
        if any(get_value(row_number, column) not in (None, "") for column in range(len(HEADERS) + 1, max_column + 1)):
            errors.append("des données dépassent la dernière colonne du modèle")
        payload: dict[str, Any] = {}
        try:
            numero = _decimal_value(values[0], integer=True)
            if numero is None:
                raise ValueError("« N » est obligatoire")
            payload["numero"] = numero
        except ValueError as exc:
            errors.append(str(exc))

        for index, field in TEXT_FIELDS.items():
            try:
                payload[field] = _text_value(values[index], HEADERS[index])
            except ValueError as exc:
                errors.append(str(exc))

        for index, field in NUMERIC_FIELDS.items():
            try:
                parsed = _coordinate_value(values[index]) if field in ("coord_x", "coord_y") else _decimal_value(values[index])
                payload[field] = parsed
            except ValueError as exc:
                label = (
                    "Coordonnées Géographiques (X)" if index == 6 else
                    "Coordonnées Géographiques (Y)" if index == 7 else HEADERS[index]
                )
                errors.append(f"« {label} » : {exc}")

        if errors:
            row_errors.append({"ligne": row_number, "erreurs": errors})
        else:
            valid_rows.append(payload)

    if not is_xls:
        workbook.close()
    return valid_rows, row_errors


def build_template_workbook() -> Workbook:
    workbook = Workbook()
    ws = workbook.active
    ws.title = SHEET_NAME
    for index, value in enumerate(HEADERS, start=1):
        if value is not None:
            ws.cell(1, index, value)
    ws.merge_cells("G1:H1")
    for index in (*range(1, 7), *range(9, len(HEADERS) + 1)):
        letter = get_column_letter(index)
        ws.merge_cells(f"{letter}1:{letter}2")
    ws.cell(2, 7, "X")
    ws.cell(2, 8, "Y")
    header_fill = PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid")
    for index, width in enumerate(WIDTHS, start=1):
        for row in (1, 2):
            cell = ws.cell(row, index)
            cell.fill = header_fill
            cell.font = Font(bold=True, color="000000")
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(index)].width = width
    ws.row_dimensions[1].height = 44
    ws.row_dimensions[2].height = 18
    ws.freeze_panes = "A3"
    return workbook


def _row_from_item(item: dict) -> list[Any]:
    return [
        item.get("numero"), item.get("nom_prenoms"), item.get("sexe"),
        item.get("commune"), item.get("arrondissement"), item.get("village_hameau"),
        item.get("coord_x"), item.get("coord_y"), item.get("superficie_declaree"),
        item.get("superficie_trackee"), item.get("type_friche"),
        item.get("type_espece_vegetale"), item.get("type_sol"),
        item.get("precedents_culturaux"), item.get("decision_equipe_validation"),
        item.get("decision_atda7"), item.get("superficie_confirmee"),
    ]


def build_data_workbook(sheets: list[tuple[str, list[dict]]]) -> Workbook:
    workbook = Workbook()
    first = True
    for title, rows in sheets:
        ws = workbook.active if first else workbook.create_sheet()
        first = False
        ws.title = title[:31]
        for index, value in enumerate(HEADERS, start=1):
            if value is not None:
                ws.cell(1, index, value)
        ws.merge_cells("G1:H1")
        for index in (*range(1, 7), *range(9, len(HEADERS) + 1)):
            letter = get_column_letter(index)
            ws.merge_cells(f"{letter}1:{letter}2")
        ws.cell(2, 7, "X")
        ws.cell(2, 8, "Y")
        header_fill = PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid")
        for index, width in enumerate(WIDTHS, start=1):
            for row in (1, 2):
                cell = ws.cell(row, index)
                cell.fill = header_fill
                cell.font = Font(bold=True)
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws.column_dimensions[get_column_letter(index)].width = width
        ws.row_dimensions[1].height = 44
        ws.row_dimensions[2].height = 18
        for item in rows:
            ws.append(_row_from_item(item))
        ws.freeze_panes = "A3"
    return workbook

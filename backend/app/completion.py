"""Rules used to identify rehabilitation records that need completion."""

from typing import Any, Tuple

from sqlalchemy import func, or_

from app.models import Rehabilitation


# Observations are free-form notes. Every other business field is tracked.
COMPLETION_FIELDS: Tuple[Tuple[str, str], ...] = (
    ("N° PDA", "pda_number"),
    ("Département", "departement"),
    ("Commune", "commune"),
    ("Arrondissement", "arrondissement"),
    ("Village", "village"),
    ("Responsable de la brigade", "brigade_manager_name"),
    ("Téléphone du responsable", "brigade_manager_phone"),
    ("Nom de la brigade", "brigade_name"),
    ("Producteur bénéficiaire", "producer_name"),
    ("Téléphone du producteur", "producer_phone"),
    ("Superficie réhabilitée", "superficie_rehabilitee"),
    ("Année de la réhabilitation", "annee_rehabilitation"),
    ("Superficie de désherbage", "desherbage_superficie"),
    ("Opérateur de désherbage", "desherbage_operateur_nom"),
    ("Téléphone opérateur de désherbage", "desherbage_operateur_phone"),
    ("Superficie d'éclaircie/débitage", "eclaircie_superficie"),
    ("Opérateur d'éclaircie", "eclaircie_operateur_nom"),
    ("Téléphone opérateur d'éclaircie/débitage", "eclaircie_operateur_phone"),
    ("Superficie d'élagage/débitage", "elagage_superficie"),
    ("Opérateur d'élagage/débitage", "elagage_operateur_nom"),
    ("Téléphone opérateur d'élagage", "elagage_operateur_phone"),
    ("Superficie de débardage", "debardage_superficie"),
    ("Opérateur de débardage", "debardage_operateur_nom"),
    ("Téléphone opérateur de débardage", "debardage_operateur_phone"),
)


def is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def missing_fields(record: Any) -> list[str]:
    return [label for label, field in COMPLETION_FIELDS if is_missing(getattr(record, field, None))]


def incomplete_condition():
    """SQL condition usable by both PostgreSQL and SQLite."""
    conditions = []
    for _, field in COMPLETION_FIELDS:
        column = getattr(Rehabilitation, field)
        conditions.append(column.is_(None))
        if getattr(column.type, "python_type", None) is str:
            conditions.append(func.trim(column) == "")
    return or_(*conditions)

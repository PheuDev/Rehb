import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, field_validator, ConfigDict

PHONE_REGEX = re.compile(r"^[0-9+\-\s]{6,20}$")

PHONE_ERROR_MSG = (
    "Le numéro de téléphone doit contenir entre 6 et 20 caractères "
    "(chiffres, +, espaces, tirets uniquement)."
)


def _validate_phone(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return v
    if not PHONE_REGEX.match(v):
        raise ValueError(PHONE_ERROR_MSG)
    return v


class RehabilitationBase(BaseModel):
    pda_number: Optional[str] = Field(None, max_length=50, description="Numéro du PDA")
    departement: Optional[str] = Field(None, max_length=120)
    commune: Optional[str] = Field(None, max_length=120)
    arrondissement: Optional[str] = Field(None, max_length=120)
    village: Optional[str] = Field(None, max_length=120)
    annee_rehabilitation: Optional[int] = Field(None, ge=1990, le=2100)

    brigade_name: Optional[str] = Field(None, max_length=180)
    brigade_manager_name: Optional[str] = Field(None, max_length=180)
    brigade_manager_phone: Optional[str] = Field(None, max_length=30)

    producer_name: Optional[str] = Field(None, max_length=180)
    producer_phone: Optional[str] = Field(None, max_length=30)

    superficie_rehabilitee: Optional[Decimal] = Field(None, ge=0)

    desherbage_superficie: Optional[Decimal] = Field(None, ge=0)
    desherbage_operateur_nom: Optional[str] = Field(None, max_length=180)
    desherbage_operateur_phone: Optional[str] = Field(None, max_length=30)

    eclaircie_superficie: Optional[Decimal] = Field(None, ge=0)
    eclaircie_operateur_nom: Optional[str] = Field(None, max_length=180)
    eclaircie_operateur_phone: Optional[str] = Field(None, max_length=30)

    elagage_superficie: Optional[Decimal] = Field(None, ge=0)
    elagage_operateur_nom: Optional[str] = Field(None, max_length=180)
    elagage_operateur_phone: Optional[str] = Field(None, max_length=30)

    debardage_superficie: Optional[Decimal] = Field(None, ge=0)
    debardage_operateur_nom: Optional[str] = Field(None, max_length=180)
    debardage_operateur_phone: Optional[str] = Field(None, max_length=30)

    observations: Optional[str] = None

    @field_validator(
        "brigade_manager_phone",
        "producer_phone",
        "desherbage_operateur_phone",
        "eclaircie_operateur_phone",
        "elagage_operateur_phone",
        "debardage_operateur_phone",
    )
    @classmethod
    def check_phone(cls, v):
        return _validate_phone(v)


class RehabilitationCreate(RehabilitationBase):
    pass


class RehabilitationUpdate(BaseModel):
    """Tous les champs sont optionnels pour permettre une mise à jour partielle."""

    pda_number: Optional[str] = Field(None, max_length=50)
    departement: Optional[str] = Field(None, max_length=120)
    commune: Optional[str] = Field(None, max_length=120)
    arrondissement: Optional[str] = Field(None, max_length=120)
    village: Optional[str] = Field(None, max_length=120)
    annee_rehabilitation: Optional[int] = Field(None, ge=1990, le=2100)

    brigade_name: Optional[str] = Field(None, max_length=180)
    brigade_manager_name: Optional[str] = Field(None, max_length=180)
    brigade_manager_phone: Optional[str] = Field(None, max_length=30)

    producer_name: Optional[str] = Field(None, max_length=180)
    producer_phone: Optional[str] = Field(None, max_length=30)

    superficie_rehabilitee: Optional[Decimal] = Field(None, ge=0)

    desherbage_superficie: Optional[Decimal] = Field(None, ge=0)
    desherbage_operateur_nom: Optional[str] = Field(None, max_length=180)
    desherbage_operateur_phone: Optional[str] = Field(None, max_length=30)

    eclaircie_superficie: Optional[Decimal] = Field(None, ge=0)
    eclaircie_operateur_nom: Optional[str] = Field(None, max_length=180)
    eclaircie_operateur_phone: Optional[str] = Field(None, max_length=30)

    elagage_superficie: Optional[Decimal] = Field(None, ge=0)
    elagage_operateur_nom: Optional[str] = Field(None, max_length=180)
    elagage_operateur_phone: Optional[str] = Field(None, max_length=30)

    debardage_superficie: Optional[Decimal] = Field(None, ge=0)
    debardage_operateur_nom: Optional[str] = Field(None, max_length=180)
    debardage_operateur_phone: Optional[str] = Field(None, max_length=30)

    observations: Optional[str] = None

    @field_validator(
        "brigade_manager_phone",
        "producer_phone",
        "desherbage_operateur_phone",
        "eclaircie_operateur_phone",
        "elagage_operateur_phone",
        "debardage_operateur_phone",
    )
    @classmethod
    def check_phone(cls, v):
        return _validate_phone(v)


class RehabilitationOut(RehabilitationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sup_class: Optional[str] = None
    author_id: Optional[int] = None
    plantation_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    totalPages: int
    hasNext: bool
    hasPrev: bool
    superficieTotale: float


class RehabilitationListResponse(BaseModel):
    items: List[RehabilitationOut]
    pagination: PaginationMeta


class RehabilitationIncompleteOut(RehabilitationOut):
    missingFields: List[str]


class RehabilitationIncompleteListResponse(BaseModel):
    items: List[RehabilitationIncompleteOut]
    pagination: PaginationMeta


class FiltersResponse(BaseModel):
    departements: List[str]
    communes: List[str]
    arrondissements: List[str]
    villages: List[str]
    brigades: List[str]
    annees: List[int]
    supClasses: List[str]


class BrigadeOut(BaseModel):
    """Brigade distincte (regroupée par nom), avec son nombre de fiches."""

    name: str
    fiches: int = 0


class BrigadeDetailOut(BaseModel):
    """Brigade avec toutes ses informations agrégées."""

    brigade_name: str
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    fiches: int = 0
    superficie_totale: float = 0.0
    nb_departements: int = 0
    nb_communes: int = 0
    nb_villages: int = 0
    departements: List[str] = []
    communes: List[str] = []
    villages: List[str] = []
    annees: List[int] = []


class BrigadeDetailListResponse(BaseModel):
    items: List[BrigadeDetailOut]
    total: int


class DepartementOut(BaseModel):
    """Département avec ses agrégats."""

    departement: str
    fiches: int = 0
    superficie_totale: float = 0.0
    nb_communes: int = 0
    nb_arrondissements: int = 0
    nb_villages: int = 0
    communes: List[str] = []
    brigades: List[str] = []
    annees: List[int] = []


class DepartementListResponse(BaseModel):
    items: List[DepartementOut]
    total: int


class ProducerOut(BaseModel):
    """Producteur distinct (regroupé par nom), avec ses informations agrégées."""

    producer_name: str
    producer_phone: Optional[str] = None
    fiches: int = 0
    superficie_totale: float = 0.0
    communes: List[str] = []
    villages: List[str] = []
    brigades: List[str] = []


class ProducerListResponse(BaseModel):
    items: List[ProducerOut]
    total: int


class ImportRowError(BaseModel):
    ligne: int
    erreurs: List[str]


class ImportResult(BaseModel):
    total: int
    importees: int
    aCompleter: int = 0
    erreurs: List[ImportRowError]


class BulkDeleteRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)


class StatsResponse(BaseModel):
    totalFiches: int
    superficieTotale: float
    totalDepartements: int
    totalCommunes: int
    totalVillages: int
    totalBrigades: int
    parDepartement: List[Dict[str, Any]]
    parAnnee: List[Dict[str, Any]]
    parSupClass: List[Dict[str, Any]]
    parBrigade: List[Dict[str, Any]]


class AuditFicheOut(BaseModel):
    """Fiche sélectionnée pour l'audit."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    pda_number: Optional[str] = None
    departement: Optional[str] = None
    commune: Optional[str] = None
    arrondissement: Optional[str] = None
    village: Optional[str] = None
    brigade_name: Optional[str] = None
    producer_name: Optional[str] = None
    superficie_rehabilitee: Optional[float] = None
    annee_rehabilitation: Optional[int] = None
    audit_classe: Optional[str] = None  # calculé côté endpoint


class AuditClasseSyntheseOut(BaseModel):
    classe: str
    fiches: int
    superficie: float
    nb_brigades: int


class AuditSampleResponse(BaseModel):
    fiches: List[AuditFicheOut]
    total_fiches: int
    superficie_echantillon: float
    superficie_totale: float
    pourcentage_couverture: float
    pourcentage_global: float = 25.0
    pourcentage_brigade: float = 20.0
    par_classe: List[AuditClasseSyntheseOut]
    fiches_hors_echantillon: List[AuditFicheOut] = []
    par_brigade: List[Dict[str, Any]] = []


class SavedAuditSuggestionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    brigade_filter: Optional[List[str]] = None
    snapshot: AuditSampleResponse


class SavedAuditSuggestionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    created_by_username: Optional[str] = None
    created_by_full_name: Optional[str] = None
    nb_fiches_echantillon: int
    superficie_echantillon: Optional[float] = None
    pourcentage_couverture: Optional[float] = None
    brigade_filter: Optional[List[str]] = None


class AuditDispatchTeamSummary(BaseModel):
    team_id: int
    team_name: str
    fiches: int
    binomes: int


class AuditDispatchResult(BaseModel):
    fiches_total: int
    fiches_dispatched: int
    plantations_created: int
    plantations_reused: int
    binome_assignments_created: int
    teams: List[AuditDispatchTeamSummary] = []
    warnings: List[str] = []


class SavedAuditSuggestionDetail(SavedAuditSuggestionSummary):
    snapshot: AuditSampleResponse
    dispatch: Optional[AuditDispatchResult] = None


class SavedAuditSuggestionListResponse(BaseModel):
    items: List[SavedAuditSuggestionSummary]
    total: int

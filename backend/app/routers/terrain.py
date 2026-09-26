"""Router Phase 2 — Gestion terrain : brigades, plantations, échantillons, remplacements.

Routes brigades         : GET/POST /api/brigades, GET/PUT/DELETE /api/brigades/{id}
Routes affectations     : POST /api/brigades/{id}/assign  → brigade→équipe par campagne
                          GET  /api/teams/{id}/brigades   → brigades d'une équipe
Routes plantations      : GET/POST /api/plantations
                          POST /api/plantations/import   → import en masse (JSON)
Routes attributions     : GET/POST /api/binomes/{id}/plantations
Routes remplacements    : GET  /api/binomes/{id}/available-replacements
                          POST /api/replacements
                          GET  /api/binomes/{id}/replacements
Routes fiches liées     : GET  /api/binomes/{id}/rehabilitations  → "mes fiches"
                          POST /api/rehabilitations/{id}/link-plantation
"""

import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.dependencies import (
    get_db,
    require_active,
    require_admin,
    require_chef_or_admin,
)
from app.models import (
    Binome,
    BrigadeEntity,
    Plantation,
    ReplacementSelection,
    Rehabilitation,
    SavedAuditSuggestion,
    SampleAssignment,
    Team,
    TeamAuditAssignment,
    TeamBrigadeAssignment,
    User,
)

router = APIRouter(tags=["Terrain — Phase 2"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# =============================================================================
# Schémas Pydantic
# =============================================================================

class BrigadeEntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    manager_name: Optional[str] = Field(None, max_length=180)
    manager_phone: Optional[str] = Field(None, max_length=30)


class BrigadeEntityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=180)
    manager_name: Optional[str] = Field(None, max_length=180)
    manager_phone: Optional[str] = Field(None, max_length=30)


class BrigadeEntityOut(BaseModel):
    id: int
    name: str
    manager_name: Optional[str]
    manager_phone: Optional[str]

    class Config:
        from_attributes = True


class AssignBrigadeRequest(BaseModel):
    team_id: int


class AssignmentOut(BaseModel):
    id: int
    brigade_id: int
    brigade_name: str
    team_id: int
    team_name: str

    class Config:
        from_attributes = True


class PlantationCreate(BaseModel):
    pda_number: Optional[str] = Field(None, max_length=50)
    producer_name: Optional[str] = Field(None, max_length=180)
    producer_phone: Optional[str] = Field(None, max_length=30)
    departement: Optional[str] = Field(None, max_length=120)
    commune: Optional[str] = Field(None, max_length=120)
    arrondissement: Optional[str] = Field(None, max_length=120)
    village: Optional[str] = Field(None, max_length=120)
    superficie: Optional[float] = Field(None, ge=0)
    brigade_id: Optional[int] = None
    is_sample: bool = False


class PlantationOut(BaseModel):
    id: int
    pda_number: Optional[str]
    producer_name: Optional[str]
    producer_phone: Optional[str]
    departement: Optional[str]
    commune: Optional[str]
    arrondissement: Optional[str]
    village: Optional[str]
    superficie: Optional[float]
    brigade_id: Optional[int]
    brigade_name: Optional[str] = None
    is_sample: bool
    inspection_completed: bool = False
    is_replaced: bool = False   # True si une plantation de remplacement a été choisie
    is_locked: bool = False     # True si utilisée comme remplacement (grisée)
    locked_by_me: bool = False  # True si c'est l'utilisateur courant qui l'a grisée
    locked_by_name: Optional[str] = None
    replacement_id: Optional[int] = None  # id de la sélection (pour dégriser)

    class Config:
        from_attributes = True


class SampleAssignmentCreate(BaseModel):
    plantation_ids: list[int] = Field(..., min_length=1)


class SampleAssignmentOut(BaseModel):
    id: int
    plantation_id: int
    binome_id: int

    class Config:
        from_attributes = True


class ReplacementCreate(BaseModel):
    original_plantation_id: int = Field(..., description="Plantation introuvable")
    replacement_plantation_id: int = Field(..., description="Plantation choisie comme remplacement")


class StockReplacementCreate(BaseModel):
    replacement_plantation_id: int = Field(
        ...,
        description="Plantation hors-échantillon à marquer comme utilisée",
    )
    original_plantation_id: int = Field(
        ...,
        description="Plantation échantillonnée à remplacer (même brigade)",
    )


class ReplacementOut(BaseModel):
    id: int
    original_plantation_id: int
    replacement_plantation_id: int
    binome_id: int
    locked_at: str
    locked_by_id: Optional[int] = None
    locked_by_name: Optional[str] = None
    locked_by_me: bool = False

    class Config:
        from_attributes = True


class InspectionCompletionUpdate(BaseModel):
    completed: bool


# =============================================================================
# Helpers
# =============================================================================

def _brigade_or_404(db: Session, brigade_id: int) -> BrigadeEntity:
    b = db.query(BrigadeEntity).filter(BrigadeEntity.id == brigade_id).first()
    if not b:
        raise HTTPException(404, "Brigade introuvable.")
    return b


def _plantation_or_404(db: Session, plantation_id: int) -> Plantation:
    p = db.query(Plantation).filter(Plantation.id == plantation_id).first()
    if not p:
        raise HTTPException(404, "Plantation introuvable.")
    return p


def _binome_or_404(db: Session, binome_id: int) -> Binome:
    b = db.query(Binome).filter(Binome.id == binome_id).first()
    if not b:
        raise HTTPException(404, "Binôme introuvable.")
    return b


def _plantation_to_out(
    p: Plantation,
    db: Session,
    current_user: Optional[User] = None,
) -> PlantationOut:
    """Sérialise une plantation avec son état de remplacement.

    - ``is_replaced`` : la plantation est l'ORIGINALE d'un remplacement
      (badge « Remplacée » sur la fiche introuvable).
    - ``is_locked`` : la plantation est UTILISÉE comme remplacement par
      quelqu'un (elle apparaît grisée dans la liste des remplacements).
    - ``locked_by_me`` / ``locked_by_name`` / ``replacement_id`` : éléments
      pour le dégrisage (réservé au verrouilleur).
    """
    lock = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.replacement_plantation_id == p.id)
        .first()
    )
    replaced = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.original_plantation_id == p.id)
        .first()
    ) is not None
    locked_by_name = None
    if lock:
        locker = lock.locked_by
        if locker:
            locked_by_name = locker.full_name or locker.username
    return PlantationOut(
        id=p.id,
        pda_number=p.pda_number,
        producer_name=p.producer_name,
        producer_phone=p.producer_phone,
        departement=p.departement,
        commune=p.commune,
        arrondissement=p.arrondissement,
        village=p.village,
        superficie=float(p.superficie) if p.superficie else None,
        brigade_id=p.brigade_id,
        brigade_name=p.brigade.name if p.brigade else None,
        is_sample=p.is_sample,
        inspection_completed=p.inspection_completed,
        is_replaced=replaced,
        is_locked=lock is not None,
        locked_by_me=bool(lock and current_user is not None and lock.locked_by_id == current_user.id),
        locked_by_name=locked_by_name,
        replacement_id=lock.id if lock else None,
    )


def _latest_suggestion_fiche_ids(db: Session, key: str) -> set[int]:
    suggestion = (
        db.query(SavedAuditSuggestion)
        .order_by(SavedAuditSuggestion.created_at.desc(), SavedAuditSuggestion.id.desc())
        .first()
    )
    if suggestion is None:
        return set()
    return {
        fiche["id"]
        for fiche in ((suggestion.snapshot or {}).get(key) or [])
        if fiche.get("id") is not None
    }


# =============================================================================
# Routes — Brigades (entités)
# =============================================================================

@router.get("/api/brigades", response_model=list[BrigadeEntityOut], summary="Liste des brigades (entités)")
def list_brigade_entities(
    q: Optional[str] = Query(None),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    query = db.query(BrigadeEntity)
    if q:
        query = query.filter(
            or_(
                BrigadeEntity.name.ilike(f"%{q}%"),
                BrigadeEntity.manager_name.ilike(f"%{q}%"),
            )
        )
    return query.order_by(BrigadeEntity.name).all()


@router.get("/api/brigades/unassigned", response_model=list[BrigadeEntityOut], summary="Brigades non encore affectées")
def list_unassigned_brigades(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retourne les brigades qui ne sont affectées à aucune équipe."""
    assigned_ids = db.query(TeamBrigadeAssignment.brigade_id).subquery()
    return (
        db.query(BrigadeEntity)
        .filter(~BrigadeEntity.id.in_(assigned_ids))
        .order_by(BrigadeEntity.name)
        .all()
    )


@router.post(
    "/api/brigades",
    response_model=BrigadeEntityOut,
    status_code=201,
    summary="Créer une brigade",
)
def create_brigade_entity(
    payload: BrigadeEntityCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(BrigadeEntity).filter(BrigadeEntity.name == payload.name).first():
        raise HTTPException(409, "Une brigade avec ce nom existe déjà.")
    brigade = BrigadeEntity(**payload.model_dump())
    db.add(brigade)
    db.commit()
    db.refresh(brigade)
    return brigade


@router.get("/api/brigades/{brigade_id}", response_model=BrigadeEntityOut)
def get_brigade_entity(
    brigade_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    return _brigade_or_404(db, brigade_id)


@router.put("/api/brigades/{brigade_id}", response_model=BrigadeEntityOut)
def update_brigade_entity(
    brigade_id: int,
    payload: BrigadeEntityUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    brigade = _brigade_or_404(db, brigade_id)
    if payload.name is not None:
        brigade.name = payload.name
    if payload.manager_name is not None:
        brigade.manager_name = payload.manager_name
    if payload.manager_phone is not None:
        brigade.manager_phone = payload.manager_phone
    db.commit()
    db.refresh(brigade)
    return brigade


@router.delete("/api/brigades/{brigade_id}", status_code=204)
def delete_brigade_entity(
    brigade_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    brigade = _brigade_or_404(db, brigade_id)
    db.delete(brigade)
    db.commit()


# =============================================================================
# Routes — Affectations brigade → équipe
# =============================================================================

@router.post(
    "/api/brigades/{brigade_id}/assign",
    response_model=AssignmentOut,
    status_code=201,
    summary="Affecter une brigade à une équipe",
)
def assign_brigade_to_team(
    brigade_id: int,
    payload: AssignBrigadeRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Affecte une brigade à une équipe.

    Règle métier : une brigade ne peut être affectée qu'à une seule équipe.
    La contrainte UNIQUE(brigade_id) en base garantit cette règle.
    """
    brigade = _brigade_or_404(db, brigade_id)
    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(404, "Équipe introuvable.")

    existing = db.query(TeamBrigadeAssignment).filter(
        TeamBrigadeAssignment.brigade_id == brigade_id
    ).first()
    if existing:
        raise HTTPException(
            409,
            f"La brigade '{brigade.name}' est déjà affectée à l'équipe '{existing.team.name}'.",
        )

    assignment = TeamBrigadeAssignment(brigade_id=brigade_id, team_id=payload.team_id)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return AssignmentOut(
        id=assignment.id,
        brigade_id=brigade_id,
        brigade_name=brigade.name,
        team_id=payload.team_id,
        team_name=team.name,
    )


@router.delete("/api/brigades/{brigade_id}/assign/{assignment_id}", status_code=204)
def remove_brigade_assignment(
    brigade_id: int,
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    asgn = (
        db.query(TeamBrigadeAssignment)
        .filter(
            TeamBrigadeAssignment.id == assignment_id,
            TeamBrigadeAssignment.brigade_id == brigade_id,
        )
        .first()
    )
    if not asgn:
        raise HTTPException(404, "Affectation introuvable.")
    db.delete(asgn)
    db.commit()


@router.get(
    "/api/teams/{team_id}/brigades",
    response_model=list[AssignmentOut],
    summary="Brigades affectées à une équipe",
)
def list_team_brigades(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin" and current_user.team_id != team_id:
        raise HTTPException(403, "Accès refusé.")
    return [
        AssignmentOut(id=a.id, brigade_id=a.brigade_id, brigade_name=a.brigade.name,
                      team_id=a.team_id, team_name=a.team.name)
        for a in db.query(TeamBrigadeAssignment).filter(TeamBrigadeAssignment.team_id == team_id).all()
    ]


# =============================================================================
# Routes — Plantations
# =============================================================================

@router.get("/api/plantations", response_model=list[PlantationOut], summary="Liste des plantations")
def list_plantations(
    brigade_id: Optional[int] = Query(None),
    is_sample: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Liste toutes les plantations.

    - Un admin voit tout.
    - Un autre rôle ne voit que les plantations des brigades affectées à son équipe.
    """
    query = db.query(Plantation)

    # Filtrage par équipe pour les non-admins
    if current_user.role != "admin" and current_user.team_id:
        brigade_ids = (
            db.query(TeamBrigadeAssignment.brigade_id)
            .filter(TeamBrigadeAssignment.team_id == current_user.team_id)
            .subquery()
        )
        query = query.filter(Plantation.brigade_id.in_(brigade_ids))

    if brigade_id:
        query = query.filter(Plantation.brigade_id == brigade_id)
    if is_sample is not None:
        query = query.filter(Plantation.is_sample == is_sample)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Plantation.pda_number.ilike(like),
                Plantation.producer_name.ilike(like),
                Plantation.commune.ilike(like),
                Plantation.village.ilike(like),
            )
        )

    plantations = query.order_by(Plantation.pda_number).all()
    return [_plantation_to_out(p, db) for p in plantations]


@router.get(
    "/api/plantations/hors-echantillon",
    response_model=list[PlantationOut],
    summary="Stock de plantations hors-échantillon (remplacements possibles)",
)
def list_hors_echantillon_plantations(
    brigade_id: Optional[int] = Query(None, description="Filtrer par brigade"),
    q: Optional[str] = Query(None, description="Recherche N°PDA / producteur / commune / village"),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Plantations hors-échantillon disponibles.

    - Visible pour l'équipe : uniquement les brigades qui lui sont affectées.
    - Les plantations déjà marquées « utilisée » (grisées) apparaissent avec
      ``is_locked`` / ``locked_by_me`` / ``replacement_id``.
    """
    if current_user.role != "admin" and not current_user.team_id:
        return []

    # Le stock affiché est celui de la feuille hors-échantillon de la dernière
    # suggestion sauvegardée. Les lignes Plantation fournissent les identifiants
    # stables nécessaires aux actions de remplacement.
    fiche_ids = _latest_suggestion_fiche_ids(db, "fiches_hors_echantillon")
    if not fiche_ids:
        return []

    if brigade_id is not None:
        _brigade_or_404(db, brigade_id)

    query = db.query(Plantation).filter(
        Plantation.is_sample.is_(False),
        Plantation.source_rehabilitation_id.in_(fiche_ids),
    )
    if current_user.role != "admin" and current_user.team_id:
        brigade_ids = (
            db.query(TeamBrigadeAssignment.brigade_id)
            .filter(TeamBrigadeAssignment.team_id == current_user.team_id)
        )
        query = query.filter(Plantation.brigade_id.in_(brigade_ids))
    if brigade_id is not None:
        query = query.filter(Plantation.brigade_id == brigade_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Plantation.pda_number.ilike(like),
                Plantation.producer_name.ilike(like),
                Plantation.commune.ilike(like),
                Plantation.village.ilike(like),
            )
        )

    plantations = query.order_by(Plantation.pda_number).all()
    return [_plantation_to_out(p, db, current_user) for p in plantations]


@router.get(
    "/api/plantations/echantillon",
    response_model=list[PlantationOut],
    summary="Plantations échantillonnées d'une brigade (candidates au remplacement)",
)
def list_echantillon_plantations(
    brigade_id: Optional[int] = Query(None, description="Filtrer par brigade"),
    include_replaced: bool = Query(False, description="Inclure les fiches déjà remplacées pour le suivi d'équipe"),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Plantations échantillonnées (is_sample=True) d'une brigade.

    Les plantations déjà « remplacées » sont exclues : une plantation
    échantillonnée ne peut être remplacée qu'UNE seule fois.
    """
    if current_user.role != "admin" and not current_user.team_id:
        return []

    # Les candidates doivent venir de la même suggestion que son stock hors-échantillon.
    fiche_ids = _latest_suggestion_fiche_ids(db, "fiches")
    if not fiche_ids:
        return []

    if brigade_id is not None:
        _brigade_or_404(db, brigade_id)

    query = db.query(Plantation).filter(
        Plantation.is_sample.is_(True),
        Plantation.source_rehabilitation_id.in_(fiche_ids),
    )
    if current_user.role != "admin" and current_user.team_id:
        brigade_ids = (
            db.query(TeamBrigadeAssignment.brigade_id)
            .filter(TeamBrigadeAssignment.team_id == current_user.team_id)
        )
        query = query.filter(Plantation.brigade_id.in_(brigade_ids))
    if brigade_id is not None:
        query = query.filter(Plantation.brigade_id == brigade_id)

    if not include_replaced:
        replaced_ids = {
            pid
            for (pid,) in db.query(ReplacementSelection.original_plantation_id).all()
        }
        if replaced_ids:
            query = query.filter(~Plantation.id.in_(replaced_ids))

    plantations = query.order_by(Plantation.pda_number).all()
    return [_plantation_to_out(p, db, current_user) for p in plantations]


@router.patch(
    "/api/plantations/{plantation_id}/inspection",
    response_model=PlantationOut,
    summary="Mettre à jour l'état d'inspection d'une fiche échantillonnée",
)
def update_inspection_status(
    plantation_id: int,
    payload: InspectionCompletionUpdate,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    plantation = _plantation_or_404(db, plantation_id)
    if not plantation.is_sample:
        raise HTTPException(400, "Seules les fiches échantillonnées ont un statut d'inspection.")
    if current_user.role != "admin":
        if current_user.team_id is None:
            raise HTTPException(403, "Votre compte n'est rattaché à aucune équipe.")
        assigned = db.query(TeamBrigadeAssignment.id).filter(
            TeamBrigadeAssignment.team_id == current_user.team_id,
            TeamBrigadeAssignment.brigade_id == plantation.brigade_id,
        ).first()
        latest_ids = _latest_suggestion_fiche_ids(db, "fiches")
        if not assigned or plantation.source_rehabilitation_id not in latest_ids:
            raise HTTPException(403, "Cette fiche ne fait pas partie de la mission de votre équipe.")

    plantation.inspection_completed = payload.completed
    db.commit()
    db.refresh(plantation)
    return _plantation_to_out(plantation, db, current_user)


@router.post(
    "/api/plantations",
    response_model=PlantationOut,
    status_code=201,
    summary="Créer une plantation",
)
def create_plantation(
    payload: PlantationCreate,
    current_user: User = Depends(require_chef_or_admin),
    db: Session = Depends(get_db),
):
    p = Plantation(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _plantation_to_out(p, db)


@router.post(
    "/api/plantations/bulk",
    response_model=dict,
    status_code=201,
    summary="Import en masse de plantations (JSON)",
)
def bulk_create_plantations(
    payload: list[PlantationCreate],
    current_user: User = Depends(require_chef_or_admin),
    db: Session = Depends(get_db),
):
    """Crée plusieurs plantations en une seule requête (import d'échantillon).

    Retourne le nombre de plantations créées.
    """
    if not payload:
        raise HTTPException(400, "La liste de plantations est vide.")
    if len(payload) > 5000:
        raise HTTPException(400, "Maximum 5 000 plantations par import.")

    plantations = [Plantation(**p.model_dump()) for p in payload]
    db.add_all(plantations)
    db.commit()
    return {"created": len(plantations)}


@router.get("/api/plantations/{plantation_id}", response_model=PlantationOut)
def get_plantation(
    plantation_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    p = _plantation_or_404(db, plantation_id)
    return _plantation_to_out(p, db)


@router.put("/api/plantations/{plantation_id}", response_model=PlantationOut)
def update_plantation(
    plantation_id: int,
    payload: PlantationCreate,
    current_user: User = Depends(require_chef_or_admin),
    db: Session = Depends(get_db),
):
    p = _plantation_or_404(db, plantation_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _plantation_to_out(p, db)


@router.delete("/api/plantations/{plantation_id}", status_code=204)
def delete_plantation(
    plantation_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    p = _plantation_or_404(db, plantation_id)
    db.delete(p)
    db.commit()


# =============================================================================
# Routes — Attributions plantation → binôme (échantillon)
# =============================================================================

@router.get(
    "/api/binomes/{binome_id}/plantations",
    response_model=list[PlantationOut],
    summary="Plantations attribuées à un binôme",
)
def list_binome_plantations(
    binome_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Retourne les plantations attribuées à ce binôme.

    - Un binôme ne peut voir que ses propres plantations.
    - Un admin ou chef d'équipe peut voir celles de n'importe quel binôme de son équipe.
    """
    binome = _binome_or_404(db, binome_id)

    # Vérification d'accès : binôme ne peut voir que le sien
    if current_user.role == "binome" and current_user.binome_id != binome_id:
        raise HTTPException(403, "Accès refusé.")
    # Chef d'équipe : vérifie que le binôme appartient à son équipe
    if current_user.role == "chef_equipe" and binome.team_id != current_user.team_id:
        raise HTTPException(403, "Ce binôme n'appartient pas à votre équipe.")

    assignments = (
        db.query(SampleAssignment)
        .filter(SampleAssignment.binome_id == binome_id)
        .all()
    )
    plantation_ids = [a.plantation_id for a in assignments]
    plantations = (
        db.query(Plantation)
        .filter(Plantation.id.in_(plantation_ids))
        .all()
    )
    return [_plantation_to_out(p, db, current_user) for p in plantations]


@router.get(
    "/api/binomes/{binome_id}/plantations/export-excel",
    summary="Exporter les plantations attribuées au binôme (Excel)",
)
def export_binome_plantations_excel(
    binome_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Télécharge la liste des plantations d'audit attribuées au binôme."""
    binome = _binome_or_404(db, binome_id)
    if current_user.role == "binome" and current_user.binome_id != binome_id:
        raise HTTPException(403, "Accès refusé.")
    if current_user.role == "chef_equipe" and binome.team_id != current_user.team_id:
        raise HTTPException(403, "Ce binôme n'appartient pas à votre équipe.")

    assignments = (
        db.query(SampleAssignment)
        .filter(SampleAssignment.binome_id == binome_id)
        .all()
    )
    plantation_ids = [a.plantation_id for a in assignments]
    plantations = (
        db.query(Plantation)
        .filter(Plantation.id.in_(plantation_ids))
        .order_by(Plantation.pda_number)
        .all()
    )
    return _plantations_excel_response(plantations, f"plantations_binome_{binome_id}.xlsx")


# =============================================================================
# Routes — Plantations d'une équipe (« Mes plantations » du chef / admin)
# =============================================================================

def _plantations_excel_response(plantations, filename):
    """Construit la réponse Excel « Mes plantations » (binôme ou équipe)."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    headers = [
        "N° PDA", "Producteur", "Brigade", "Département", "Commune",
        "Village", "Superficie (ha)", "Échantillon",
    ]
    wb = Workbook()
    ws = wb.active
    ws.title = "Mes plantations"
    ws.append(headers)
    header_fill = PatternFill(start_color="2D6846", end_color="2D6846", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for idx, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(idx)].width = 22
    ws.freeze_panes = "A2"

    for p in plantations:
        ws.append([
            p.pda_number,
            p.producer_name,
            p.brigade.name if p.brigade else None,
            p.departement,
            p.commune,
            p.village,
            float(p.superficie) if p.superficie is not None else None,
            "Oui" if p.is_sample else "Non",
        ])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _team_plantation_ids(db: Session, team_id: int) -> list[int]:
    """Identifiants des plantations attribuées à une équipe.

    Sources :
    - liens d'audit équipe (``team_audit_assignments``) — créés à la
      sauvegarde d'une suggestion d'audit selon les brigades affectées ;
    - attributions aux binômes de l'équipe (``sample_assignments``).
    Dédupliqués puis triés.
    """
    ids: set[int] = set()
    for (pid,) in (
        db.query(TeamAuditAssignment.plantation_id)
        .filter(TeamAuditAssignment.team_id == team_id)
        .all()
    ):
        ids.add(pid)
    for (binome_id,) in db.query(Binome.id).filter(Binome.team_id == team_id).all():
        for (pid,) in (
            db.query(SampleAssignment.plantation_id)
            .filter(SampleAssignment.binome_id == binome_id)
            .all()
        ):
            ids.add(pid)
    return sorted(ids)


def _check_team_scope(current_user: User, team_id: int) -> None:
    """Un chef d'équipe ne consulte que sa propre équipe ; un admin, toutes."""
    if current_user.role == "binome":
        raise HTTPException(403, "Accès réservé au chef d'équipe ou à l'administrateur.")
    if current_user.role != "admin" and current_user.team_id != team_id:
        raise HTTPException(403, "Cette équipe n'est pas la vôtre.")


@router.get(
    "/api/teams/{team_id}/plantations",
    response_model=list[PlantationOut],
    summary="Plantations attribuées à une équipe",
)
def list_team_plantations(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Retourne les plantations d'audit reçues par une équipe (via ses brigades).

    - Un chef d'équipe ne voit que les plantations de sa propre équipe.
    - Un admin peut consulter n'importe quelle équipe.
    """
    if not db.query(Team).filter(Team.id == team_id).first():
        raise HTTPException(404, "Équipe introuvable.")
    _check_team_scope(current_user, team_id)

    ids = _team_plantation_ids(db, team_id)
    if not ids:
        return []
    plantations = (
        db.query(Plantation)
        .filter(Plantation.id.in_(ids))
        .order_by(Plantation.pda_number)
        .all()
    )
    return [_plantation_to_out(p, db, current_user) for p in plantations]


@router.get(
    "/api/teams/{team_id}/plantations/export-excel",
    summary="Exporter les plantations attribuées à une équipe (Excel)",
)
def export_team_plantations_excel(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Télécharge la liste des plantations d'audit reçues par une équipe."""
    if not db.query(Team).filter(Team.id == team_id).first():
        raise HTTPException(404, "Équipe introuvable.")
    _check_team_scope(current_user, team_id)

    ids = _team_plantation_ids(db, team_id)
    plantations = (
        db.query(Plantation)
        .filter(Plantation.id.in_(ids))
        .order_by(Plantation.pda_number)
        .all()
        if ids
        else []
    )
    return _plantations_excel_response(plantations, f"plantations_equipe_{team_id}.xlsx")


@router.post(
    "/api/binomes/{binome_id}/plantations",
    response_model=dict,
    status_code=201,
    summary="Attribuer des plantations à un binôme",
)
def assign_plantations_to_binome(
    binome_id: int,
    payload: SampleAssignmentCreate,
    current_user: User = Depends(require_chef_or_admin),
    db: Session = Depends(get_db),
):
    """Attribue une liste de plantations (de l'échantillon) à un binôme.

    Ignore les doublons silencieusement.
    """
    _binome_or_404(db, binome_id)

    created = 0
    for pid in payload.plantation_ids:
        p = _plantation_or_404(db, pid)
        if not p.is_sample:
            raise HTTPException(
                400,
                f"La plantation {pid} ({p.pda_number or 'sans N°PDA'}) "
                "n'appartient pas à l'échantillon initial.",
            )
        existing = (
            db.query(SampleAssignment)
            .filter(
                SampleAssignment.plantation_id == pid,
                SampleAssignment.binome_id == binome_id,
            )
            .first()
        )
        if not existing:
            db.add(SampleAssignment(plantation_id=pid, binome_id=binome_id))
            created += 1

    db.commit()
    return {"assigned": created}


@router.delete(
    "/api/binomes/{binome_id}/plantations/{plantation_id}",
    status_code=204,
    summary="Retirer une plantation d'un binôme",
)
def remove_binome_plantation(
    binome_id: int,
    plantation_id: int,
    current_user: User = Depends(require_chef_or_admin),
    db: Session = Depends(get_db),
):
    asgn = (
        db.query(SampleAssignment)
        .filter(
            SampleAssignment.binome_id == binome_id,
            SampleAssignment.plantation_id == plantation_id,
        )
        .first()
    )
    if not asgn:
        raise HTTPException(404, "Attribution introuvable.")
    db.delete(asgn)
    db.commit()


# =============================================================================
# Routes — Remplacements
# =============================================================================

@router.get(
    "/api/binomes/{binome_id}/available-replacements",
    response_model=list[PlantationOut],
    summary="Plantations disponibles comme remplacement",
)
def list_available_replacements(
    binome_id: int,
    brigade_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Retourne les plantations hors-échantillon utilisables comme remplacement.

    Règles appliquées :
    - is_sample = False            (pas de l'échantillon initial / de la suggestion)
    - Même brigade que la plantation introuvable (si brigade_id fourni)
    - Plantations de l'équipe du binôme connecté (sauf admin)
    - Les plantations déjà verrouillées (grisées) apparaissent avec
      ``is_locked`` / ``locked_by_me`` afin d'éviter leur réutilisation.
    """
    if current_user.role == "binome" and current_user.binome_id != binome_id:
        raise HTTPException(403, "Accès refusé.")

    # Les plantations déjà verrouillées comme remplacement restent affichées
    # (grisées) pour empêcher un autre binôme de les réutiliser.
    query = db.query(Plantation).filter(Plantation.is_sample.is_(False))

    if brigade_id:
        query = query.filter(Plantation.brigade_id == brigade_id)

    # Filtre équipe pour les non-admins
    binome = _binome_or_404(db, binome_id)
    if current_user.role != "admin":
        brigade_ids = (
            db.query(TeamBrigadeAssignment.brigade_id)
            .filter(TeamBrigadeAssignment.team_id == binome.team_id)
        )
        query = query.filter(Plantation.brigade_id.in_(brigade_ids))

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Plantation.pda_number.ilike(like),
                Plantation.producer_name.ilike(like),
                Plantation.commune.ilike(like),
                Plantation.village.ilike(like),
            )
        )

    return [_plantation_to_out(p, db, current_user) for p in query.order_by(Plantation.pda_number).all()]


@router.post(
    "/api/replacements",
    response_model=ReplacementOut,
    status_code=201,
    summary="Sélectionner une plantation de remplacement",
)
def create_replacement(
    payload: ReplacementCreate,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Verrouille une plantation hors-échantillon comme remplacement.

    Règles vérifiées :
    1. La plantation originale doit appartenir à l'échantillon (is_sample=True)
       ET être attribuée au binôme courant.
    2. La plantation de remplacement doit être hors-échantillon (is_sample=False).
    3. La plantation de remplacement doit être de la MÊME brigade.
    4. La plantation de remplacement ne doit pas déjà être verrouillée.
    5. Un binôme ne peut remplacer que ses propres plantations.
    Le verrou est attribué au binôme courant : seul lui pourra le dégriser.
    """
    if current_user.binome_id is None:
        raise HTTPException(400, "Votre compte n'est pas rattaché à un binôme.")

    # Règle 1 — plantation originale dans l'échantillon du binôme
    original = _plantation_or_404(db, payload.original_plantation_id)
    if not original.is_sample:
        raise HTTPException(
            400,
            "La plantation originale doit appartenir à l'échantillon initial.",
        )
    assigned = (
        db.query(SampleAssignment)
        .filter(
            SampleAssignment.plantation_id == payload.original_plantation_id,
            SampleAssignment.binome_id == current_user.binome_id,
        )
        .first()
    )
    if not assigned:
        raise HTTPException(
            403,
            "Cette plantation n'est pas attribuée à votre binôme.",
        )

    # Règle 2 — remplacement hors-échantillon
    replacement = _plantation_or_404(db, payload.replacement_plantation_id)
    if replacement.is_sample:
        raise HTTPException(
            400,
            "Une plantation de l'échantillon initial ne peut pas être utilisée "
            "comme remplacement.",
        )

    # Règle 2bis — le remplacement doit appartenir à la MÊME brigade
    if original.brigade_id is not None and replacement.brigade_id != original.brigade_id:
        raise HTTPException(
            400,
            "Le remplacement doit être une plantation de la même brigade "
            "que la plantation introuvable.",
        )

    # Règle 3 — non déjà verrouillée (vérification applicative avant la contrainte DB)
    already_locked = (
        db.query(ReplacementSelection)
        .filter(
            ReplacementSelection.replacement_plantation_id
            == payload.replacement_plantation_id
        )
        .first()
    )
    if already_locked:
        raise HTTPException(
            409,
            "Cette plantation a déjà été sélectionnée comme remplacement "
            "par un autre binôme.",
        )

    try:
        sel = ReplacementSelection(
            original_plantation_id=payload.original_plantation_id,
            replacement_plantation_id=payload.replacement_plantation_id,
            binome_id=current_user.binome_id,
            locked_by_id=current_user.id,
        )
        db.add(sel)
        db.commit()
        db.refresh(sel)
    except Exception:
        db.rollback()
        # Conflit DB (deux binômes simultanés) — la contrainte UNIQUE a joué
        raise HTTPException(
            409,
            "Cette plantation vient d'être sélectionnée par un autre binôme. "
            "Veuillez en choisir une autre.",
        )

    return ReplacementOut(
        id=sel.id,
        original_plantation_id=sel.original_plantation_id,
        replacement_plantation_id=sel.replacement_plantation_id,
        binome_id=sel.binome_id,
        locked_at=sel.locked_at.isoformat(),
        locked_by_id=sel.locked_by_id,
        locked_by_name=current_user.full_name or current_user.username,
        locked_by_me=True,
    )


@router.get(
    "/api/binomes/{binome_id}/replacements",
    response_model=list[ReplacementOut],
    summary="Remplacements effectués par un binôme",
)
def list_binome_replacements(
    binome_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    if current_user.role == "binome" and current_user.binome_id != binome_id:
        raise HTTPException(403, "Accès refusé.")

    selections = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.binome_id == binome_id)
        .all()
    )
    return [
        ReplacementOut(
            id=s.id,
            original_plantation_id=s.original_plantation_id,
            replacement_plantation_id=s.replacement_plantation_id,
            binome_id=s.binome_id,
            locked_at=s.locked_at.isoformat(),
            locked_by_id=s.locked_by_id,
            locked_by_name=(
                (s.locked_by.full_name or s.locked_by.username)
                if s.locked_by else None
            ),
            locked_by_me=s.locked_by_id == current_user.id,
        )
        for s in selections
    ]


@router.delete(
    "/api/replacements/{replacement_id}",
    status_code=200,
    summary="Dégriser une plantation de remplacement (la libérer)",
)
def delete_replacement(
    replacement_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Libère une plantation de remplacement pour une future réutilisation.

    Réservé à l'utilisateur qui l'a verrouillée (dégrisage) ; l'administrateur
    dispose aussi de ce droit. La plantation introuvable redevient « non
    remplacée ».
    """
    sel = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.id == replacement_id)
        .first()
    )
    if not sel:
        raise HTTPException(404, "Remplacement introuvable.")

    if current_user.role != "admin" and sel.locked_by_id != current_user.id:
        raise HTTPException(
            403,
            "Seul le binôme qui a verrouillé ce remplacement peut le dégriser.",
        )

    db.delete(sel)
    db.commit()
    return {"message": "Remplacement dégrisé.", "replacement_id": replacement_id}


@router.post(
    "/api/replacements/from-stock",
    response_model=ReplacementOut,
    status_code=201,
    summary="Marquer une plantation hors-échantillon comme utilisée (remplacement)",
)
def create_stock_replacement(
    payload: StockReplacementCreate,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Permet à une équipe de remplacer une plantation échantillonnée par une
    plantation hors-échantillon de la MÊME brigade.

    - La plantation hors-échantillon devient « grisée » : elle ne peut plus être
      marquée une seconde fois (contrainte de non-réutilisation).
    - La plantation échantillonnée passe au statut « remplacée » dans
      « Mes plantations ».
    """
    original = _plantation_or_404(db, payload.original_plantation_id)
    replacement = _plantation_or_404(db, payload.replacement_plantation_id)

    # Périmètre équipe : chef/binôme limités aux brigades de leur équipe.
    if current_user.role != "admin":
        if current_user.team_id is None:
            raise HTTPException(403, "Votre compte n'est rattaché à aucune équipe.")
        allowed = {
            bid
            for (bid,) in (
                db.query(TeamBrigadeAssignment.brigade_id)
                .filter(TeamBrigadeAssignment.team_id == current_user.team_id)
                .all()
            )
        }
        if original.brigade_id not in allowed or replacement.brigade_id not in allowed:
            raise HTTPException(
                403,
                "Ces plantations n'appartiennent pas aux brigades de votre équipe.",
            )

    if replacement.is_sample:
        raise HTTPException(
            400,
            "La plantation à marquer doit être hors-échantillon.",
        )
    if not original.is_sample:
        raise HTTPException(
            400,
            "La plantation à remplacer doit appartenir à l'échantillon.",
        )
    if original.id == replacement.id:
        raise HTTPException(400, "Impossible de remplacer une plantation par elle-même.")
    if original.brigade_id is not None and replacement.brigade_id != original.brigade_id:
        raise HTTPException(
            400,
            "Le remplacement doit appartenir à la même brigade que la plantation échantillonnée.",
        )

    # Non-réutilisation du remplaçant (grisé après le premier choix).
    already = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.replacement_plantation_id == replacement.id)
        .first()
    )
    if already:
        raise HTTPException(
            409,
            "Cette plantation hors-échantillon a déjà été marquée comme utilisée "
            "pour un autre remplacement.",
        )
    # Une plantation échantillonnée ne peut être remplacée qu'une seule fois.
    already_replaced = (
        db.query(ReplacementSelection)
        .filter(ReplacementSelection.original_plantation_id == original.id)
        .first()
    )
    if already_replaced:
        raise HTTPException(
            409,
            "Cette plantation échantillonnée a déjà été remplacée.",
        )

    # Binôme détenteur de la sélection : binôme courant, sinon le binôme qui a
    # la plantation à remplacer, sinon le premier binôme de l'équipe.
    binome_id = current_user.binome_id
    if binome_id is None:
        sa = (
            db.query(SampleAssignment)
            .filter(SampleAssignment.plantation_id == original.id)
            .first()
        )
        if sa:
            binome_id = sa.binome_id
    team_id = current_user.team_id
    if team_id is None:
        if binome_id is not None:
            bin = db.query(Binome).filter(Binome.id == binome_id).first()
            team_id = bin.team_id if bin else None
    if binome_id is None:
        first = (
            db.query(Binome)
            .filter(Binome.team_id == team_id)
            .order_by(Binome.id)
            .first()
        )
        if first:
            binome_id = first.id
    if binome_id is None:
        raise HTTPException(
            400,
            "Aucun binôme disponible pour rattacher ce remplacement : créez un "
            "binôme dans votre équipe.",
        )

    try:
        sel = ReplacementSelection(
            original_plantation_id=original.id,
            replacement_plantation_id=replacement.id,
            binome_id=binome_id,
            locked_by_id=current_user.id,
        )
        db.add(sel)
        db.commit()
        db.refresh(sel)
    except Exception:
        db.rollback()
        raise HTTPException(
            409,
            "Cette plantation vient d'être marquée comme utilisée par quelqu'un d'autre.",
        )

    return ReplacementOut(
        id=sel.id,
        original_plantation_id=sel.original_plantation_id,
        replacement_plantation_id=sel.replacement_plantation_id,
        binome_id=sel.binome_id,
        locked_at=sel.locked_at.isoformat(),
        locked_by_id=sel.locked_by_id,
        locked_by_name=current_user.full_name or current_user.username,
        locked_by_me=True,
    )


# =============================================================================
# Routes — Fiches d'audit liées au binôme ("Mes fiches")
# =============================================================================

@router.get(
    "/api/binomes/{binome_id}/rehabilitations",
    summary="Fiches d'audit créées par un binôme",
)
def list_binome_rehabilitations(
    binome_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Retourne les fiches de réhabilitation créées par les membres du binôme.

    Utilise la colonne ``author_id`` ajoutée en Phase 2.
    Un binôme ne peut voir que ses propres fiches.
    """
    if current_user.role == "binome" and current_user.binome_id != binome_id:
        raise HTTPException(403, "Accès refusé.")

    # Récupère les users membres du binôme
    member_ids = (
        db.query(User.id)
        .filter(User.binome_id == binome_id)
        .subquery()
    )
    fiches = (
        db.query(Rehabilitation)
        .filter(Rehabilitation.author_id.in_(member_ids))
        .order_by(Rehabilitation.created_at.desc())
        .all()
    )
    # Retourne la structure légère (comme RehabilitationOut)
    from app import schemas
    return [schemas.RehabilitationOut.model_validate(f) for f in fiches]


@router.post(
    "/api/rehabilitations/{rehab_id}/link-plantation",
    summary="Lier une fiche à une plantation",
)
def link_rehabilitation_to_plantation(
    rehab_id: int,
    plantation_id: int = Query(...),
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Associe une fiche existante à une plantation (et enregistre l'auteur).

    Vérifie que la plantation appartient bien au binôme de l'utilisateur.
    """
    fiche = db.query(Rehabilitation).filter(Rehabilitation.id == rehab_id).first()
    if not fiche:
        raise HTTPException(404, "Fiche introuvable.")

    # Seul l'auteur original ou un admin peut modifier le lien
    if current_user.role not in ("admin", "chef_equipe") and fiche.author_id != current_user.id:
        raise HTTPException(403, "Vous n'êtes pas l'auteur de cette fiche.")

    p = _plantation_or_404(db, plantation_id)

    # Vérification binôme
    if current_user.binome_id:
        is_assigned = (
            db.query(SampleAssignment)
            .filter(
                SampleAssignment.plantation_id == plantation_id,
                SampleAssignment.binome_id == current_user.binome_id,
            )
            .first()
        )
        is_replacement = (
            db.query(ReplacementSelection)
            .filter(
                ReplacementSelection.replacement_plantation_id == plantation_id,
                ReplacementSelection.binome_id == current_user.binome_id,
            )
            .first()
        )
        if not is_assigned and not is_replacement:
            raise HTTPException(
                403,
                "Cette plantation n'est ni dans votre échantillon ni dans vos remplacements.",
            )

    fiche.plantation_id = plantation_id
    fiche.author_id = current_user.id
    db.commit()
    return {"message": "Fiche liée avec succès."}

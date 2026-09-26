"""Router de gestion des utilisateurs, équipes et binômes.

Toutes les routes de modification sont réservées aux administrateurs.
Les routes de lecture sont accessibles à tout utilisateur authentifié actif
(un non-admin ne voit que les données de son équipe).

Routes équipes  :  GET/POST /api/teams
                   GET/PUT/DELETE /api/teams/{id}
Routes binômes  :  GET/POST /api/teams/{team_id}/binomes
                   PUT/DELETE /api/binomes/{id}
Routes users    :  GET/POST /api/users                  (admin)
                   GET /api/users/{id}                  (admin ou soi-même)
                   PUT /api/users/{id}                  (admin)
                   DELETE /api/users/{id}               (admin)
                   POST /api/users/{id}/reset-password  (admin)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.dependencies import get_db, require_active, require_admin
from app.models import Binome, Team, User

router = APIRouter(tags=["Utilisateurs & Équipes"])


# =============================================================================
# Schémas Pydantic
# =============================================================================

# --- Équipes ---

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=180)


class TeamOut(BaseModel):
    id: int
    name: str
    nb_binomes: int = 0
    nb_members: int = 0

    class Config:
        from_attributes = True


# --- Binômes ---

class BinomeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)


class BinomeUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)


class BinomeOut(BaseModel):
    id: int
    name: str
    team_id: int
    nb_members: int = 0

    class Config:
        from_attributes = True


# --- Utilisateurs ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=100)
    full_name: Optional[str] = Field(None, max_length=180)
    password: str = Field(..., min_length=6, description="Mot de passe (min. 6 caractères)")
    role: str = Field("binome", pattern="^(admin|chef_equipe|binome)$")
    team_id: Optional[int] = None
    binome_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=180)
    role: Optional[str] = Field(None, pattern="^(admin|chef_equipe|binome)$")
    is_active: Optional[bool] = None
    team_id: Optional[int] = None
    binome_id: Optional[int] = None


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: str
    is_active: bool
    team_id: Optional[int]
    binome_id: Optional[int]
    team_name: Optional[str] = None
    binome_name: Optional[str] = None

    class Config:
        from_attributes = True


# =============================================================================
# Helpers
# =============================================================================

def _get_team_or_404(db: Session, team_id: int) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Équipe introuvable.")
    return team


def _get_binome_or_404(db: Session, binome_id: int) -> Binome:
    binome = db.query(Binome).filter(Binome.id == binome_id).first()
    if not binome:
        raise HTTPException(status_code=404, detail="Binôme introuvable.")
    return binome


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return user


def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
        team_id=u.team_id,
        binome_id=u.binome_id,
        team_name=u.team.name if u.team else None,
        binome_name=u.binome.name if u.binome else None,
    )


# =============================================================================
# Routes — Équipes
# =============================================================================

@router.get("/api/teams", response_model=list[TeamOut], summary="Liste des équipes")
def list_teams(
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    query = db.query(Team)
    if current_user.role != "admin" and current_user.team_id:
        query = query.filter(Team.id == current_user.team_id)
    teams = query.order_by(Team.name).all()
    return [TeamOut(id=t.id, name=t.name, nb_binomes=len(t.binomes), nb_members=len(t.members)) for t in teams]


@router.post("/api/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED, summary="Créer une équipe")
def create_team(
    payload: TeamCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(Team).filter(Team.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Une équipe avec ce nom existe déjà.")
    team = Team(name=payload.name)
    db.add(team)
    db.commit()
    db.refresh(team)
    return TeamOut(id=team.id, name=team.name)


@router.get("/api/teams/{team_id}", response_model=TeamOut, summary="Détail d'une équipe")
def get_team(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    team = _get_team_or_404(db, team_id)
    if current_user.role != "admin" and current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return TeamOut(id=team.id, name=team.name, nb_binomes=len(team.binomes), nb_members=len(team.members))


@router.put("/api/teams/{team_id}", response_model=TeamOut, summary="Modifier une équipe")
def update_team(
    team_id: int,
    payload: TeamUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    team = _get_team_or_404(db, team_id)
    if payload.name is not None:
        team.name = payload.name
    db.commit()
    db.refresh(team)
    return TeamOut(id=team.id, name=team.name, nb_binomes=len(team.binomes), nb_members=len(team.members))


@router.delete("/api/teams/{team_id}", status_code=204, summary="Supprimer une équipe")
def delete_team(
    team_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    team = _get_team_or_404(db, team_id)
    db.delete(team)
    db.commit()


# =============================================================================
# Routes — Binômes
# =============================================================================

@router.get(
    "/api/teams/{team_id}/binomes",
    response_model=list[BinomeOut],
    summary="Binômes d'une équipe",
)
def list_binomes(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    _get_team_or_404(db, team_id)
    if current_user.role != "admin" and current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    binomes = db.query(Binome).filter(Binome.team_id == team_id).order_by(Binome.name).all()
    return [
        BinomeOut(id=b.id, name=b.name, team_id=b.team_id, nb_members=len(b.members))
        for b in binomes
    ]


@router.get(
    "/api/teams/{team_id}/members",
    response_model=list[UserOut],
    summary="Membres d'une équipe",
)
def list_team_members(
    team_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    _get_team_or_404(db, team_id)
    if current_user.role != "admin" and current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    members = (
        db.query(User)
        .filter(User.team_id == team_id, User.is_active.is_(True))
        .order_by(User.full_name, User.username)
        .all()
    )
    return [_user_to_out(member) for member in members]


@router.post(
    "/api/teams/{team_id}/binomes",
    response_model=BinomeOut,
    status_code=201,
    summary="Créer un binôme dans une équipe",
)
def create_binome(
    team_id: int,
    payload: BinomeCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _get_team_or_404(db, team_id)
    existing = (
        db.query(Binome)
        .filter(Binome.name == payload.name, Binome.team_id == team_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ce binôme existe déjà dans cette équipe.")
    binome = Binome(name=payload.name, team_id=team_id)
    db.add(binome)
    db.commit()
    db.refresh(binome)
    return BinomeOut(id=binome.id, name=binome.name, team_id=binome.team_id)


@router.put("/api/binomes/{binome_id}", response_model=BinomeOut, summary="Renommer un binôme")
def update_binome(
    binome_id: int,
    payload: BinomeUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    binome = _get_binome_or_404(db, binome_id)
    binome.name = payload.name
    db.commit()
    db.refresh(binome)
    return BinomeOut(
        id=binome.id,
        name=binome.name,
        team_id=binome.team_id,
        nb_members=len(binome.members),
    )


@router.delete("/api/binomes/{binome_id}", status_code=204, summary="Supprimer un binôme")
def delete_binome(
    binome_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    binome = _get_binome_or_404(db, binome_id)
    db.delete(binome)
    db.commit()


# =============================================================================
# Routes — Utilisateurs
# =============================================================================

@router.get("/api/users", response_model=list[UserOut], summary="Liste des utilisateurs")
def list_users(
    team_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Liste tous les utilisateurs (admin uniquement).

    Filtres optionnels : ``team_id``, ``role``.
    """
    query = db.query(User)
    if team_id:
        query = query.filter(User.team_id == team_id)
    if role:
        query = query.filter(User.role == role)
    users = query.order_by(User.username).all()
    return [_user_to_out(u) for u in users]


@router.post(
    "/api/users",
    response_model=UserOut,
    status_code=201,
    summary="Créer un utilisateur",
)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Crée un utilisateur (admin uniquement).

    - Le ``username`` est normalisé en minuscules.
    - Le mot de passe est haché avec bcrypt avant stockage.
    - Si ``binome_id`` est fourni, vérifie qu'il appartient bien à ``team_id``.
    """
    username = payload.username.strip().lower()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur est déjà pris.")

    # Vérifier la cohérence équipe/binôme
    if payload.binome_id and payload.team_id:
        binome = _get_binome_or_404(db, payload.binome_id)
        if binome.team_id != payload.team_id:
            raise HTTPException(
                status_code=400,
                detail="Le binôme n'appartient pas à l'équipe indiquée.",
            )

    user = User(
        username=username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        team_id=payload.team_id,
        binome_id=payload.binome_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.get("/api/users/{user_id}", response_model=UserOut, summary="Détail d'un utilisateur")
def get_user(
    user_id: int,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Un admin peut consulter n'importe quel utilisateur.
    Un utilisateur standard ne peut consulter que son propre profil.
    """
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    user = _get_user_or_404(db, user_id)
    return _user_to_out(user)


@router.put("/api/users/{user_id}", response_model=UserOut, summary="Modifier un utilisateur")
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Met à jour le profil d'un utilisateur (admin uniquement).

    Vérifie la cohérence binôme/équipe si les deux sont fournis.
    """
    user = _get_user_or_404(db, user_id)

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.team_id is not None:
        user.team_id = payload.team_id
    if payload.binome_id is not None:
        effective_team = payload.team_id or user.team_id
        if effective_team:
            binome = _get_binome_or_404(db, payload.binome_id)
            if binome.team_id != effective_team:
                raise HTTPException(
                    status_code=400,
                    detail="Le binôme n'appartient pas à l'équipe indiquée.",
                )
        user.binome_id = payload.binome_id

    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.delete("/api/users/{user_id}", status_code=204, summary="Supprimer un utilisateur")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Supprime un utilisateur. Un admin ne peut pas se supprimer lui-même."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez pas supprimer votre propre compte.",
        )
    user = _get_user_or_404(db, user_id)
    db.delete(user)
    db.commit()


@router.post(
    "/api/users/{user_id}/reset-password",
    summary="Réinitialiser le mot de passe",
)
def reset_password(
    user_id: int,
    payload: PasswordReset,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Réinitialise le mot de passe d'un utilisateur (admin uniquement)."""
    user = _get_user_or_404(db, user_id)
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Mot de passe réinitialisé avec succès."}

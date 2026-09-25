"""Router d'authentification.

Routes :
  POST /api/auth/login           → échange username/password contre un JWT
  GET  /api/auth/me              → retourne le profil de l'utilisateur connecté
  POST /api/auth/logout          → révocation côté client (stateless JWT)
  POST /api/auth/change-password → changement de mot de passe (utilisateur connecté)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.dependencies import get_db, require_active
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


# ---------------------------------------------------------------------------
# Schémas Pydantic
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Nom d'utilisateur")
    password: str = Field(..., min_length=1, description="Mot de passe")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str | None
    team_id: int | None
    binome_id: int | None


class MeResponse(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    is_active: bool
    team_id: int | None
    binome_id: int | None
    team_name: str | None
    binome_name: str | None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Mot de passe actuel")
    new_password: str = Field(..., min_length=6, description="Nouveau mot de passe (min. 6 caractères)")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse, summary="Connexion")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authentifie un utilisateur et retourne un token JWT.

    - Cherche l'utilisateur par ``username`` (insensible à la casse).
    - Vérifie le mot de passe avec bcrypt.
    - Retourne un token JWT valide pour la durée configurée.

    Erreurs :
    - 401 si les identifiants sont incorrects.
    - 403 si le compte est désactivé.
    """
    user: User | None = (
        db.query(User)
        .filter(User.username == payload.username.strip().lower())
        .first()
    )

    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants incorrects.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise _invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé. Contactez un administrateur.",
        )

    token = create_access_token(
        subject=user.username,
        role=user.role,
        team_id=user.team_id,
        binome_id=user.binome_id,
    )

    return TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
        full_name=user.full_name,
        team_id=user.team_id,
        binome_id=user.binome_id,
    )


@router.get("/me", response_model=MeResponse, summary="Profil connecté")
def me(current_user: User = Depends(require_active)):
    """Retourne le profil complet de l'utilisateur authentifié."""
    return MeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        team_id=current_user.team_id,
        binome_id=current_user.binome_id,
        team_name=current_user.team.name if current_user.team else None,
        binome_name=current_user.binome.name if current_user.binome else None,
    )


@router.post("/logout", summary="Déconnexion")
def logout():
    """Déconnexion côté client (stateless JWT — nettoyage côté frontend)."""
    return {"message": "Déconnecté avec succès."}


@router.post("/change-password", summary="Changer son mot de passe")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Permet à l'utilisateur connecté de changer son propre mot de passe.

    - Vérifie que ``current_password`` correspond au hash stocké.
    - Refuse si le nouveau mot de passe est identique à l'ancien.
    - Met à jour le hash bcrypt en base.
    """
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe actuel est incorrect.",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent de l'ancien.",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Mot de passe modifié avec succès."}

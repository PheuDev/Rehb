"""Dépendances FastAPI partagées entre les routers.

Hiérarchie des gardes :
  get_current_user   → vérifie le token JWT, charge l'utilisateur en DB
  require_active     → exige is_active=True
  require_admin      → exige role='admin'
  require_chef_or_admin → exige role in ('admin', 'chef_equipe')
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import get_db
from app.models import User

__all__ = [
    "get_db",
    "get_current_user",
    "require_active",
    "require_admin",
    "require_chef_or_admin",
]

# Schéma Bearer — extrait le token de l'en-tête Authorization
_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Non authentifié. Veuillez vous connecter.",
    headers={"WWW-Authenticate": "Bearer"},
)

_INACTIVE = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Compte désactivé. Contactez un administrateur.",
)

_FORBIDDEN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Vous n'avez pas les droits nécessaires pour cette action.",
)


# ---------------------------------------------------------------------------
# Dépendance de base : décode le token et charge l'utilisateur
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Session = Depends(get_db),
) -> User:
    """Décode le JWT et retourne l'utilisateur correspondant.

    Lève HTTP 401 si :
    - Aucun header Authorization n'est fourni
    - Le token est invalide ou expiré
    - L'utilisateur n'existe plus en base
    """
    if credentials is None:
        raise _UNAUTHORIZED

    try:
        payload = decode_access_token(credentials.credentials)
        username: str = payload.get("sub")
        if not username:
            raise _UNAUTHORIZED
    except JWTError:
        raise _UNAUTHORIZED

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise _UNAUTHORIZED
    return user


# ---------------------------------------------------------------------------
# Gardes dérivées
# ---------------------------------------------------------------------------

def require_active(current_user: User = Depends(get_current_user)) -> User:
    """Lève HTTP 403 si le compte est désactivé."""
    if not current_user.is_active:
        raise _INACTIVE
    return current_user


def require_admin(current_user: User = Depends(require_active)) -> User:
    """Réserve l'accès aux administrateurs."""
    if current_user.role != "admin":
        raise _FORBIDDEN
    return current_user


def require_chef_or_admin(current_user: User = Depends(require_active)) -> User:
    """Réserve l'accès aux chefs d'équipe et aux admins."""
    if current_user.role not in ("admin", "chef_equipe"):
        raise _FORBIDDEN
    return current_user

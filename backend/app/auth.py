"""Utilitaires d'authentification : hachage de mots de passe et tokens JWT."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# ---------------------------------------------------------------------------
# Contexte de hachage (bcrypt)
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Retourne le hash bcrypt d'un mot de passe en clair."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie qu'un mot de passe en clair correspond au hash stocké."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# Tokens JWT
# ---------------------------------------------------------------------------

def create_access_token(
    subject: str,
    role: str,
    team_id: Optional[int] = None,
    binome_id: Optional[int] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Génère un token JWT signé.

    Args:
        subject:    Identifiant unique de l'utilisateur (username ou id).
        role:       Rôle de l'utilisateur ('admin', 'chef_equipe', 'binome').
        team_id:    ID de l'équipe, inclus dans le payload pour éviter des
                    requêtes DB supplémentaires sur chaque endpoint protégé.
        binome_id:  ID du binôme, idem.
        expires_delta: Durée de vie personnalisée. Par défaut utilise la config.

    Returns:
        Token JWT encodé (str).
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }
    if team_id is not None:
        payload["team_id"] = team_id
    if binome_id is not None:
        payload["binome_id"] = binome_id

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Décode et valide un token JWT.

    Returns:
        Le payload décodé si le token est valide.

    Raises:
        JWTError: si le token est invalide, expiré ou mal formé.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configuration centralisée, lue depuis les variables d'environnement."""

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/rehab_db",
    )
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")

    # --- Authentification JWT ---
    # Générer avec : python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "changez-cette-valeur-en-production-avec-une-cle-secrete-forte",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")  # 8 heures par défaut
    )


settings = Settings()

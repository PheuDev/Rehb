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


settings = Settings()

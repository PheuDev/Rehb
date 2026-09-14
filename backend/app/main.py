import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.routers import rehabilitations

logger = logging.getLogger("uvicorn.error")

SCHEMA_FILE = Path(__file__).resolve().parent.parent / "sql" / "schema.sql"
MAX_DB_RETRIES = 10
DB_RETRY_DELAY = 3.0

NULLABLE_COLUMNS = (
    "pda_number",
    "departement",
    "commune",
    "arrondissement",
    "village",
    "annee_rehabilitation",
    "superficie_rehabilitee",
)


def migrate_nullable_rehabilitations() -> None:
    """Met à niveau une base existante pour accepter les fiches partielles."""
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        for column in NULLABLE_COLUMNS:
            conn.exec_driver_sql(
                f"ALTER TABLE rehabilitations ALTER COLUMN {column} DROP NOT NULL"
            )

        expression = conn.execute(
            text(
                "SELECT generation_expression FROM information_schema.columns "
                "WHERE table_name = 'rehabilitations' AND column_name = 'sup_class'"
            )
        ).scalar()
        if expression and "is null" in expression.lower():
            return

        # PostgreSQL ne permet pas de modifier l'expression d'une colonne
        # générée : on la recrée pour gérer aussi la superficie absente.
        conn.exec_driver_sql("DROP VIEW IF EXISTS v_rehabilitations_synthese")
        conn.exec_driver_sql("DROP INDEX IF EXISTS ix_rehab_sup_class")
        conn.exec_driver_sql("ALTER TABLE rehabilitations DROP COLUMN sup_class")
        conn.exec_driver_sql(
            "ALTER TABLE rehabilitations ADD COLUMN sup_class VARCHAR(30) "
            "GENERATED ALWAYS AS (CASE "
            "WHEN superficie_rehabilitee IS NULL THEN NULL "
            "WHEN superficie_rehabilitee <= 5 THEN 'S ≤ 5 ha' "
            "WHEN superficie_rehabilitee <= 10 THEN '5 < S ≤ 10 ha' "
            "WHEN superficie_rehabilitee <= 20 THEN '10 < S ≤ 20 ha' "
            "ELSE 'S > 20 ha' END) STORED"
        )
        conn.exec_driver_sql("CREATE INDEX ix_rehab_sup_class ON rehabilitations (sup_class)")
        conn.exec_driver_sql(
            "CREATE VIEW v_rehabilitations_synthese AS "
            "SELECT id, pda_number, departement, commune, arrondissement, village, "
            "annee_rehabilitation, brigade_name, producer_name, superficie_rehabilitee, sup_class, "
            "(coalesce(desherbage_superficie, 0) + coalesce(eclaircie_superficie, 0) + "
            "coalesce(elagage_superficie, 0) + coalesce(debardage_superficie, 0)) "
            "AS superficie_totale_operations, created_at, updated_at FROM rehabilitations"
        )


def ensure_database_schema() -> None:
    """Attend que la base soit joignable puis applique le schéma si nécessaire.

    Le fichier ``sql/schema.sql`` est idempotent (IF NOT EXISTS / CREATE OR
    REPLACE) : il peut donc être rejoué sans risque à chaque démarrage.
    """
    for attempt in range(1, MAX_DB_RETRIES + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except Exception as exc:  # base pas encore prête
            if attempt < MAX_DB_RETRIES:
                logger.warning(
                    "Base de données indisponible (tentative %s/%s) : %s",
                    attempt,
                    MAX_DB_RETRIES,
                    exc,
                )
                time.sleep(DB_RETRY_DELAY)
            else:
                raise

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM rehabilitations LIMIT 1"))
        logger.info("Table `rehabilitations` déjà présente : schéma ignoré.")
    except Exception:
        logger.info("Application du schéma (%s)...", SCHEMA_FILE)
        with engine.begin() as conn:
            conn.exec_driver_sql(SCHEMA_FILE.read_text(encoding="utf-8"))
        logger.info("Schéma appliqué avec succès.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_database_schema()
    migrate_nullable_rehabilitations()
    yield


app = FastAPI(
    title="API — Gestion des réhabilitations forestières",
    description="API REST pour la gestion des fiches de réhabilitation forestière (PDA).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Renvoie des messages d'erreur de validation clairs et en français."""
    errors = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        errors.append({"champ": field, "message": err.get("msg")})
    return JSONResponse(status_code=422, content={"detail": "Données invalides.", "erreurs": errors})


@app.get("/api/health", tags=["Système"])
def health_check():
    return {"status": "ok"}


app.include_router(rehabilitations.router)

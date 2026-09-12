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

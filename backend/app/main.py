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
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import terrain as terrain_router

logger = logging.getLogger("uvicorn.error")

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

# DDL de base (tables, index, triggers, vues) — sans blocs DO $$
# Chaque entrée est une instruction SQL autonome.
BASE_DDL = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",

    # Fonction trigger partagée
    """CREATE OR REPLACE FUNCTION trg_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql""",

    # ------------------------------------------------------------------
    # Équipes
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS teams (
        id          SERIAL       PRIMARY KEY,
        name        VARCHAR(180) NOT NULL,
        campaign    VARCHAR(50)  NOT NULL,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        CONSTRAINT uq_team_name_campaign UNIQUE (name, campaign)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_team_campaign ON teams (campaign)",

    # ------------------------------------------------------------------
    # Binômes
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS binomes (
        id          SERIAL       PRIMARY KEY,
        name        VARCHAR(180) NOT NULL,
        team_id     INTEGER      NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        CONSTRAINT uq_binome_name_team UNIQUE (name, team_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_binome_team ON binomes (team_id)",

    # ------------------------------------------------------------------
    # Utilisateurs
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS users (
        id               SERIAL       PRIMARY KEY,
        username         VARCHAR(100) NOT NULL UNIQUE,
        full_name        VARCHAR(180),
        hashed_password  VARCHAR(255) NOT NULL,
        role             VARCHAR(20)  NOT NULL DEFAULT 'binome'
                             CHECK (role IN ('admin', 'chef_equipe', 'binome')),
        is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
        team_id          INTEGER      REFERENCES teams   (id) ON DELETE SET NULL,
        binome_id        INTEGER      REFERENCES binomes (id) ON DELETE SET NULL,
        created_at       TIMESTAMPTZ  DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_user_username ON users (username)",
    "CREATE INDEX IF NOT EXISTS ix_user_team     ON users (team_id)",
    "CREATE INDEX IF NOT EXISTS ix_user_binome   ON users (binome_id)",
    "DROP TRIGGER IF EXISTS set_users_updated_at ON users",
    """CREATE TRIGGER set_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()""",

    # ------------------------------------------------------------------
    # Brigades entités
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS brigade_entities (
        id            SERIAL       PRIMARY KEY,
        name          VARCHAR(180) NOT NULL UNIQUE,
        manager_name  VARCHAR(180),
        manager_phone VARCHAR(30),
        created_at    TIMESTAMPTZ  DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_brigade_entities_name ON brigade_entities (name)",

    # ------------------------------------------------------------------
    # Affectations brigade → équipe
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS team_brigade_assignments (
        id          SERIAL      PRIMARY KEY,
        brigade_id  INTEGER     NOT NULL REFERENCES brigade_entities (id) ON DELETE CASCADE,
        team_id     INTEGER     NOT NULL REFERENCES teams             (id) ON DELETE CASCADE,
        campaign    VARCHAR(50) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_brigade_campaign UNIQUE (brigade_id, campaign)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_tba_team     ON team_brigade_assignments (team_id)",
    "CREATE INDEX IF NOT EXISTS ix_tba_campaign ON team_brigade_assignments (campaign)",

    # ------------------------------------------------------------------
    # Plantations
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS plantations (
        id             SERIAL        PRIMARY KEY,
        pda_number     VARCHAR(50),
        producer_name  VARCHAR(180),
        producer_phone VARCHAR(30),
        departement    VARCHAR(120),
        commune        VARCHAR(120),
        arrondissement VARCHAR(120),
        village        VARCHAR(120),
        superficie     NUMERIC(10,2),
        brigade_id     INTEGER       REFERENCES brigade_entities (id) ON DELETE SET NULL,
        is_sample      BOOLEAN       NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ   DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_plantation_brigade   ON plantations (brigade_id)",
    "CREATE INDEX IF NOT EXISTS ix_plantation_is_sample ON plantations (is_sample)",
    "CREATE INDEX IF NOT EXISTS ix_plantation_pda       ON plantations (pda_number)",

    # ------------------------------------------------------------------
    # Attributions
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS sample_assignments (
        id            SERIAL  PRIMARY KEY,
        plantation_id INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
        binome_id     INTEGER NOT NULL REFERENCES binomes     (id) ON DELETE CASCADE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_assignment_plantation_binome UNIQUE (plantation_id, binome_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_sa_plantation ON sample_assignments (plantation_id)",
    "CREATE INDEX IF NOT EXISTS ix_sa_binome     ON sample_assignments (binome_id)",

    # ------------------------------------------------------------------
    # Remplacements
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS replacement_selections (
        id                        SERIAL  PRIMARY KEY,
        original_plantation_id    INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
        replacement_plantation_id INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
        binome_id                 INTEGER NOT NULL REFERENCES binomes     (id) ON DELETE CASCADE,
        locked_at                 TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_replacement_plantation_unique UNIQUE (replacement_plantation_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_rs_original ON replacement_selections (original_plantation_id)",
    "CREATE INDEX IF NOT EXISTS ix_rs_binome   ON replacement_selections (binome_id)",

    # ------------------------------------------------------------------
    # Fiches de réhabilitation
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS rehabilitations (
        id                          SERIAL       PRIMARY KEY,
        pda_number                  VARCHAR(50),
        departement                 VARCHAR(120),
        commune                     VARCHAR(120),
        arrondissement              VARCHAR(120),
        village                     VARCHAR(120),
        annee_rehabilitation        SMALLINT     CHECK (annee_rehabilitation BETWEEN 1990 AND 2100),
        brigade_name                VARCHAR(180),
        brigade_manager_name        VARCHAR(180),
        brigade_manager_phone       VARCHAR(30),
        producer_name               VARCHAR(180),
        producer_phone              VARCHAR(30),
        superficie_rehabilitee      NUMERIC(10,2) CHECK (superficie_rehabilitee >= 0),
        sup_class VARCHAR(30) GENERATED ALWAYS AS (
            CASE
                WHEN superficie_rehabilitee IS NULL  THEN NULL
                WHEN superficie_rehabilitee < 1      THEN 'S < 1 ha'
                WHEN superficie_rehabilitee < 2      THEN '1 \u2264 S < 2 ha'
                WHEN superficie_rehabilitee < 3      THEN '2 \u2264 S < 3 ha'
                WHEN superficie_rehabilitee < 5      THEN '3 \u2264 S < 5 ha'
                WHEN superficie_rehabilitee < 10     THEN '5 \u2264 S < 10 ha'
                WHEN superficie_rehabilitee < 20     THEN '10 \u2264 S < 20 ha'
                WHEN superficie_rehabilitee <= 30    THEN '20 \u2264 S \u2264 30 ha'
                ELSE 'S > 30 ha'
            END
        ) STORED,
        desherbage_superficie       NUMERIC(10,2) CHECK (desherbage_superficie  >= 0),
        desherbage_operateur_nom    VARCHAR(180),
        desherbage_operateur_phone  VARCHAR(30),
        eclaircie_superficie        NUMERIC(10,2) CHECK (eclaircie_superficie   >= 0),
        eclaircie_operateur_nom     VARCHAR(180),
        eclaircie_operateur_phone   VARCHAR(30),
        elagage_superficie          NUMERIC(10,2) CHECK (elagage_superficie     >= 0),
        elagage_operateur_nom       VARCHAR(180),
        elagage_operateur_phone     VARCHAR(30),
        debardage_superficie        NUMERIC(10,2) CHECK (debardage_superficie   >= 0),
        debardage_operateur_nom     VARCHAR(180),
        debardage_operateur_phone   VARCHAR(30),
        observations                TEXT,
        author_id                   INTEGER      REFERENCES users        (id) ON DELETE SET NULL,
        plantation_id               INTEGER      REFERENCES plantations  (id) ON DELETE SET NULL,
        created_at                  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ  DEFAULT NOW()
    )""",

    "DROP TRIGGER IF EXISTS set_updated_at ON rehabilitations",
    """CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON rehabilitations
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()""",

    "CREATE INDEX IF NOT EXISTS ix_rehab_departement  ON rehabilitations (departement)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_commune      ON rehabilitations (commune)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_village      ON rehabilitations (village)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_annee        ON rehabilitations (annee_rehabilitation)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_sup_class    ON rehabilitations (sup_class)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_brigade      ON rehabilitations (brigade_name)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_author       ON rehabilitations (author_id)",
    "CREATE INDEX IF NOT EXISTS ix_rehab_plantation   ON rehabilitations (plantation_id)",

    """CREATE INDEX IF NOT EXISTS ix_rehab_search_trgm ON rehabilitations
    USING GIN (
        (
            coalesce(pda_number, '')            || ' ' ||
            coalesce(departement, '')           || ' ' ||
            coalesce(commune, '')               || ' ' ||
            coalesce(arrondissement, '')        || ' ' ||
            coalesce(village, '')               || ' ' ||
            coalesce(brigade_name, '')          || ' ' ||
            coalesce(brigade_manager_name, '')  || ' ' ||
            coalesce(producer_name, '')
        ) gin_trgm_ops
    )""",

    # Vue de synthèse enrichie (auteur)
    "DROP VIEW IF EXISTS v_rehabilitations_synthese",
    """CREATE VIEW v_rehabilitations_synthese AS
    SELECT
        r.id,
        r.pda_number,
        r.departement,
        r.commune,
        r.arrondissement,
        r.village,
        r.annee_rehabilitation,
        r.brigade_name,
        r.producer_name,
        r.superficie_rehabilitee,
        r.sup_class,
        (
            coalesce(r.desherbage_superficie, 0) +
            coalesce(r.eclaircie_superficie,  0) +
            coalesce(r.elagage_superficie,    0) +
            coalesce(r.debardage_superficie,  0)
        ) AS superficie_totale_operations,
        r.author_id,
        u.username  AS author_username,
        u.full_name AS author_full_name,
        r.plantation_id,
        r.created_at,
        r.updated_at
    FROM rehabilitations r
    LEFT JOIN users u ON u.id = r.author_id""",
]


def _wait_for_db() -> None:
    """Attend que la base de données soit joignable."""
    for attempt in range(1, MAX_DB_RETRIES + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as exc:
            if attempt < MAX_DB_RETRIES:
                logger.warning(
                    "Base de données indisponible (tentative %s/%s) : %s",
                    attempt, MAX_DB_RETRIES, exc,
                )
                time.sleep(DB_RETRY_DELAY)
            else:
                raise


def ensure_database_schema() -> None:
    """Applique le schéma complet instruction par instruction.

    Chaque DDL est exécuté séparément pour éviter les problèmes de parsing
    SQLAlchemy avec les blocs multi-instructions (DO $$, etc.).
    Les migrations structurelles (colonnes nullable, nouvelles colonnes)
    sont gérées en Python dans des fonctions dédiées.
    """
    _wait_for_db()
    logger.info("Application du schéma DDL (%d instructions)...", len(BASE_DDL))
    with engine.begin() as conn:
        for ddl in BASE_DDL:
            try:
                conn.exec_driver_sql(ddl.strip())
            except Exception as exc:
                # On ignore les erreurs bénignes (objet déjà existant, etc.)
                # mais on log pour visibilité
                logger.debug("DDL ignoré (%s) : %.80s", type(exc).__name__, ddl[:80])
    logger.info("Schéma appliqué avec succès.")


def migrate_nullable_rehabilitations() -> None:
    """Rend nullable les colonnes historiquement NOT NULL."""
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as conn:
        for column in NULLABLE_COLUMNS:
            try:
                conn.exec_driver_sql(
                    f"ALTER TABLE rehabilitations ALTER COLUMN {column} DROP NOT NULL"
                )
            except Exception:
                pass  # Déjà nullable

        # Vérifie si sup_class gère déjà NULL
        expression = conn.execute(
            text(
                "SELECT generation_expression FROM information_schema.columns "
                "WHERE table_name = 'rehabilitations' AND column_name = 'sup_class'"
            )
        ).scalar()
        if expression and "is null" in expression.lower():
            return

        # Recrée sup_class pour gérer la superficie absente
        try:
            conn.exec_driver_sql("DROP VIEW IF EXISTS v_rehabilitations_synthese")
            conn.exec_driver_sql("DROP INDEX IF EXISTS ix_rehab_sup_class")
            conn.exec_driver_sql("ALTER TABLE rehabilitations DROP COLUMN IF EXISTS sup_class")
            conn.exec_driver_sql(
                "ALTER TABLE rehabilitations ADD COLUMN sup_class VARCHAR(30) "
                "GENERATED ALWAYS AS (CASE "
                "WHEN superficie_rehabilitee IS NULL THEN NULL "
                "WHEN superficie_rehabilitee < 1 THEN 'S < 1 ha' "
                "WHEN superficie_rehabilitee < 2 THEN '1 \u2264 S < 2 ha' "
                "WHEN superficie_rehabilitee < 3 THEN '2 \u2264 S < 3 ha' "
                "WHEN superficie_rehabilitee < 5 THEN '3 \u2264 S < 5 ha' "
                "WHEN superficie_rehabilitee < 10 THEN '5 \u2264 S < 10 ha' "
                "WHEN superficie_rehabilitee < 20 THEN '10 \u2264 S < 20 ha' "
                "WHEN superficie_rehabilitee <= 30 THEN '20 \u2264 S \u2264 30 ha' "
                "ELSE 'S > 30 ha' END) STORED"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_rehab_sup_class ON rehabilitations (sup_class)"
            )
        except Exception as exc:
            logger.warning("Migration sup_class ignorée : %s", exc)


def migrate_phase2_columns() -> None:
    """Ajoute author_id et plantation_id sur rehabilitations si absentes."""
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as conn:
        # author_id
        exists = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='rehabilitations' AND column_name='author_id'"
            )
        ).scalar()
        if not exists:
            try:
                conn.exec_driver_sql(
                    "ALTER TABLE rehabilitations "
                    "ADD COLUMN author_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_rehab_author ON rehabilitations (author_id)"
                )
                logger.info("Colonne author_id ajoutée à rehabilitations.")
            except Exception as exc:
                logger.warning("author_id non ajouté : %s", exc)

        # plantation_id
        exists2 = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='rehabilitations' AND column_name='plantation_id'"
            )
        ).scalar()
        if not exists2:
            try:
                conn.exec_driver_sql(
                    "ALTER TABLE rehabilitations "
                    "ADD COLUMN plantation_id INTEGER REFERENCES plantations(id) ON DELETE SET NULL"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_rehab_plantation ON rehabilitations (plantation_id)"
                )
                logger.info("Colonne plantation_id ajoutée à rehabilitations.")
            except Exception as exc:
                logger.warning("plantation_id non ajouté : %s", exc)


def _rebuild_view() -> None:
    """Recrée la vue de synthèse avec les colonnes Phase 2."""
    with engine.begin() as conn:
        try:
            conn.exec_driver_sql("DROP VIEW IF EXISTS v_rehabilitations_synthese")
            conn.exec_driver_sql(
                "CREATE VIEW v_rehabilitations_synthese AS "
                "SELECT r.id, r.pda_number, r.departement, r.commune, r.arrondissement, "
                "r.village, r.annee_rehabilitation, r.brigade_name, r.producer_name, "
                "r.superficie_rehabilitee, r.sup_class, "
                "(coalesce(r.desherbage_superficie,0)+coalesce(r.eclaircie_superficie,0)+"
                "coalesce(r.elagage_superficie,0)+coalesce(r.debardage_superficie,0)) "
                "AS superficie_totale_operations, "
                "r.author_id, u.username AS author_username, u.full_name AS author_full_name, "
                "r.plantation_id, r.created_at, r.updated_at "
                "FROM rehabilitations r LEFT JOIN users u ON u.id = r.author_id"
            )
            logger.info("Vue v_rehabilitations_synthese recréée.")
        except Exception as exc:
            logger.warning("Impossible de recréer la vue : %s", exc)


def _seed_default_admin() -> None:
    """Crée le compte admin par défaut s'il n'existe aucun administrateur."""
    import os
    from sqlalchemy.orm import Session as _Session
    from app.database import SessionLocal
    from app.models import User
    from app.auth import hash_password

    db: _Session = SessionLocal()
    try:
        existing = db.query(User).filter(User.role == "admin").first()
        if existing:
            return
        default_password = os.getenv("ADMIN_PASSWORD", "admin")
        admin = User(
            username="admin",
            full_name="Administrateur",
            hashed_password=hash_password(default_password),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.warning(
            "Compte admin créé (username='admin'). "
            "CHANGEZ ce mot de passe via /admin → Utilisateurs → Réinitialiser."
        )
    except Exception as exc:
        db.rollback()
        logger.error("Impossible de créer le compte admin : %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_database_schema()
    migrate_nullable_rehabilitations()
    migrate_phase2_columns()
    _rebuild_view()
    _seed_default_admin()
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
    errors = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        errors.append({"champ": field, "message": err.get("msg")})
    return JSONResponse(status_code=422, content={"detail": "Données invalides.", "erreurs": errors})


@app.get("/api/health", tags=["Système"])
def health_check():
    return {"status": "ok"}


app.include_router(rehabilitations.router)
app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(terrain_router.router)

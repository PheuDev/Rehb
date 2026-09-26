import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

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
    # Équipes (sans campagne — entité permanente)
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS teams (
        id          SERIAL       PRIMARY KEY,
        name        VARCHAR(180) NOT NULL UNIQUE,
        created_at  TIMESTAMPTZ  DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_team_name ON teams (name)",

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
    # Affectations brigade → équipe (UNIQUE brigade_id = une brigade, une équipe)
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS team_brigade_assignments (
        id          SERIAL  PRIMARY KEY,
        brigade_id  INTEGER NOT NULL UNIQUE REFERENCES brigade_entities (id) ON DELETE CASCADE,
        team_id     INTEGER NOT NULL        REFERENCES teams             (id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_tba_team ON team_brigade_assignments (team_id)",

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
        inspection_completed BOOLEAN NOT NULL DEFAULT FALSE,
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
        locked_by_id              INTEGER REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT uq_replacement_plantation_unique UNIQUE (replacement_plantation_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_rs_original ON replacement_selections (original_plantation_id)",
    "CREATE INDEX IF NOT EXISTS ix_rs_binome   ON replacement_selections (binome_id)",
    # Migration : qui a grisé la plantation (dégrisage réservé au verrouilleur)
    "ALTER TABLE replacement_selections ADD COLUMN IF NOT EXISTS locked_by_id INTEGER REFERENCES users (id) ON DELETE SET NULL",
    "CREATE INDEX IF NOT EXISTS ix_rs_locked_by ON replacement_selections (locked_by_id)",

    # ------------------------------------------------------------------
    # Fiches de réhabilitation
    # NOTE : author_id et plantation_id sont ajoutés APRÈS via
    #        migrate_phase2_columns() pour éviter tout problème d'ordre
    #        de création sur une base existante (production).
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
    # ix_rehab_author et ix_rehab_plantation sont créés par migrate_phase2_columns()

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

    # ------------------------------------------------------------------
    # Suggestions d'audit superficie sauvegardées
    # ------------------------------------------------------------------
    """CREATE TABLE IF NOT EXISTS saved_audit_suggestions (
        id                      SERIAL PRIMARY KEY,
        title                   VARCHAR(200) NOT NULL,
        created_by_id           INTEGER REFERENCES users (id) ON DELETE SET NULL,
        brigade_filter          JSONB,
        snapshot                JSONB NOT NULL,
        nb_fiches_echantillon   INTEGER NOT NULL DEFAULT 0,
        superficie_echantillon  NUMERIC(12,2),
        pourcentage_couverture  NUMERIC(6,2),
        created_at              TIMESTAMPTZ DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_saved_audit_created_by ON saved_audit_suggestions (created_by_id)",
    "CREATE INDEX IF NOT EXISTS ix_saved_audit_created_at ON saved_audit_suggestions (created_at)",

    """CREATE TABLE IF NOT EXISTS team_audit_assignments (
        id                    SERIAL PRIMARY KEY,
        audit_suggestion_id   INTEGER NOT NULL REFERENCES saved_audit_suggestions (id) ON DELETE CASCADE,
        team_id               INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        plantation_id         INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
        rehabilitation_id     INTEGER REFERENCES rehabilitations (id) ON DELETE SET NULL,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_team_audit_plantation UNIQUE (team_id, plantation_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_team_audit_team ON team_audit_assignments (team_id)",
    "CREATE INDEX IF NOT EXISTS ix_team_audit_suggestion ON team_audit_assignments (audit_suggestion_id)",
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


# Tables indispensables au bon fonctionnement de l'API. Sert de garde-fou :
# leur absence après l'application du schéma est signalée explicitement dans
# les logs (au lieu d'échouer silencieusement).
REQUIRED_TABLES = (
    "teams",
    "binomes",
    "users",
    "brigade_entities",
    "team_brigade_assignments",
    "plantations",
    "sample_assignments",
    "replacement_selections",
    "rehabilitations",
)


def _exec_ddl(sql: str, label: str = "") -> bool:
    """Exécute UNE instruction DDL dans sa propre transaction.

    Point critique : PostgreSQL avorte la transaction EN COURS dès qu'une
    instruction échoue (``current transaction is aborted``). Lorsque toutes les
    instructions partageaient une seule transaction, la première erreur — par
    exemple ``CREATE EXTENSION pg_trgm`` non autorisée — faisait échouer
    silencieusement TOUT le reste, dont la création de la table ``users``.
    D'où l'erreur ``relation "users" does not exist`` au démarrage.

    Chaque instruction est donc isolée : une erreur n'affecte plus les autres.

    Retourne ``True`` si l'instruction a été appliquée.
    """
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(sql.strip())
        return True
    except Exception as exc:
        # Volontairement non fatal : une instruction non applicable (déjà
        # existante, privilège manquant, doublon…) ne doit jamais empêcher
        # l'API de démarrer. La vraie panne (base injoignable) est détectée en
        # amont par _wait_for_db(), qui lève l'exception.
        preview = " ".join(sql.strip().split())[:70]
        logger.warning(
            "DDL ignorée%s [%s] : %.70s",
            f" ({label})" if label else "",
            type(exc).__name__,
            preview,
        )
        return False


def _scalar(sql: str, **params):
    """Lecture isolée du catalogue PostgreSQL (sa propre transaction).

    Évite qu'une erreur précédente (« transaction aborted ») fasse échouer la
    requête de contrôle elle-même.
    """
    try:
        with engine.connect() as conn:
            return conn.execute(text(sql), params).scalar()
    except Exception as exc:
        logger.warning("Lecture de schéma ignorée : %s", exc)
        return None


def _check_required_tables() -> list[str]:
    """Vérifie la présence des tables critiques (PostgreSQL uniquement)."""
    if engine.dialect.name != "postgresql":
        return []
    missing = [
        table
        for table in REQUIRED_TABLES
        if not _scalar("SELECT to_regclass(:name)::text", name=f"public.{table}")
    ]
    if missing:
        logger.error(
            "Tables toujours absentes après application du schéma : %s — "
            "l'API démarrera mais ces fonctionnalités seront indisponibles.",
            ", ".join(missing),
        )
    return missing


def ensure_database_schema() -> None:
    """Applique le schéma complet, instruction par instruction.

    Chaque DDL est exécuté dans SA PROPRE transaction : une erreur (objet déjà
    existant, privilège insuffisant…) ne peut plus invalider les instructions
    suivantes. Les erreurs réelles sont loguées en WARNING pour être visibles
    dans les logs Render.
    """
    _wait_for_db()
    logger.info(
        "Application du schéma DDL (%d instructions, une transaction par instruction)…",
        len(BASE_DDL),
    )
    failures: list[int] = []
    for index, ddl in enumerate(BASE_DDL, start=1):
        if not _exec_ddl(ddl, f"DDL #{index}"):
            failures.append(index)

    if failures:
        logger.warning(
            "Schéma appliqué avec %d instruction(s) non appliquée(s) : %s "
            "(souvent « existe déjà » — voir les WARNING ci-dessus).",
            len(failures),
            failures,
        )
    else:
        logger.info("Schéma appliqué avec succès.")

    _check_required_tables()


def migrate_nullable_rehabilitations() -> None:
    """Rend nullable les colonnes historiquement NOT NULL (sans perte de données)."""
    if engine.dialect.name != "postgresql":
        return
    for column in NULLABLE_COLUMNS:
        _exec_ddl(
            f"ALTER TABLE rehabilitations ALTER COLUMN {column} DROP NOT NULL",
            f"nullable {column}",
        )

    # Vérifie si sup_class gère déjà NULL (colonne générée : aucune donnée
    # utilisateur n'est concernée par une recréation).
    expression = _scalar(
        "SELECT generation_expression FROM information_schema.columns "
        "WHERE table_name = 'rehabilitations' AND column_name = 'sup_class'"
    )
    if expression and "is null" in expression.lower():
        return

    # Recrée sup_class pour gérer la superficie absente.
    # Tout est fait dans UNE transaction : si l'ajout échoue, le DROP est
    # annulé (rollback) et la colonne d'origine reste en place.
    try:
        with engine.begin() as conn:
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
        logger.info("Colonne générée sup_class recréée (gestion des superficies NULL).")
    except Exception as exc:
        logger.warning("Migration sup_class ignorée : %s", exc)


def migrate_phase2_columns() -> None:
    """Ajoute author_id et plantation_id sur rehabilitations si absentes.

    Stratégie sûre pour la production :
    - Vérifie l'existence de la colonne avant d'agir (idempotent)
    - Utilise ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+)
    - Ne touche jamais aux données existantes

    Chaque instruction est isolée : si la table ``users`` (ou ``plantations``)
    manquait encore, seule la clé étrangère concernée est ignorée — les colonnes
    et l'API restent fonctionnelles.
    """
    if engine.dialect.name != "postgresql":
        return

    # --- author_id : FK vers users (nullable) --------------------------------
    _exec_ddl(
        "ALTER TABLE rehabilitations ADD COLUMN IF NOT EXISTS author_id INTEGER",
        "author_id",
    )
    fk_exists = _scalar(
        "SELECT 1 FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name "
        "WHERE tc.table_name = 'rehabilitations' "
        "  AND tc.constraint_type = 'FOREIGN KEY' "
        "  AND kcu.column_name = 'author_id'"
    )
    if not fk_exists:
        _exec_ddl(
            "ALTER TABLE rehabilitations "
            "ADD CONSTRAINT fk_rehab_author "
            "FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL",
            "fk_rehab_author",
        )
    _exec_ddl(
        "CREATE INDEX IF NOT EXISTS ix_rehab_author ON rehabilitations (author_id)",
        "ix_rehab_author",
    )

    # --- plantation_id : FK vers plantations (nullable) ----------------------
    _exec_ddl(
        "ALTER TABLE rehabilitations ADD COLUMN IF NOT EXISTS plantation_id INTEGER",
        "plantation_id",
    )
    fk_exists2 = _scalar(
        "SELECT 1 FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name "
        "WHERE tc.table_name = 'rehabilitations' "
        "  AND tc.constraint_type = 'FOREIGN KEY' "
        "  AND kcu.column_name = 'plantation_id'"
    )
    if not fk_exists2:
        _exec_ddl(
            "ALTER TABLE rehabilitations "
            "ADD CONSTRAINT fk_rehab_plantation "
            "FOREIGN KEY (plantation_id) REFERENCES plantations(id) ON DELETE SET NULL",
            "fk_rehab_plantation",
        )
    _exec_ddl(
        "CREATE INDEX IF NOT EXISTS ix_rehab_plantation ON rehabilitations (plantation_id)",
        "ix_rehab_plantation",
    )


def migrate_plantations_audit_source() -> None:
    """Colonne source_rehabilitation_id sur plantations (distribution d'audit)."""
    if engine.dialect.name != "postgresql":
        return
    _exec_ddl(
        "ALTER TABLE plantations ADD COLUMN IF NOT EXISTS source_rehabilitation_id INTEGER",
        "plantations.source_rehabilitation_id",
    )
    fk_exists = _scalar(
        "SELECT 1 FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name "
        "WHERE tc.table_name = 'plantations' "
        "  AND tc.constraint_type = 'FOREIGN KEY' "
        "  AND kcu.column_name = 'source_rehabilitation_id'"
    )
    if not fk_exists:
        _exec_ddl(
            "ALTER TABLE plantations "
            "ADD CONSTRAINT fk_plantation_source_rehab "
            "FOREIGN KEY (source_rehabilitation_id) REFERENCES rehabilitations(id) ON DELETE SET NULL",
            "fk_plantation_source_rehab",
        )
    _exec_ddl(
        "CREATE INDEX IF NOT EXISTS ix_plantation_source_rehab ON plantations (source_rehabilitation_id)",
        "ix_plantation_source_rehab",
    )


def migrate_plantation_inspection_status() -> None:
    """Statut d'inspection, ajouté sans toucher aux plantations existantes."""
    if engine.dialect.name != "postgresql":
        return
    _exec_ddl(
        "ALTER TABLE plantations ADD COLUMN IF NOT EXISTS inspection_completed BOOLEAN NOT NULL DEFAULT FALSE",
        "plantations.inspection_completed",
    )


def migrate_teams_schema() -> None:
    """Adapte la table ``teams`` au modèle « équipe permanente » (sans campagne).

    IMPORTANT — aucune donnée n'est supprimée ici :
    - la colonne ``campaign`` est CONSERVÉE (ses valeurs historiques restent en
      base) et simplement rendue nullable, ce qui permet de créer des équipes
      sans renseigner de campagne ;
    - la contrainte d'unicité du nom n'est ajoutée que si aucun doublon
      n'existe déjà, afin de ne jamais invalider de lignes existantes.
    """
    if engine.dialect.name != "postgresql":
        return

    has_campaign = _scalar(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'teams' AND column_name = 'campaign'"
    )
    if has_campaign:
        # campaign reste en base (historique conservé) mais n'est plus obligatoire
        _exec_ddl(
            "ALTER TABLE teams ALTER COLUMN campaign DROP NOT NULL",
            "teams.campaign nullable",
        )

    # Unicité du nom d'équipe : uniquement si la table est déjà propre.
    duplicates = _scalar(
        "SELECT count(*) FROM ("
        "  SELECT name FROM teams GROUP BY name HAVING count(*) > 1"
        ") AS d"
    )
    if duplicates:
        logger.warning(
            "Migration teams : %s nom(s) d'équipe en doublon — contrainte "
            "UNIQUE(name) non ajoutée (aucune donnée supprimée). Renommez les "
            "doublons dans Administration → Équipes.",
            duplicates,
        )
    else:
        _exec_ddl(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_team_name ON teams (name)",
            "uq_team_name",
        )

    _exec_ddl("CREATE INDEX IF NOT EXISTS ix_team_name ON teams (name)", "ix_team_name")


def migrate_assignments_schema() -> None:
    """Adapte ``team_brigade_assignments`` : une brigade → une seule équipe.

    IMPORTANT — aucune donnée n'est supprimée ici :
    - la colonne ``campaign`` est CONSERVÉE (valeurs historiques préservées) et
      rendue nullable : une affectation ne dépend plus d'une campagne ;
    - le dédoublonnage destructeur (``DELETE``) de l'ancienne version est
      volontairement abandonné. En présence de doublons, la contrainte n'est
      pas créée et un WARNING explicite invite l'administrateur à corriger la
      situation depuis l'interface.
    """
    if engine.dialect.name != "postgresql":
        return

    has_campaign = _scalar(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'team_brigade_assignments' AND column_name = 'campaign'"
    )
    if has_campaign:
        # campaign reste en base (historique conservé) mais n'est plus obligatoire
        _exec_ddl(
            "ALTER TABLE team_brigade_assignments ALTER COLUMN campaign DROP NOT NULL",
            "tba.campaign nullable",
        )

    has_uniq = _scalar(
        "SELECT 1 FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name "
        "WHERE tc.table_name = 'team_brigade_assignments' "
        "  AND tc.constraint_type = 'UNIQUE' "
        "  AND kcu.column_name = 'brigade_id'"
    )
    if has_uniq:
        return

    duplicates = _scalar(
        "SELECT count(*) FROM ("
        "  SELECT brigade_id FROM team_brigade_assignments "
        "  GROUP BY brigade_id HAVING count(*) > 1"
        ") AS d"
    )
    if duplicates:
        logger.warning(
            "Migration affectations : %s brigade(s) affectée(s) à plusieurs "
            "équipes — contrainte UNIQUE(brigade_id) non ajoutée (aucune donnée "
            "supprimée). Retirez les affectations en trop dans "
            "Administration → Affectations.",
            duplicates,
        )
        return

    _exec_ddl(
        "ALTER TABLE team_brigade_assignments "
        "ADD CONSTRAINT uq_tba_brigade_unique UNIQUE (brigade_id)",
        "uq_tba_brigade_unique",
    )


def sync_brigades_from_fiches() -> None:
    """Crée les brigades (entités) manquantes à partir des fiches existantes.

    Les fiches historiques stockent le nom de la brigade en texte libre
    (``rehabilitations.brigade_name``). Pour que Administration → Affectations
    propose immédiatement les brigades réellement présentes en base (et non une
    liste vide), chaque nom inconnu est inséré dans ``brigade_entities``.

    Opération STRICTEMENT additive : aucune ligne existante n'est modifiée ni
    supprimée. Le résultat sert ensuite au filtrage des fiches/plantations par
    équipe.
    """
    if not hasattr(engine, "dialect"):  # pragma: no cover - garde de sécurité
        return

    # NOTE : écriture dans une transaction explicite (engine.begin()) pour que
    # les INSERT soient bien commités — un SELECT isolé serait annulé à la
    # fermeture de la connexion et les brigades disparaîtraient.
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO brigade_entities (name) "
                "SELECT DISTINCT TRIM(brigade_name) FROM rehabilitations "
                "WHERE brigade_name IS NOT NULL AND TRIM(brigade_name) <> '' "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM brigade_entities b "
                "  WHERE b.name = TRIM(brigade_name)"
                ")"
            )
        )
        inserted = result.rowcount or 0
    if inserted:
        logger.info("Brigades créées depuis les fiches existantes : %s.", inserted)

    # Complète (sans jamais écraser) le responsable/ téléphone depuis les fiches
    _exec_ddl(
        "UPDATE brigade_entities b "
        "SET manager_name  = COALESCE(b.manager_name,  src.mgr), "
        "    manager_phone = COALESCE(b.manager_phone, src.tel) "
        "FROM ("
        "  SELECT TRIM(brigade_name) AS name, "
        "         max(brigade_manager_name)  AS mgr, "
        "         max(brigade_manager_phone) AS tel "
        "  FROM rehabilitations "
        "  WHERE brigade_name IS NOT NULL AND TRIM(brigade_name) <> '' "
        "  GROUP BY TRIM(brigade_name)"
        ") AS src "
        "WHERE b.name = src.name AND (b.manager_name IS NULL OR b.manager_phone IS NULL)",
        "brigades → responsables",
    )


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


def _sync_saved_hors_echantillon_plantations() -> None:
    from app.crud import sync_saved_hors_echantillon_plantations

    count = sync_saved_hors_echantillon_plantations()
    if count:
        logger.info("Plantations hors-échantillon créées depuis les suggestions : %s.", count)


# Étapes de démarrage : chaque étape est isolée. Un problème de schéma
# (table déjà existante, doublon, privilège manquant…) est logué mais ne doit
# JAMAIS empêcher l'API de démarrer — c'est ce qui provoquait l'échec de
# déploiement « Application startup failed. Exiting. / Exited with status 3 ».
STARTUP_STEPS = (
    ("schéma de base (tables, index, vue)", ensure_database_schema),
    ("colonnes Phase 2 (author_id, plantation_id)", migrate_phase2_columns),
    ("plantations — source fiche audit", migrate_plantations_audit_source),
    ("statut d'inspection des plantations", migrate_plantation_inspection_status),
    ("colonnes nullables", migrate_nullable_rehabilitations),
    ("équipes sans campagne", migrate_teams_schema),
    ("affectations brigade → équipe", migrate_assignments_schema),
    ("brigades issues des fiches existantes", sync_brigades_from_fiches),
    ("plantations hors-échantillon des suggestions", _sync_saved_hors_echantillon_plantations),
    ("vue de synthèse", _rebuild_view),
    ("compte administrateur par défaut", _seed_default_admin),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    for label, step in STARTUP_STEPS:
        try:
            step()
        except Exception as exc:
            # La base injoignable reste fatale (_wait_for_db lève une
            # OperationalError) : Render conserve alors le déploiement
            # précédent. Toute autre erreur de schéma est journalisée et le
            # démarrage continue.
            logger.error("Étape de démarrage « %s » ignorée : %s", label, exc)
            if isinstance(exc, OperationalError):
                raise
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

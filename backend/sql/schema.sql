-- =========================================================================
-- Schéma PostgreSQL : Gestion des réhabilitations forestières
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS rehabilitations (
    id                          SERIAL PRIMARY KEY,
    pda_number                  VARCHAR(50),
    departement                 VARCHAR(120),
    commune                     VARCHAR(120),
    arrondissement               VARCHAR(120),
    village                     VARCHAR(120),
    annee_rehabilitation        SMALLINT     CHECK (annee_rehabilitation BETWEEN 1990 AND 2100),

    brigade_name                VARCHAR(180),
    brigade_manager_name        VARCHAR(180),
    brigade_manager_phone       VARCHAR(30),

    producer_name                VARCHAR(180),
    producer_phone               VARCHAR(30),

    superficie_rehabilitee      NUMERIC(10,2) CHECK (superficie_rehabilitee >= 0),

    sup_class VARCHAR(30) GENERATED ALWAYS AS (
        CASE
            WHEN superficie_rehabilitee IS NULL THEN NULL
            WHEN superficie_rehabilitee < 1 THEN 'S < 1 ha'
            WHEN superficie_rehabilitee < 2 THEN '1 ≤ S < 2 ha'
            WHEN superficie_rehabilitee < 3 THEN '2 ≤ S < 3 ha'
            WHEN superficie_rehabilitee < 5 THEN '3 ≤ S < 5 ha'
            WHEN superficie_rehabilitee < 10 THEN '5 ≤ S < 10 ha'
            WHEN superficie_rehabilitee < 20 THEN '10 ≤ S < 20 ha'
            WHEN superficie_rehabilitee <= 30 THEN '20 ≤ S ≤ 30 ha'
            ELSE 'S > 30 ha'
        END
    ) STORED,

    desherbage_superficie       NUMERIC(10,2) CHECK (desherbage_superficie >= 0),
    desherbage_operateur_nom    VARCHAR(180),
    desherbage_operateur_phone  VARCHAR(30),

    eclaircie_superficie        NUMERIC(10,2) CHECK (eclaircie_superficie >= 0),
    eclaircie_operateur_nom     VARCHAR(180),
    eclaircie_operateur_phone   VARCHAR(30),

    elagage_superficie          NUMERIC(10,2) CHECK (elagage_superficie >= 0),
    elagage_operateur_nom       VARCHAR(180),
    elagage_operateur_phone     VARCHAR(30),

    debardage_superficie        NUMERIC(10,2) CHECK (debardage_superficie >= 0),
    debardage_operateur_nom     VARCHAR(180),
    debardage_operateur_phone   VARCHAR(30),

    observations                 TEXT,

    created_at                   TIMESTAMPTZ DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Trigger : mise à jour automatique de updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON rehabilitations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON rehabilitations
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------
-- Index simples
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_rehab_departement ON rehabilitations (departement);
CREATE INDEX IF NOT EXISTS ix_rehab_commune     ON rehabilitations (commune);
CREATE INDEX IF NOT EXISTS ix_rehab_village     ON rehabilitations (village);
CREATE INDEX IF NOT EXISTS ix_rehab_annee       ON rehabilitations (annee_rehabilitation);
CREATE INDEX IF NOT EXISTS ix_rehab_sup_class   ON rehabilitations (sup_class);
CREATE INDEX IF NOT EXISTS ix_rehab_brigade     ON rehabilitations (brigade_name);

-- ---------------------------------------------------------------------
-- Index GIN trigramme pour la recherche plein texte rapide
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_rehab_search_trgm ON rehabilitations
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
);

-- ---------------------------------------------------------------------
-- Vue de synthèse
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rehabilitations_synthese AS
SELECT
    id,
    pda_number,
    departement,
    commune,
    arrondissement,
    village,
    annee_rehabilitation,
    brigade_name,
    producer_name,
    superficie_rehabilitee,
    sup_class,
    (
        coalesce(desherbage_superficie, 0) +
        coalesce(eclaircie_superficie, 0) +
        coalesce(elagage_superficie, 0) +
        coalesce(debardage_superficie, 0)
    ) AS superficie_totale_operations,
    created_at,
    updated_at
FROM rehabilitations;

-- =========================================================================
-- Tables d'authentification et de gestion des équipes (Phase 1)
-- =========================================================================

-- ---------------------------------------------------------------------
-- Équipes de terrain
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(180) NOT NULL,
    campaign    VARCHAR(50)  NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT uq_team_name_campaign UNIQUE (name, campaign)
);

CREATE INDEX IF NOT EXISTS ix_team_campaign ON teams (campaign);

-- ---------------------------------------------------------------------
-- Binômes (sous-groupes d'une équipe)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS binomes (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(180) NOT NULL,
    team_id     INTEGER      NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT uq_binome_name_team UNIQUE (name, team_id)
);

CREATE INDEX IF NOT EXISTS ix_binome_team ON binomes (team_id);

-- ---------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id               SERIAL PRIMARY KEY,
    username         VARCHAR(100) NOT NULL UNIQUE,
    full_name        VARCHAR(180),
    hashed_password  VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL DEFAULT 'binome'
                         CHECK (role IN ('admin', 'chef_equipe', 'binome')),
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    team_id          INTEGER      REFERENCES teams  (id) ON DELETE SET NULL,
    binome_id        INTEGER      REFERENCES binomes(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_username ON users (username);
CREATE INDEX IF NOT EXISTS ix_user_team     ON users (team_id);
CREATE INDEX IF NOT EXISTS ix_user_binome   ON users (binome_id);

-- Trigger updated_at sur users
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- =========================================================================
-- Tables Phase 2 — Brigades entités, Plantations, Échantillons, Remplacements
-- =========================================================================

-- ---------------------------------------------------------------------
-- Brigades (entités propres)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brigade_entities (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(180) NOT NULL UNIQUE,
    manager_name  VARCHAR(180),
    manager_phone VARCHAR(30),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_brigade_entities_name ON brigade_entities (name);

-- ---------------------------------------------------------------------
-- Affectation brigade → équipe par campagne
-- Une brigade ne peut être affectée qu'à une seule équipe par campagne
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_brigade_assignments (
    id          SERIAL PRIMARY KEY,
    brigade_id  INTEGER     NOT NULL REFERENCES brigade_entities(id) ON DELETE CASCADE,
    team_id     INTEGER     NOT NULL REFERENCES teams(id)            ON DELETE CASCADE,
    campaign    VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_brigade_campaign UNIQUE (brigade_id, campaign)
);

CREATE INDEX IF NOT EXISTS ix_tba_team     ON team_brigade_assignments (team_id);
CREATE INDEX IF NOT EXISTS ix_tba_campaign ON team_brigade_assignments (campaign);

-- ---------------------------------------------------------------------
-- Plantations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantations (
    id             SERIAL PRIMARY KEY,
    pda_number     VARCHAR(50),
    producer_name  VARCHAR(180),
    producer_phone VARCHAR(30),
    departement    VARCHAR(120),
    commune        VARCHAR(120),
    arrondissement VARCHAR(120),
    village        VARCHAR(120),
    superficie     NUMERIC(10,2),
    brigade_id     INTEGER REFERENCES brigade_entities(id) ON DELETE SET NULL,
    is_sample      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plantation_brigade   ON plantations (brigade_id);
CREATE INDEX IF NOT EXISTS ix_plantation_is_sample ON plantations (is_sample);
CREATE INDEX IF NOT EXISTS ix_plantation_pda       ON plantations (pda_number);

-- ---------------------------------------------------------------------
-- Attributions plantation → binôme (échantillon)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sample_assignments (
    id            SERIAL PRIMARY KEY,
    plantation_id INTEGER NOT NULL REFERENCES plantations(id) ON DELETE CASCADE,
    binome_id     INTEGER NOT NULL REFERENCES binomes(id)     ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_assignment_plantation_binome UNIQUE (plantation_id, binome_id)
);

CREATE INDEX IF NOT EXISTS ix_sa_binome    ON sample_assignments (binome_id);
CREATE INDEX IF NOT EXISTS ix_sa_plantation ON sample_assignments (plantation_id);

-- ---------------------------------------------------------------------
-- Sélections de remplacement (avec verrouillage)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS replacement_selections (
    id                        SERIAL PRIMARY KEY,
    original_plantation_id    INTEGER NOT NULL REFERENCES plantations(id) ON DELETE CASCADE,
    replacement_plantation_id INTEGER NOT NULL REFERENCES plantations(id) ON DELETE CASCADE,
    binome_id                 INTEGER NOT NULL REFERENCES binomes(id)     ON DELETE CASCADE,
    locked_at                 TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_replacement_plantation_unique UNIQUE (replacement_plantation_id)
);

CREATE INDEX IF NOT EXISTS ix_rs_binome   ON replacement_selections (binome_id);
CREATE INDEX IF NOT EXISTS ix_rs_original ON replacement_selections (original_plantation_id);

-- ---------------------------------------------------------------------
-- Colonnes Phase 2 sur rehabilitations (nullable, migration douce)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rehabilitations' AND column_name = 'author_id'
    ) THEN
        ALTER TABLE rehabilitations
            ADD COLUMN author_id    INTEGER REFERENCES users(id)        ON DELETE SET NULL,
            ADD COLUMN plantation_id INTEGER REFERENCES plantations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS ix_rehab_author     ON rehabilitations (author_id);
        CREATE INDEX IF NOT EXISTS ix_rehab_plantation ON rehabilitations (plantation_id);
    END IF;
END
$$;

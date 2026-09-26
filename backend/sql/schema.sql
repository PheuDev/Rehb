-- =========================================================================
-- Schéma PostgreSQL : Gestion des réhabilitations forestières
-- Version complète Phase 1 + Phase 2
-- IDEMPOTENT — peut être rejoué sans risque sur une base existante
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================================================
-- Fonction trigger partagée
-- =========================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Fiches de réhabilitation (table originale — conservée intacte)
-- =========================================================================
CREATE TABLE IF NOT EXISTS rehabilitations (
    id                          SERIAL PRIMARY KEY,
    pda_number                  VARCHAR(50),
    departement                 VARCHAR(120),
    commune                     VARCHAR(120),
    arrondissement              VARCHAR(120),
    village                     VARCHAR(120),
    annee_rehabilitation        SMALLINT CHECK (annee_rehabilitation BETWEEN 1990 AND 2100),
    brigade_name                VARCHAR(180),
    brigade_manager_name        VARCHAR(180),
    brigade_manager_phone       VARCHAR(30),
    producer_name               VARCHAR(180),
    producer_phone              VARCHAR(30),
    superficie_rehabilitee      NUMERIC(10,2) CHECK (superficie_rehabilitee >= 0),
    sup_class VARCHAR(30) GENERATED ALWAYS AS (
        CASE
            WHEN superficie_rehabilitee IS NULL THEN NULL
            WHEN superficie_rehabilitee < 1     THEN 'S < 1 ha'
            WHEN superficie_rehabilitee < 2     THEN '1 ≤ S < 2 ha'
            WHEN superficie_rehabilitee < 3     THEN '2 ≤ S < 3 ha'
            WHEN superficie_rehabilitee < 5     THEN '3 ≤ S < 5 ha'
            WHEN superficie_rehabilitee < 10    THEN '5 ≤ S < 10 ha'
            WHEN superficie_rehabilitee < 20    THEN '10 ≤ S < 20 ha'
            WHEN superficie_rehabilitee <= 30   THEN '20 ≤ S ≤ 30 ha'
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
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON rehabilitations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON rehabilitations
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE INDEX IF NOT EXISTS ix_rehab_departement   ON rehabilitations (departement);
CREATE INDEX IF NOT EXISTS ix_rehab_commune       ON rehabilitations (commune);
CREATE INDEX IF NOT EXISTS ix_rehab_village       ON rehabilitations (village);
CREATE INDEX IF NOT EXISTS ix_rehab_annee         ON rehabilitations (annee_rehabilitation);
CREATE INDEX IF NOT EXISTS ix_rehab_sup_class     ON rehabilitations (sup_class);
CREATE INDEX IF NOT EXISTS ix_rehab_brigade       ON rehabilitations (brigade_name);

CREATE INDEX IF NOT EXISTS ix_rehab_search_trgm ON rehabilitations
USING GIN ((
    coalesce(pda_number, '')           || ' ' ||
    coalesce(departement, '')          || ' ' ||
    coalesce(commune, '')              || ' ' ||
    coalesce(arrondissement, '')       || ' ' ||
    coalesce(village, '')              || ' ' ||
    coalesce(brigade_name, '')         || ' ' ||
    coalesce(brigade_manager_name, '') || ' ' ||
    coalesce(producer_name, '')
) gin_trgm_ops);

-- =========================================================================
-- Équipes (sans champ campagne — une équipe est une entité permanente)
-- =========================================================================
CREATE TABLE IF NOT EXISTS teams (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(180) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_team_name ON teams (name);

-- =========================================================================
-- Binômes
-- =========================================================================
CREATE TABLE IF NOT EXISTS binomes (
    id          SERIAL       PRIMARY KEY,
    name        VARCHAR(180) NOT NULL,
    team_id     INTEGER      NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT uq_binome_name_team UNIQUE (name, team_id)
);

CREATE INDEX IF NOT EXISTS ix_binome_team ON binomes (team_id);

-- =========================================================================
-- Utilisateurs
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
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
);

CREATE INDEX IF NOT EXISTS ix_user_username ON users (username);
CREATE INDEX IF NOT EXISTS ix_user_team     ON users (team_id);
CREATE INDEX IF NOT EXISTS ix_user_binome   ON users (binome_id);

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =========================================================================
-- Brigades (entités propres)
-- =========================================================================
CREATE TABLE IF NOT EXISTS brigade_entities (
    id            SERIAL       PRIMARY KEY,
    name          VARCHAR(180) NOT NULL UNIQUE,
    manager_name  VARCHAR(180),
    manager_phone VARCHAR(30),
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_brigade_entities_name ON brigade_entities (name);

-- =========================================================================
-- Affectation brigade → équipe
-- RÈGLE : une brigade ne peut être affectée qu'à UNE SEULE équipe
--         → UNIQUE(brigade_id)
-- =========================================================================
CREATE TABLE IF NOT EXISTS team_brigade_assignments (
    id          SERIAL  PRIMARY KEY,
    brigade_id  INTEGER NOT NULL UNIQUE REFERENCES brigade_entities (id) ON DELETE CASCADE,
    team_id     INTEGER NOT NULL        REFERENCES teams             (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tba_team ON team_brigade_assignments (team_id);

-- =========================================================================
-- Plantations
-- =========================================================================
CREATE TABLE IF NOT EXISTS plantations (
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
);

CREATE INDEX IF NOT EXISTS ix_plantation_brigade   ON plantations (brigade_id);
CREATE INDEX IF NOT EXISTS ix_plantation_is_sample ON plantations (is_sample);
CREATE INDEX IF NOT EXISTS ix_plantation_pda       ON plantations (pda_number);

-- =========================================================================
-- Attributions plantation → binôme (échantillon)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sample_assignments (
    id            SERIAL  PRIMARY KEY,
    plantation_id INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
    binome_id     INTEGER NOT NULL REFERENCES binomes     (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_assignment_plantation_binome UNIQUE (plantation_id, binome_id)
);

CREATE INDEX IF NOT EXISTS ix_sa_plantation ON sample_assignments (plantation_id);
CREATE INDEX IF NOT EXISTS ix_sa_binome     ON sample_assignments (binome_id);

-- =========================================================================
-- Sélections de remplacement (verrouillage concurrentiel)
-- =========================================================================
CREATE TABLE IF NOT EXISTS replacement_selections (
    id                        SERIAL  PRIMARY KEY,
    original_plantation_id    INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
    replacement_plantation_id INTEGER NOT NULL REFERENCES plantations (id) ON DELETE CASCADE,
    binome_id                 INTEGER NOT NULL REFERENCES binomes     (id) ON DELETE CASCADE,
    locked_at                 TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_replacement_plantation_unique UNIQUE (replacement_plantation_id)
);

CREATE INDEX IF NOT EXISTS ix_rs_original ON replacement_selections (original_plantation_id);
CREATE INDEX IF NOT EXISTS ix_rs_binome   ON replacement_selections (binome_id);

-- =========================================================================
-- Migrations douces sur rehabilitations (idempotentes — ne touche pas aux données)
-- =========================================================================

-- Rendre les colonnes historiques nullable
ALTER TABLE rehabilitations ALTER COLUMN pda_number          DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN departement         DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN commune             DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN arrondissement      DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN village             DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN annee_rehabilitation DROP NOT NULL;
ALTER TABLE rehabilitations ALTER COLUMN superficie_rehabilitee DROP NOT NULL;

-- Ajouter author_id si absent
ALTER TABLE rehabilitations ADD COLUMN IF NOT EXISTS author_id    INTEGER;
ALTER TABLE rehabilitations ADD COLUMN IF NOT EXISTS plantation_id INTEGER;

-- Ajouter les FK si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rehab_author' AND table_name = 'rehabilitations'
  ) THEN
    ALTER TABLE rehabilitations
      ADD CONSTRAINT fk_rehab_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rehab_plantation' AND table_name = 'rehabilitations'
  ) THEN
    ALTER TABLE rehabilitations
      ADD CONSTRAINT fk_rehab_plantation FOREIGN KEY (plantation_id) REFERENCES plantations(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_rehab_author     ON rehabilitations (author_id);
CREATE INDEX IF NOT EXISTS ix_rehab_plantation ON rehabilitations (plantation_id);

-- =========================================================================
-- Migration douce teams : supprimer la colonne campaign si elle existe
-- (ancienne version qui avait campaign NOT NULL)
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'campaign'
  ) THEN
    -- Supprimer la contrainte unique si elle existe
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'uq_team_name_campaign' AND table_name = 'teams'
    ) THEN
      ALTER TABLE teams DROP CONSTRAINT uq_team_name_campaign;
    END IF;
    ALTER TABLE teams DROP COLUMN campaign;
    -- Ajouter la contrainte unique sur name seul
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_type = 'UNIQUE' AND table_name = 'teams'
        AND constraint_name IN (
          SELECT constraint_name FROM information_schema.key_column_usage
          WHERE table_name = 'teams' AND column_name = 'name'
        )
    ) THEN
      ALTER TABLE teams ADD CONSTRAINT uq_team_name UNIQUE (name);
    END IF;
  END IF;
END
$$;

-- =========================================================================
-- Migration douce team_brigade_assignments : supprimer campaign, simplifier
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_brigade_assignments' AND column_name = 'campaign'
  ) THEN
    -- Supprimer l'ancienne contrainte UNIQUE(brigade_id, campaign)
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'uq_brigade_campaign' AND table_name = 'team_brigade_assignments'
    ) THEN
      ALTER TABLE team_brigade_assignments DROP CONSTRAINT uq_brigade_campaign;
    END IF;
    ALTER TABLE team_brigade_assignments DROP COLUMN campaign;
  END IF;

  -- Ajouter contrainte UNIQUE(brigade_id) si absente
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'team_brigade_assignments'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'brigade_id'
  ) THEN
    -- Dédoublonner d'abord si besoin (garde la première affectation par brigade)
    DELETE FROM team_brigade_assignments tba1
    USING team_brigade_assignments tba2
    WHERE tba1.brigade_id = tba2.brigade_id AND tba1.id > tba2.id;

    ALTER TABLE team_brigade_assignments ADD CONSTRAINT uq_tba_brigade_unique UNIQUE (brigade_id);
  END IF;
END
$$;

-- =========================================================================
-- Suggestions d'audit superficie sauvegardées
-- =========================================================================
CREATE TABLE IF NOT EXISTS saved_audit_suggestions (
    id                      SERIAL PRIMARY KEY,
    title                   VARCHAR(200) NOT NULL,
    created_by_id           INTEGER REFERENCES users (id) ON DELETE SET NULL,
    brigade_filter          JSONB,
    snapshot                JSONB NOT NULL,
    nb_fiches_echantillon   INTEGER NOT NULL DEFAULT 0,
    superficie_echantillon  NUMERIC(12,2),
    pourcentage_couverture  NUMERIC(6,2),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_saved_audit_created_by ON saved_audit_suggestions (created_by_id);
CREATE INDEX IF NOT EXISTS ix_saved_audit_created_at ON saved_audit_suggestions (created_at);

-- =========================================================================
-- Vue de synthèse (enrichie avec auteur)
-- =========================================================================
DROP VIEW IF EXISTS v_rehabilitations_synthese;
CREATE VIEW v_rehabilitations_synthese AS
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
LEFT JOIN users u ON u.id = r.author_id;

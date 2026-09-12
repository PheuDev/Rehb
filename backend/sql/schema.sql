-- =========================================================================
-- Schéma PostgreSQL : Gestion des réhabilitations forestières
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS rehabilitations (
    id                          SERIAL PRIMARY KEY,
    pda_number                  VARCHAR(50)  NOT NULL,
    departement                 VARCHAR(120) NOT NULL,
    commune                     VARCHAR(120) NOT NULL,
    arrondissement               VARCHAR(120) NOT NULL,
    village                     VARCHAR(120) NOT NULL,
    annee_rehabilitation        SMALLINT     NOT NULL CHECK (annee_rehabilitation BETWEEN 1990 AND 2100),

    brigade_name                VARCHAR(180),
    brigade_manager_name        VARCHAR(180),
    brigade_manager_phone       VARCHAR(30),

    producer_name                VARCHAR(180),
    producer_phone               VARCHAR(30),

    superficie_rehabilitee      NUMERIC(10,2) NOT NULL CHECK (superficie_rehabilitee >= 0),

    sup_class VARCHAR(30) GENERATED ALWAYS AS (
        CASE
            WHEN superficie_rehabilitee <= 5  THEN 'S ≤ 5 ha'
            WHEN superficie_rehabilitee <= 10 THEN '5 < S ≤ 10 ha'
            WHEN superficie_rehabilitee <= 20 THEN '10 < S ≤ 20 ha'
            ELSE 'S > 20 ha'
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

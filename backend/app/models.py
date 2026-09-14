from sqlalchemy import (
    Column,
    Integer,
    SmallInteger,
    String,
    Numeric,
    Text,
    TIMESTAMP,
    CheckConstraint,
    Computed,
    Index,
    func,
)

from app.database import Base

SUP_CLASS_EXPR = (
    "CASE "
    "WHEN superficie_rehabilitee IS NULL THEN NULL "
    "WHEN superficie_rehabilitee <= 5 THEN 'S ≤ 5 ha' "
    "WHEN superficie_rehabilitee <= 10 THEN '5 < S ≤ 10 ha' "
    "WHEN superficie_rehabilitee <= 20 THEN '10 < S ≤ 20 ha' "
    "ELSE 'S > 20 ha' END"
)


class Rehabilitation(Base):
    """Représente une fiche de réhabilitation forestière (table `rehabilitations`).

    NB : la table réelle, ses index, son trigger et sa vue de synthèse sont
    créés via `sql/schema.sql` (généré séparément pour bénéficier de
    fonctionnalités PostgreSQL avancées : colonne générée, index GIN
    trigramme, trigger, vue). Ce modèle sert à la lecture/écriture via l'ORM.
    """

    __tablename__ = "rehabilitations"

    id = Column(Integer, primary_key=True, index=True)
    pda_number = Column(String(50))
    departement = Column(String(120))
    commune = Column(String(120))
    arrondissement = Column(String(120))
    village = Column(String(120))
    annee_rehabilitation = Column(SmallInteger)

    brigade_name = Column(String(180))
    brigade_manager_name = Column(String(180))
    brigade_manager_phone = Column(String(30))

    producer_name = Column(String(180))
    producer_phone = Column(String(30))

    superficie_rehabilitee = Column(Numeric(10, 2))
    sup_class = Column(String(30), Computed(SUP_CLASS_EXPR, persisted=True))

    desherbage_superficie = Column(Numeric(10, 2))
    desherbage_operateur_nom = Column(String(180))
    desherbage_operateur_phone = Column(String(30))

    eclaircie_superficie = Column(Numeric(10, 2))
    eclaircie_operateur_nom = Column(String(180))
    eclaircie_operateur_phone = Column(String(30))

    elagage_superficie = Column(Numeric(10, 2))
    elagage_operateur_nom = Column(String(180))
    elagage_operateur_phone = Column(String(30))

    debardage_superficie = Column(Numeric(10, 2))
    debardage_operateur_nom = Column(String(180))
    debardage_operateur_phone = Column(String(30))

    observations = Column(Text)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("annee_rehabilitation BETWEEN 1990 AND 2100", name="ck_annee_range"),
        CheckConstraint("superficie_rehabilitee >= 0", name="ck_superficie_positive"),
        CheckConstraint("desherbage_superficie >= 0", name="ck_desherbage_positive"),
        CheckConstraint("eclaircie_superficie >= 0", name="ck_eclaircie_positive"),
        CheckConstraint("elagage_superficie >= 0", name="ck_elagage_positive"),
        CheckConstraint("debardage_superficie >= 0", name="ck_debardage_positive"),
        Index("ix_rehab_departement", "departement"),
        Index("ix_rehab_commune", "commune"),
        Index("ix_rehab_village", "village"),
        Index("ix_rehab_annee", "annee_rehabilitation"),
        Index("ix_rehab_sup_class", "sup_class"),
        Index("ix_rehab_brigade", "brigade_name"),
    )

from sqlalchemy import (
    Column,
    Integer,
    SmallInteger,
    String,
    Numeric,
    Text,
    Boolean,
    TIMESTAMP,
    ForeignKey,
    CheckConstraint,
    Computed,
    Index,
    UniqueConstraint,
    JSON,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base

SUP_CLASS_EXPR = (
    "CASE "
    "WHEN superficie_rehabilitee IS NULL THEN NULL "
    "WHEN superficie_rehabilitee < 1 THEN 'S < 1 ha' "
    "WHEN superficie_rehabilitee < 2 THEN '1 ≤ S < 2 ha' "
    "WHEN superficie_rehabilitee < 3 THEN '2 ≤ S < 3 ha' "
    "WHEN superficie_rehabilitee < 5 THEN '3 ≤ S < 5 ha' "
    "WHEN superficie_rehabilitee < 10 THEN '5 ≤ S < 10 ha' "
    "WHEN superficie_rehabilitee < 20 THEN '10 ≤ S < 20 ha' "
    "WHEN superficie_rehabilitee <= 30 THEN '20 ≤ S ≤ 30 ha' "
    "ELSE 'S > 30 ha' END"
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

    # --- Liens vers le nouveau système (Phase 2, colonnes nullable) ---
    author_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Utilisateur (binôme) ayant créé la fiche",
    )
    plantation_id = Column(
        Integer,
        ForeignKey("plantations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Plantation auditée (entité Phase 2)",
    )

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


# =============================================================================
# Modèles d'authentification et de gestion des équipes
# =============================================================================

class Team(Base):
    """Équipe de terrain.

    Une équipe regroupe plusieurs binômes et est responsable d'une ou plusieurs
    brigades.
    """

    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    members = relationship("User", back_populates="team", foreign_keys="User.team_id")
    binomes = relationship("Binome", back_populates="team")

    __table_args__ = (
        Index("ix_team_name", "name"),
    )


class Binome(Base):
    """Binôme de terrain : sous-groupe d'une équipe, composé de 2 agents.

    Un binôme reçoit des plantations de l'échantillon à auditer.
    """

    __tablename__ = "binomes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="binomes")
    members = relationship("User", back_populates="binome", foreign_keys="User.binome_id")

    __table_args__ = (
        UniqueConstraint("name", "team_id", name="uq_binome_name_team"),
        Index("ix_binome_team", "team_id"),
    )


class User(Base):
    """Utilisateur de l'application.

    Rôles :
    - ``admin``       : accès total, gestion des équipes, brigades, utilisateurs.
    - ``chef_equipe`` : accès en lecture à toute son équipe, peut valider les fiches.
    - ``binome``      : accès restreint à ses propres plantations assignées.
    """

    __tablename__ = "users"

    ROLES = ("admin", "chef_equipe", "binome")

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, unique=True, index=True)
    full_name = Column(String(180), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="binome")
    is_active = Column(Boolean, nullable=False, default=True)

    # Un utilisateur appartient à une équipe (sauf admin qui peut être NULL)
    team_id = Column(
        Integer,
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Un utilisateur peut appartenir à un binôme précis au sein de son équipe
    binome_id = Column(
        Integer,
        ForeignKey("binomes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    binome = relationship("Binome", back_populates="members", foreign_keys=[binome_id])

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'chef_equipe', 'binome')", name="ck_user_role"),
        Index("ix_user_team", "team_id"),
        Index("ix_user_binome", "binome_id"),
    )


# =============================================================================
# Modèles Phase 2 — Brigades, Plantations, Échantillons, Remplacements
# =============================================================================

class BrigadeEntity(Base):
    """Brigade en tant qu'entité propre (ex-champ texte dénormalisé dans rehabilitations).

    Une brigade peut être affectée à une équipe pour une campagne donnée.
    Elle possède un ensemble de plantations dans son périmètre.
    """

    __tablename__ = "brigade_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False, unique=True, index=True)
    manager_name = Column(String(180), nullable=True)
    manager_phone = Column(String(30), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    plantations = relationship("Plantation", back_populates="brigade")
    assignments = relationship("TeamBrigadeAssignment", back_populates="brigade")


class TeamBrigadeAssignment(Base):
    """Affectation d'une brigade à une équipe.

    Règle métier : une brigade NE PEUT PAS être affectée à plusieurs équipes.
    Garantie par la contrainte UNIQUE(brigade_id).
    """

    __tablename__ = "team_brigade_assignments"

    id = Column(Integer, primary_key=True, index=True)
    brigade_id = Column(
        Integer,
        ForeignKey("brigade_entities.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # Une brigade → une seule équipe
    )
    team_id = Column(
        Integer,
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    brigade = relationship("BrigadeEntity", back_populates="assignments")
    team = relationship("Team")

    __table_args__ = (
        Index("ix_tba_team", "team_id"),
    )


class Plantation(Base):
    """Plantation identifiée dans le périmètre d'une brigade.

    ``is_sample`` indique si la plantation fait partie de l'échantillon initial.
    Une plantation de l'échantillon initial NE PEUT PAS être utilisée comme
    remplacement (règle vérifiée côté API).
    """

    __tablename__ = "plantations"

    id = Column(Integer, primary_key=True, index=True)
    pda_number = Column(String(50), nullable=True, index=True)
    producer_name = Column(String(180), nullable=True)
    producer_phone = Column(String(30), nullable=True)

    departement = Column(String(120), nullable=True)
    commune = Column(String(120), nullable=True)
    arrondissement = Column(String(120), nullable=True)
    village = Column(String(120), nullable=True)

    superficie = Column(Numeric(10, 2), nullable=True)

    brigade_id = Column(
        Integer,
        ForeignKey("brigade_entities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_sample = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="True = appartient à l'échantillon initial ; ne peut pas être un remplacement",
    )
    source_rehabilitation_id = Column(
        Integer,
        ForeignKey("rehabilitations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Fiche d'origine lors d'une distribution d'audit",
    )

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    brigade = relationship("BrigadeEntity", back_populates="plantations")
    assignments = relationship("SampleAssignment", back_populates="plantation")
    # Relation inverse pour les remplacements (plantation utilisée comme remplacement)
    replacement_use = relationship(
        "ReplacementSelection",
        back_populates="replacement_plantation",
        foreign_keys="ReplacementSelection.replacement_plantation_id",
    )

    __table_args__ = (
        Index("ix_plantation_brigade", "brigade_id"),
        Index("ix_plantation_is_sample", "is_sample"),
    )


class SampleAssignment(Base):
    """Attribution d'une plantation de l'échantillon à un binôme.

    Un binôme reçoit une liste de plantations à auditer.
    """

    __tablename__ = "sample_assignments"

    id = Column(Integer, primary_key=True, index=True)
    plantation_id = Column(
        Integer,
        ForeignKey("plantations.id", ondelete="CASCADE"),
        nullable=False,
    )
    binome_id = Column(
        Integer,
        ForeignKey("binomes.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    plantation = relationship("Plantation", back_populates="assignments")
    binome = relationship("Binome")

    __table_args__ = (
        UniqueConstraint("plantation_id", "binome_id", name="uq_assignment_plantation_binome"),
        Index("ix_sa_binome", "binome_id"),
        Index("ix_sa_plantation", "plantation_id"),
    )


class ReplacementSelection(Base):
    """Sélection d'une plantation hors-échantillon comme remplacement.

    Règles métier garanties par les contraintes DB :
    - Une plantation de remplacement NE PEUT PAS être réutilisée :
      UNIQUE(replacement_plantation_id). Elle est « grisée » — seul le
      binôme qui l'a verrouillée (locked_by_id) peut la dégriser.
    - Deux binômes ne peuvent pas sélectionner la même plantation de remplacement
      simultanément (même contrainte UNIQUE).
    - Une plantation de l'échantillon initial NE PEUT PAS être un remplacement :
      vérifié côté API (is_sample = False).
    """

    __tablename__ = "replacement_selections"

    id = Column(Integer, primary_key=True, index=True)

    # Plantation originale introuvable sur le terrain
    original_plantation_id = Column(
        Integer,
        ForeignKey("plantations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Plantation choisie comme remplacement (verrouillée une fois sélectionnée)
    replacement_plantation_id = Column(
        Integer,
        ForeignKey("plantations.id", ondelete="CASCADE"),
        nullable=False,
    )
    binome_id = Column(
        Integer,
        ForeignKey("binomes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    locked_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        comment="Horodatage du verrouillage — empêche la sélection concurrente",
    )
    # Utilisateur qui a verrouillé ce remplacement : seul lui peut le dégriser
    locked_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Utilisateur (binôme) qui a grisé la plantation de remplacement",
    )

    original_plantation = relationship(
        "Plantation",
        foreign_keys=[original_plantation_id],
    )
    replacement_plantation = relationship(
        "Plantation",
        foreign_keys=[replacement_plantation_id],
        back_populates="replacement_use",
    )
    binome = relationship("Binome")
    locked_by = relationship("User", foreign_keys=[locked_by_id])

    __table_args__ = (
        # Garantit qu'une plantation de remplacement n'est utilisée qu'une seule fois
        UniqueConstraint(
            "replacement_plantation_id",
            name="uq_replacement_plantation_unique",
        ),
        Index("ix_rs_binome", "binome_id"),
        Index("ix_rs_original", "original_plantation_id"),
        Index("ix_rs_locked_by", "locked_by_id"),
    )


class SavedAuditSuggestion(Base):
    """Suggestion d'échantillon d'audit superficie sauvegardée pour consultation ultérieure."""

    __tablename__ = "saved_audit_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    created_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    brigade_filter = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        comment="Filtre brigades actif à la sauvegarde",
    )
    snapshot = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        comment="Résultat complet de l'échantillon d'audit",
    )
    nb_fiches_echantillon = Column(Integer, nullable=False, default=0)
    superficie_echantillon = Column(Numeric(12, 2), nullable=True)
    pourcentage_couverture = Column(Numeric(6, 2), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("ix_saved_audit_created_at", "created_at"),
    )


class TeamAuditAssignment(Base):
    """Plantation d'un échantillon d'audit distribuée à une équipe (via ses brigades)."""

    __tablename__ = "team_audit_assignments"

    id = Column(Integer, primary_key=True, index=True)
    audit_suggestion_id = Column(
        Integer,
        ForeignKey("saved_audit_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id = Column(
        Integer,
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plantation_id = Column(
        Integer,
        ForeignKey("plantations.id", ondelete="CASCADE"),
        nullable=False,
    )
    rehabilitation_id = Column(
        Integer,
        ForeignKey("rehabilitations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    audit_suggestion = relationship("SavedAuditSuggestion")
    team = relationship("Team")
    plantation = relationship("Plantation")

    __table_args__ = (
        UniqueConstraint("team_id", "plantation_id", name="uq_team_audit_plantation"),
        Index("ix_team_audit_team", "team_id"),
        Index("ix_team_audit_suggestion", "audit_suggestion_id"),
    )

"""Routes des plantations d'équipe — « Mes plantations » du chef d'équipe.

Vérifie qu'après une sauvegarde d'audit, le chef d'équipe voit les plantations
reçues par son équipe (via les brigades qui lui sont confiées) et peut les
télécharger en Excel, sans accéder aux équipes des autres.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db, require_active, require_admin
from app.models import (
    Binome,
    BrigadeEntity,
    Plantation,
    Rehabilitation,
    SampleAssignment,
    SavedAuditSuggestion,
    Team,
    TeamAuditAssignment,
    TeamBrigadeAssignment,
    User,
)
from app.routers import rehabilitations, terrain

CHEF_A = User(
    id=2, username="chefa", full_name="Chef A", role="chef_equipe",
    team_id=1, is_active=True, hashed_password="x",
)
CHEF_B = User(
    id=3, username="chefb", full_name="Chef B", role="chef_equipe",
    team_id=2, is_active=True, hashed_password="x",
)
BINOME = User(
    id=4, username="bio", full_name="Binôme A1", role="binome",
    team_id=1, binome_id=1, is_active=True, hashed_password="x",
)


def make_client_builder():
    """Crée l'app de test ; renvoie (build_user->client, session_factory)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with TestingSession() as db:
        db.add(Team(id=1, name="Équipe A"))
        db.add(Team(id=2, name="Équipe B"))
        db.add(Binome(id=1, name="Binôme A1", team_id=1))
        db.add(Binome(id=2, name="Binôme B1", team_id=2))
        db.add(BrigadeEntity(id=1, name="Brigade Alpha"))
        # La brigade Alpha est confiée à l'équipe A.
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(
            Rehabilitation(
                id=1, pda_number="PDA-1", brigade_name="Brigade Alpha",
                superficie_rehabilitee=5, annee_rehabilitation=2024,
            )
        )
        db.add(SavedAuditSuggestion(
            id=1, title="Campagne", snapshot={"fiches": []}, nb_fiches_echantillon=0,
        ))
        db.commit()
        # Distribution d'audit : la fiche de la brigade Alpha part à l'équipe A.
        p = Plantation(
            id=1, pda_number="PDA-1", producer_name="Prod A",
            brigade_id=1, is_sample=True, source_rehabilitation_id=1,
        )
        db.add(p)
        db.add(TeamAuditAssignment(
            audit_suggestion_id=1, team_id=1, plantation_id=1, rehabilitation_id=1,
        ))
        # Le binôme A1 reçoit aussi cette plantation.
        db.add(SampleAssignment(plantation_id=1, binome_id=1))
        db.commit()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    def build(user: User) -> TestClient:
        app = FastAPI()
        app.include_router(terrain.router)
        app.include_router(rehabilitations.router)
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_active] = lambda: user
        app.dependency_overrides[require_admin] = lambda: user
        return TestClient(app)

    return build, TestingSession


def test_chef_lists_his_team_plantations():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    response = client.get("/api/teams/1/plantations")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["pda_number"] == "PDA-1"
    assert items[0]["brigade_name"] == "Brigade Alpha"
    assert items[0]["is_sample"] is True


def test_chef_cannot_see_another_team_plantations():
    build, _ = make_client_builder()
    client = build(CHEF_B)
    assert client.get("/api/teams/1/plantations").status_code == 403


def test_binome_cannot_list_team_plantations():
    build, _ = make_client_builder()
    client = build(BINOME)
    assert client.get("/api/teams/1/plantations").status_code == 403


def test_team_plantations_unknown_team_returns_404():
    build, _ = make_client_builder()
    client = build(CHEF_A)
    assert client.get("/api/teams/999/plantations").status_code == 404


def test_chef_exports_team_plantations_excel():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    response = client.get("/api/teams/1/plantations/export-excel")
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]


def test_binome_cannot_export_team_plantations():
    build, _ = make_client_builder()
    client = build(BINOME)
    assert client.get("/api/teams/1/plantations/export-excel").status_code == 403
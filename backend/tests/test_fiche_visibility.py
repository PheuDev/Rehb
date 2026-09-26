"""Tests de visibilité des fiches selon le rôle et l'équipe.

Règles métier vérifiées :
- un administrateur voit TOUTES les fiches ;
- un chef d'équipe / binôme ne voit que les fiches des brigades affectées à
  son équipe (table team_brigade_assignments) ;
- un membre sans équipe (ou dont l'équipe n'a aucune brigade) ne voit rien ;
- une fiche hors périmètre reste inaccessible en lecture directe.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db, require_active
from app.models import (
    BrigadeEntity,
    Rehabilitation,
    Team,
    TeamBrigadeAssignment,
    User,
)
from app.routers import rehabilitations

ADMIN = User(id=1, username="admin", role="admin", is_active=True)
CHEF_ALPHA = User(id=2, username="chef-alpha", role="chef_equipe", is_active=True, team_id=1)
CHEF_SANS_EQUIPE = User(id=3, username="chef-vide", role="chef_equipe", is_active=True, team_id=None)


def make_client(user):
    """App FastAPI branchée sur une SQLite partagée, avec un utilisateur imposé."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(rehabilitations.router)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_active] = lambda: user
    return TestClient(app), TestingSession


def _seed(session_factory):
    """Deux équipes, trois brigades : Alpha → équipe 1, Beta → équipe 2, Gamma libre."""
    with session_factory() as db:
        db.add_all([
            Team(id=1, name="Équipe Alpha"),
            Team(id=2, name="Équipe Beta"),
            BrigadeEntity(id=1, name="Brigade Alpha"),
            BrigadeEntity(id=2, name="Brigade Beta"),
            BrigadeEntity(id=3, name="Brigade Gamma"),
        ])
        db.add_all([
            TeamBrigadeAssignment(id=1, brigade_id=1, team_id=1),
            TeamBrigadeAssignment(id=2, brigade_id=2, team_id=2),
        ])
        db.add_all([
            Rehabilitation(
                pda_number="PDA-ALPHA", brigade_name="Brigade Alpha",
                departement="Atlantique", commune="Abomey-Calavi",
                superficie_rehabilitee=5, annee_rehabilitation=2024,
            ),
            Rehabilitation(
                pda_number="PDA-BETA", brigade_name="Brigade Beta",
                departement="Atlantique", commune="Ouidah",
                superficie_rehabilitee=3, annee_rehabilitation=2024,
            ),
            Rehabilitation(
                pda_number="PDA-GAMMA", brigade_name="Brigade Gamma",
                departement="Zou", commune="Abomey",
                superficie_rehabilitee=7, annee_rehabilitation=2025,
            ),
        ])
        db.commit()


def _pda(client):
    resp = client.get("/api/rehabilitations?limit=50")
    assert resp.status_code == 200, resp.text
    return {item["pda_number"] for item in resp.json()["items"]}


def test_admin_sees_every_fiche():
    client, session_factory = make_client(ADMIN)
    _seed(session_factory)

    assert _pda(client) == {"PDA-ALPHA", "PDA-BETA", "PDA-GAMMA"}


def test_chef_only_sees_fiches_of_his_assigned_brigades():
    client, session_factory = make_client(CHEF_ALPHA)
    _seed(session_factory)

    # Seules les fiches de la brigade affectée à l'équipe 1 (Brigade Alpha)
    assert _pda(client) == {"PDA-ALPHA"}


def test_chef_without_team_sees_nothing():
    client, session_factory = make_client(CHEF_SANS_EQUIPE)
    _seed(session_factory)

    assert _pda(client) == set()


def test_stats_are_restricted_to_the_team_scope():
    client, session_factory = make_client(CHEF_ALPHA)
    _seed(session_factory)

    stats = client.get("/api/rehabilitations/stats").json()

    assert stats["totalFiches"] == 1
    assert stats["totalBrigades"] == 1
    assert [b["brigade"] for b in stats["parBrigade"]] == ["Brigade Alpha"]


def test_admin_stats_cover_all_fiches():
    client, session_factory = make_client(ADMIN)
    _seed(session_factory)

    stats = client.get("/api/rehabilitations/stats").json()

    assert stats["totalFiches"] == 3
    assert stats["totalBrigades"] == 3


def test_brigade_matching_ignores_case_and_trailing_spaces():
    """Les noms issus d'imports Excel peuvent contenir espaces/casse variables."""
    client, session_factory = make_client(CHEF_ALPHA)
    _seed(session_factory)

    with session_factory() as db:
        db.add(Rehabilitation(
            pda_number="PDA-VARIANTE", brigade_name="  brigade alpha  ",
            departement="Atlantique", superficie_rehabilitee=2,
        ))
        db.commit()

    assert _pda(client) == {"PDA-ALPHA", "PDA-VARIANTE"}


def test_direct_read_of_fiche_outside_scope_is_forbidden():
    client, session_factory = make_client(CHEF_ALPHA)
    _seed(session_factory)

    with session_factory() as db:
        other_id = (
            db.query(Rehabilitation.id)
            .filter(Rehabilitation.pda_number == "PDA-BETA")
            .scalar()
        )
        own_id = (
            db.query(Rehabilitation.id)
            .filter(Rehabilitation.pda_number == "PDA-ALPHA")
            .scalar()
        )

    assert client.get(f"/api/rehabilitations/{own_id}").status_code == 200
    assert client.get(f"/api/rehabilitations/{other_id}").status_code == 403


def test_export_respects_the_team_scope():
    client, session_factory = make_client(CHEF_ALPHA)
    _seed(session_factory)

    resp = client.get("/api/rehabilitations/export")

    assert resp.status_code == 200
    assert "PDA-ALPHA" in resp.text
    assert "PDA-BETA" not in resp.text

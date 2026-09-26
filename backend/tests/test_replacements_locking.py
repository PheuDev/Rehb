"""Remplacements — filtre par brigade, grisage et dégrisage réservé au verrouilleur.

Scénario utilisateur :
- « Introuvable » affiche les autres plantations de la MÊME brigade hors
  échantillon (hors suggestion).
- Une fois choisie, la plantation de remplacement est grisée : un autre binôme
  de l'équipe ne peut plus l'utiliser.
- Seul le binôme qui a grisé la plantation peut la dégriser (l'admin aussi).
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
    SampleAssignment,
    Team,
    TeamBrigadeAssignment,
    User,
)
from app.routers import terrain

ADMIN = User(
    id=1, username="admin", full_name="Admin", role="admin",
    is_active=True, hashed_password="x",
)
UA = User(
    id=11, username="binome_a", full_name="Binôme Alpha", role="binome",
    team_id=1, binome_id=1, is_active=True, hashed_password="x",
)
UB = User(
    id=12, username="binome_b", full_name="Binôme Bravo", role="binome",
    team_id=1, binome_id=2, is_active=True, hashed_password="x",
)


def make_client_builder():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with TestingSession() as db:
        db.add(User(id=1, username="admin", full_name="Admin", role="admin", is_active=True, hashed_password="x"))
        db.add(User(id=11, username="binome_a", full_name="Binôme Alpha", role="binome", team_id=1, binome_id=1, is_active=True, hashed_password="x"))
        db.add(User(id=12, username="binome_b", full_name="Binôme Bravo", role="binome", team_id=1, binome_id=2, is_active=True, hashed_password="x"))

        db.add(Team(id=1, name="Équipe A"))
        db.add(Binome(id=1, name="Binôme 1", team_id=1))
        db.add(Binome(id=2, name="Binôme 2", team_id=1))

        db.add(BrigadeEntity(id=1, name="Brigade A"))
        db.add(BrigadeEntity(id=2, name="Brigade B"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))

        # Échantillon (suggestion) — brigade A
        db.add(Plantation(id=1, pda_number="PDA-1", brigade_id=1, is_sample=True))
        db.add(Plantation(id=5, pda_number="PDA-5", brigade_id=1, is_sample=True))
        # Hors échantillon — brigade A (remplacements possibles)
        db.add(Plantation(id=2, pda_number="PDA-2", brigade_id=1, is_sample=False))
        db.add(Plantation(id=3, pda_number="PDA-3", brigade_id=1, is_sample=False))
        # Hors échantillon — brigade B (pas un remplacement valide pour la A)
        db.add(Plantation(id=4, pda_number="PDA-4", brigade_id=2, is_sample=False))

        db.add(SampleAssignment(plantation_id=1, binome_id=1))
        db.add(SampleAssignment(plantation_id=5, binome_id=2))
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
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_active] = lambda: user
        app.dependency_overrides[require_admin] = lambda: user
        return TestClient(app)

    return build, TestingSession


def test_available_replacements_limited_to_original_brigade():
    build, _ = make_client_builder()
    client = build(UA)

    response = client.get("/api/binomes/1/available-replacements?brigade_id=1")
    assert response.status_code == 200
    items = response.json()
    ids = {p["id"] for p in items}
    # Uniquement les autres plantations hors échantillon de la brigade A.
    assert ids == {2, 3}
    assert all(p["is_locked"] is False for p in items)


def test_replacement_other_brigade_rejected():
    build, _ = make_client_builder()
    client = build(UA)

    response = client.post(
        "/api/replacements",
        json={"original_plantation_id": 1, "replacement_plantation_id": 4},
    )
    assert response.status_code == 400
    assert "même brigade" in response.json()["detail"]
def test_replacement_locks_and_appears_grayed_for_team_mate():
    build, _ = make_client_builder()

    # Binôme A grise la plantation 2 pour remplacer sa plantation 1 (introuvable).
    client_a = build(UA)
    created = client_a.post(
        "/api/replacements",
        json={"original_plantation_id": 1, "replacement_plantation_id": 2},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["locked_by_me"] is True
    assert body["locked_by_id"] == 11
    replacement_id = body["id"]

    # Un autre binôme de l'équipe la voit grisée et ne peut pas l'utiliser.
    client_b = build(UB)
    available = client_b.get("/api/binomes/2/available-replacements?brigade_id=1").json()
    by_id = {p["id"]: p for p in available}
    assert by_id[2]["is_locked"] is True
    assert by_id[2]["locked_by_me"] is False
    assert by_id[2]["locked_by_name"] == "Binôme Alpha"
    assert by_id[2]["replacement_id"] == replacement_id
    # La 3 reste disponible.
    assert by_id[3]["is_locked"] is False

    # La plantation introuvable d'origine est bien marquée « remplacée ».
    mine = client_a.get("/api/binomes/1/plantations").json()
    orig = next(p for p in mine if p["id"] == 1)
    assert orig["is_replaced"] is True
    assert orig["is_locked"] is False


def test_only_locker_can_unlock():
    build, _ = make_client_builder()

    client_a = build(UA)
    created = client_a.post(
        "/api/replacements",
        json={"original_plantation_id": 1, "replacement_plantation_id": 2},
    ).json()
    replacement_id = created["id"]

    # Un autre binôme NE PEUT PAS dégriser.
    client_b = build(UB)
    denied = client_b.delete(f"/api/replacements/{replacement_id}")
    assert denied.status_code == 403

    # Le verrouilleur peut dégriser.
    unlocked = client_a.delete(f"/api/replacements/{replacement_id}")
    assert unlocked.status_code == 200

    # Après dégrisage, la plantation est de nouveau disponible pour tous.
    available = client_b.get("/api/binomes/2/available-replacements?brigade_id=1").json()
    assert {p["id"] for p in available} == {2, 3}
    assert all(p["is_locked"] is False for p in available)


def test_admin_can_unlock():
    build, _ = make_client_builder()

    client_a = build(UA)
    replacement_id = client_a.post(
        "/api/replacements",
        json={"original_plantation_id": 1, "replacement_plantation_id": 2},
    ).json()["id"]

    client_admin = build(ADMIN)
    assert client_admin.delete(f"/api/replacements/{replacement_id}").status_code == 200


def test_unlock_unknown_replacement_404():
    build, _ = make_client_builder()
    client = build(UA)
    assert client.delete("/api/replacements/999").status_code == 404
"""Tests HTTP de régression sur les routes de suppression.

Couvre le bug de routage FastAPI où `DELETE /api/rehabilitations/all` était
masqué par la route dynamique `DELETE /api/rehabilitations/{rehab_id}` :
"all" ne pouvant pas être converti en entier, le serveur répondait 422.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db, require_active
from app.models import Rehabilitation, User
from app.routers import rehabilitations

# Compte administrateur factice : les routes exigent désormais un utilisateur
# authentifié, et un admin voit l'intégralité des fiches (aucune restriction).
ADMIN = User(id=1, username="admin", role="admin", is_active=True)

BASE_ROW = dict(
    pda_number="PDA-TEST",
    departement="Atlantique",
    commune="Abomey-Calavi",
    arrondissement="Calavi",
    village="Aga",
    annee_rehabilitation=2024,
    superficie_rehabilitee=5,
)


def make_client():
    """App FastAPI montée sur le vrai router, branchée sur une SQLite partagée.

    `StaticPool` est indispensable avec `:memory:` : sans lui, chaque connexion
    SQLite reçoit sa propre base vide (le piège classique des tests).
    """
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
    app.dependency_overrides[require_active] = lambda: ADMIN
    return TestClient(app), TestingSession


def _seed(session_factory, count: int):
    with session_factory() as db:
        db.add_all(Rehabilitation(**{**BASE_ROW, "pda_number": f"PDA-TEST-{i}"}) for i in range(count))
        db.commit()


def test_delete_all_is_not_shadowed_by_dynamic_route():
    client, session_factory = make_client()
    _seed(session_factory, 2)

    resp = client.delete("/api/rehabilitations/all")

    assert resp.status_code == 200, f"Réponse inattendue : {resp.status_code} {resp.text}"
    assert resp.json()["deleted"] == 2

    leftover = client.get("/api/rehabilitations?limit=10").json()
    assert leftover["items"] == []
    assert leftover["pagination"]["total"] == 0


def test_delete_single_rehabilitation_still_works():
    client, session_factory = make_client()
    _seed(session_factory, 1)

    with session_factory() as db:
        rehab_id = db.query(Rehabilitation.id).scalar()

    resp = client.delete(f"/api/rehabilitations/{rehab_id}")
    assert resp.status_code == 200

    missing = client.delete(f"/api/rehabilitations/{rehab_id}")
    assert missing.status_code == 404


def test_delete_all_on_empty_table_returns_200():
    client, _ = make_client()
    resp = client.delete("/api/rehabilitations/all")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 0


def test_surface_classification_uses_the_8_required_ranges():
    client, session_factory = make_client()
    cases = [
        (0.5, "S < 1 ha"),
        (1.0, "1 ≤ S < 2 ha"),
        (2.0, "2 ≤ S < 3 ha"),
        (3.0, "3 ≤ S < 5 ha"),
        (5.0, "5 ≤ S < 10 ha"),
        (10.0, "10 ≤ S < 20 ha"),
        (20.0, "20 ≤ S ≤ 30 ha"),
        (31.0, "S > 30 ha"),
    ]

    with session_factory() as db:
        for i, (surface, _expected_label) in enumerate(cases, start=1):
            db.add(Rehabilitation(**{**BASE_ROW, "pda_number": f"PDA-CLASS-{i}", "superficie_rehabilitee": surface}))
        db.commit()

    resp = client.get("/api/rehabilitations?limit=50")
    assert resp.status_code == 200

    actual = {item["pda_number"]: item["sup_class"] for item in resp.json()["items"]}
    expected = {
        "PDA-CLASS-1": "S < 1 ha",
        "PDA-CLASS-2": "1 ≤ S < 2 ha",
        "PDA-CLASS-3": "2 ≤ S < 3 ha",
        "PDA-CLASS-4": "3 ≤ S < 5 ha",
        "PDA-CLASS-5": "5 ≤ S < 10 ha",
        "PDA-CLASS-6": "10 ≤ S < 20 ha",
        "PDA-CLASS-7": "20 ≤ S ≤ 30 ha",
        "PDA-CLASS-8": "S > 30 ha",
    }

    assert actual == expected
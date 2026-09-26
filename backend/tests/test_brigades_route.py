"""Tests de la route GET /api/rehabilitations/brigades (regroupement par nom).

Une même brigade peut être enregistrée plusieurs fois avec des clés primaires
différentes : la route doit renvoyer chaque nom une seule fois, avec le nombre
de fiches associé, et ignorer les noms NULL ou vides.
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
    """App FastAPI montée sur le vrai router, branchée sur une SQLite partagée."""
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


def _seed_with_duplicates(session_factory):
    """La brigade Alpha est enregistrée deux fois (clés primaires différentes)."""
    with session_factory() as db:
        db.add_all(
            [
                Rehabilitation(
                    **{**BASE_ROW, "pda_number": "PDA-1", "brigade_name": "Brigade Alpha"}
                ),
                Rehabilitation(
                    **{**BASE_ROW, "pda_number": "PDA-2", "brigade_name": "Brigade Alpha"}
                ),
                Rehabilitation(
                    **{**BASE_ROW, "pda_number": "PDA-3", "brigade_name": "Brigade Beta"}
                ),
                Rehabilitation(**{**BASE_ROW, "pda_number": "PDA-4", "brigade_name": None}),
                Rehabilitation(**{**BASE_ROW, "pda_number": "PDA-5", "brigade_name": ""}),
            ]
        )
        db.commit()


def test_brigades_grouped_by_name_appear_once():
    client, session_factory = make_client()
    _seed_with_duplicates(session_factory)

    resp = client.get("/api/rehabilitations/brigades")

    assert resp.status_code == 200
    brigades = resp.json()
    names = [b["name"] for b in brigades]

    # Un même nom ne s'affiche qu'une seule fois, même avec des doublons en base.
    assert len(names) == len(set(names))
    # Les noms NULL ou vides sont exclus.
    assert names == ["Brigade Alpha", "Brigade Beta"]
    assert names == sorted(names)


def test_brigade_count_matches_number_of_fiches():
    client, session_factory = make_client()
    _seed_with_duplicates(session_factory)

    resp = client.get("/api/rehabilitations/brigades")
    by_name = {b["name"]: b["fiches"] for b in resp.json()}

    assert by_name == {"Brigade Alpha": 2, "Brigade Beta": 1}


def test_brigades_route_not_shadowed_by_dynamic_route():
    client, _ = make_client()

    resp = client.get("/api/rehabilitations/brigades")

    assert resp.status_code == 200
    assert resp.json() == []
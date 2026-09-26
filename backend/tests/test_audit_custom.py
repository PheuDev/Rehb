"""Suggestion d'audit : paramètres personnalisés (pourcentages) et unicité des fiches.

Scénario utilisateur :
- Par défaut : 25 % de la superficie totale + au moins 20 % du nombre de
  plantations par brigade.
- Personnalisé : l'utilisateur choisit ses propres pourcentages.
- Une plantation ne peut être suggérée qu'UNE SEULE fois dans une même
  séquence de suggestion (aucun doublon).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db, require_active, require_admin
from app.models import Rehabilitation, User
from app.routers import rehabilitations

ADMIN = User(
    id=1, username="admin", full_name="Admin", role="admin",
    is_active=True, hashed_password="x",
)

# Brigade A : 4 fiches (1+2+3+4 = 10 ha) ; Brigade B : 4 fiches (5+6+7+8 = 26 ha)
REHABILITATIONS = [
    {"id": 1, "pda_number": "PDA-1", "brigade_name": "Brigade A", "superficie_rehabilitee": 1, "annee_rehabilitation": 2024},
    {"id": 2, "pda_number": "PDA-2", "brigade_name": "Brigade A", "superficie_rehabilitee": 2, "annee_rehabilitation": 2024},
    {"id": 3, "pda_number": "PDA-3", "brigade_name": "Brigade A", "superficie_rehabilitee": 3, "annee_rehabilitation": 2024},
    {"id": 4, "pda_number": "PDA-4", "brigade_name": "Brigade A", "superficie_rehabilitee": 4, "annee_rehabilitation": 2024},
    {"id": 5, "pda_number": "PDA-5", "brigade_name": "Brigade B", "superficie_rehabilitee": 5, "annee_rehabilitation": 2023},
    {"id": 6, "pda_number": "PDA-6", "brigade_name": "Brigade B", "superficie_rehabilitee": 6, "annee_rehabilitation": 2023},
    {"id": 7, "pda_number": "PDA-7", "brigade_name": "Brigade B", "superficie_rehabilitee": 7, "annee_rehabilitation": 2023},
    {"id": 8, "pda_number": "PDA-8", "brigade_name": "Brigade B", "superficie_rehabilitee": 8, "annee_rehabilitation": 2023},
]


def make_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with TestingSession() as db:
        db.add(User(id=1, username="admin", full_name="Admin", role="admin", is_active=True, hashed_password="x"))
        for r in REHABILITATIONS:
            db.add(Rehabilitation(**r))
        db.commit()

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
    app.dependency_overrides[require_admin] = lambda: ADMIN
    return TestClient(app)


def _unique(ids):
    return len(ids) == len(set(ids))


def test_audit_sample_default_parameters():
    client = make_client()
    response = client.get("/api/rehabilitations/audit-sample")
    assert response.status_code == 200
    body = response.json()
    assert body["pourcentage_global"] == 25
    assert body["pourcentage_brigade"] == 20
    assert body["superficie_totale"] == 36
    ids = [f["id"] for f in body["fiches"]]
    assert _unique(ids)


def test_audit_sample_custom_percentages():
    client = make_client()
    response = client.get(
        "/api/rehabilitations/audit-sample",
        params={"pourcentage_global": 50, "pourcentage_brigade": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pourcentage_global"] == 50
    assert body["pourcentage_brigade"] == 50
    # 50 % de 36 ha = 18 ha minimum (le dépassement dû au dernier tirage est permis).
    assert body["superficie_echantillon"] >= 18
    assert body["pourcentage_couverture"] >= 50
    ids = [f["id"] for f in body["fiches"]]
    assert _unique(ids)


def test_audit_sample_global_100_selects_every_fiche_once():
    client = make_client()
    response = client.get(
        "/api/rehabilitations/audit-sample",
        params={"pourcentage_global": 100, "pourcentage_brigade": 100},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_fiches"] == 8
    assert body["superficie_echantillon"] == 36
    assert body["fiches_hors_echantillon"] == []
    ids = [f["id"] for f in body["fiches"]]
    # Aucune fiche citée plus d'une fois, même à 100 %.
    assert _unique(ids)
    assert set(ids) == {1, 2, 3, 4, 5, 6, 7, 8}


def test_audit_sample_out_of_range_rejected():
    client = make_client()
    response = client.get(
        "/api/rehabilitations/audit-sample",
        params={"pourcentage_global": 150},
    )
    assert response.status_code == 422


def test_audit_export_accepts_custom_percentages():
    client = make_client()
    response = client.get(
        "/api/rehabilitations/audit-sample/export-excel",
        params={"pourcentage_global": 100, "pourcentage_brigade": 100},
    )
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
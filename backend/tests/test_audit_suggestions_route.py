"""Tests des routes de sauvegarde des suggestions d'audit superficie."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db, require_active, require_admin
from app.models import User
from app.routers import rehabilitations

ADMIN = User(
    id=1,
    username="admin",
    full_name="Admin Test",
    role="admin",
    is_active=True,
    hashed_password="x",
)

SAMPLE_SNAPSHOT = {
    "fiches": [
        {
            "id": 1,
            "pda_number": "PDA-1",
            "departement": "Atlantique",
            "commune": "Calavi",
            "arrondissement": None,
            "village": "Aga",
            "brigade_name": "Brigade Alpha",
            "producer_name": "Prod A",
            "superficie_rehabilitee": 5.0,
            "annee_rehabilitation": 2024,
            "audit_classe": "3 ≤ S < 5 ha",
        }
    ],
    "fiches_hors_echantillon": [],
    "total_fiches": 1,
    "superficie_echantillon": 5.0,
    "superficie_totale": 20.0,
    "pourcentage_couverture": 25.0,
    "par_classe": [],
    "par_brigade": [
        {
            "brigade": "Brigade Alpha",
            "total_fiches": 4,
            "fiches_echantillon": 1,
            "pourcentage_fiches": 25.0,
            "superficie_brigade": 20.0,
            "superficie_echantillon": 5.0,
            "pourcentage_superficie": 25.0,
        }
    ],
}


def make_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with TestingSession() as db:
        db.add(
            User(
                id=1,
                username="admin",
                full_name="Admin Test",
                role="admin",
                is_active=True,
                hashed_password="hashed",
            )
        )
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


def test_save_list_and_get_audit_suggestion():
    client = make_client()

    created = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne T1", "snapshot": SAMPLE_SNAPSHOT},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Campagne T1"
    assert body["nb_fiches_echantillon"] == 1
    suggestion_id = body["id"]

    listed = client.get("/api/rehabilitations/audit-suggestions")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    detail = client.get(f"/api/rehabilitations/audit-suggestions/{suggestion_id}")
    assert detail.status_code == 200
    assert detail.json()["snapshot"]["fiches"][0]["pda_number"] == "PDA-1"


def test_export_saved_audit_excel():
    client = make_client()
    created = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"snapshot": SAMPLE_SNAPSHOT},
    )
    suggestion_id = created.json()["id"]

    response = client.get(f"/api/rehabilitations/audit-suggestions/{suggestion_id}/export-excel")
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert len(response.content) > 500


def test_delete_audit_suggestion():
    client = make_client()
    created = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"snapshot": SAMPLE_SNAPSHOT},
    )
    suggestion_id = created.json()["id"]

    deleted = client.delete(f"/api/rehabilitations/audit-suggestions/{suggestion_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/api/rehabilitations/audit-suggestions/{suggestion_id}")
    assert missing.status_code == 404

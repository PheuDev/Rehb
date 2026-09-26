"""Distribution des suggestions d'audit vers les équipes (Mes plantations)."""

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
    Team,
    TeamAuditAssignment,
    TeamBrigadeAssignment,
    User,
)
from app.routers import rehabilitations

ADMIN = User(
    id=1,
    username="admin",
    full_name="Admin",
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
            "village": "Aga",
            "brigade_name": "Brigade Alpha",
            "producer_name": "Prod A",
            "superficie_rehabilitee": 5.0,
            "annee_rehabilitation": 2024,
        }
    ],
    "fiches_hors_echantillon": [],
    "total_fiches": 1,
    "superficie_echantillon": 5.0,
    "superficie_totale": 20.0,
    "pourcentage_couverture": 25.0,
    "par_classe": [],
    "par_brigade": [],
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
                full_name="Admin",
                role="admin",
                is_active=True,
                hashed_password="hashed",
            )
        )
        db.add(Team(id=1, name="Équipe A"))
        db.add(Binome(id=1, name="Binôme 1", team_id=1))
        db.add(BrigadeEntity(id=1, name="Brigade Alpha"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(
            Rehabilitation(
                id=1,
                pda_number="PDA-1",
                brigade_name="Brigade Alpha",
                superficie_rehabilitee=5,
                annee_rehabilitation=2024,
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
    return TestClient(app), TestingSession


def test_save_audit_dispatches_plantations_to_team_binomes():
    client, session_factory = make_client()

    response = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne test", "snapshot": SAMPLE_SNAPSHOT},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["dispatch"]["fiches_dispatched"] == 1
    assert body["dispatch"]["binome_assignments_created"] == 1
    assert len(body["dispatch"]["teams"]) == 1
    assert body["dispatch"]["teams"][0]["team_name"] == "Équipe A"

    with session_factory() as db:
        assignments = db.query(SampleAssignment).filter(SampleAssignment.binome_id == 1).all()
        assert len(assignments) == 1

    with session_factory() as db:
        assert db.query(Plantation).count() == 1
        assert db.query(TeamAuditAssignment).filter(TeamAuditAssignment.team_id == 1).count() == 1


# ─── Multi-brigades par équipe ──────────────────────────────────────────────────

MULTI_BRIGADE_SNAPSHOT = {
    "fiches": [
        {
            "id": 1, "pda_number": "PDA-1", "departement": "Atlantique", "commune": "Calavi",
            "village": "Aga", "brigade_name": "Brigade Alpha", "producer_name": "Prod A",
            "superficie_rehabilitee": 5.0, "annee_rehabilitation": 2024,
        },
        {
            "id": 2, "pda_number": "PDA-2", "departement": "Alibori", "commune": "Kandi",
            "village": "Bgo", "brigade_name": "Brigade Beta", "producer_name": "Prod B",
            "superficie_rehabilitee": 3.0, "annee_rehabilitation": 2024,
        },
        {
            "id": 3, "pda_number": "PDA-3", "departement": "Borgou", "commune": "Parakou",
            "village": "Cga", "brigade_name": "Brigade Gamma", "producer_name": "Prod C",
            "superficie_rehabilitee": 7.0, "annee_rehabilitation": 2023,
        },
    ],
    "fiches_hors_echantillon": [],
    "total_fiches": 3,
    "superficie_echantillon": 15.0,
    "superficie_totale": 60.0,
    "pourcentage_couverture": 25.0,
    "par_classe": [],
    "par_brigade": [],
}


def make_multi_team_client():
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
                full_name="Admin",
                role="admin",
                is_active=True,
                hashed_password="hashed",
            )
        )
        db.add(Team(id=1, name="Équipe A"))
        db.add(Team(id=2, name="Équipe B"))
        db.add(Binome(id=1, name="Binôme A1", team_id=1))
        db.add(Binome(id=2, name="Binôme B1", team_id=2))
        db.add(BrigadeEntity(id=1, name="Brigade Alpha"))
        db.add(BrigadeEntity(id=2, name="Brigade Beta"))
        db.add(BrigadeEntity(id=3, name="Brigade Gamma"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(TeamBrigadeAssignment(brigade_id=2, team_id=1))
        db.add(TeamBrigadeAssignment(brigade_id=3, team_id=2))
        db.add(
            Rehabilitation(
                id=1, pda_number="PDA-1", brigade_name="Brigade Alpha",
                superficie_rehabilitee=5, annee_rehabilitation=2024,
            )
        )
        db.add(
            Rehabilitation(
                id=2, pda_number="PDA-2", brigade_name="Brigade Beta",
                superficie_rehabilitee=3, annee_rehabilitation=2024,
            )
        )
        db.add(
            Rehabilitation(
                id=3, pda_number="PDA-3", brigade_name="Brigade Gamma",
                superficie_rehabilitee=7, annee_rehabilitation=2023,
            )
        )
        db.add(
            Rehabilitation(
                id=4, pda_number="PDA-4", brigade_name="Brigade Alpha",
                superficie_rehabilitee=2, annee_rehabilitation=2022,
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
    return TestClient(app), TestingSession
def test_save_audit_dispatches_multiple_brigades_to_teams():
    """Une équipe multi-brigades reçoit toutes les fiches de SES brigades."""
    client, session_factory = make_multi_team_client()

    response = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne multi-brigades", "snapshot": MULTI_BRIGADE_SNAPSHOT},
    )
    assert response.status_code == 201
    dispatch = response.json()["dispatch"]
    assert dispatch["fiches_dispatched"] == 3
    assert len(dispatch["teams"]) == 2

    by_name = {t["team_name"]: t for t in dispatch["teams"]}
    assert by_name["Équipe A"]["fiches"] == 2
    assert by_name["Équipe B"]["fiches"] == 1

    with session_factory() as db:
        counts = {
            binome_id: (
                db.query(SampleAssignment)
                .filter(SampleAssignment.binome_id == binome_id)
                .count()
            )
            for binome_id in (1, 2)
        }
        assert counts == {1: 2, 2: 1}

        plantations = db.query(Plantation).order_by(Plantation.id).all()
        assert len(plantations) == 3
        assert {p.brigade.name for p in plantations} == {
            "Brigade Alpha", "Brigade Beta", "Brigade Gamma",
        }


def test_save_audit_materializes_hors_echantillon_sheet():
    client, session_factory = make_multi_team_client()
    snapshot = {
        **MULTI_BRIGADE_SNAPSHOT,
        "fiches_hors_echantillon": [
            {
                "id": 4, "pda_number": "PDA-4", "departement": "Atlantique",
                "commune": "Calavi", "village": "Dassa", "brigade_name": "Brigade Alpha",
                "producer_name": "Prod D", "superficie_rehabilitee": 2.0,
            },
        ],
    }

    response = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Suggestion avec hors-échantillon", "snapshot": snapshot},
    )

    assert response.status_code == 201
    assert response.json()["dispatch"]["plantations_hors_echantillon_created"] == 1
    with session_factory() as db:
        replacement = db.query(Plantation).filter(
            Plantation.source_rehabilitation_id == 4,
            Plantation.is_sample.is_(False),
        ).one()
        assert replacement.pda_number == "PDA-4"
        assert replacement.producer_name == "Prod D"
        assert replacement.superficie == 2.0
        assert replacement.brigade.name == "Brigade Alpha"


def test_save_audit_registers_fiche_for_team_without_binome():
    """Sans binôme, la fiche reste attribuée à l'équipe (visible chef/admin)."""
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
                full_name="Admin",
                role="admin",
                is_active=True,
                hashed_password="hashed",
            )
        )
        db.add(Team(id=1, name="Équipe sans binôme"))
        db.add(BrigadeEntity(id=1, name="Brigade Alpha"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(
            Rehabilitation(
                id=1, pda_number="PDA-1", brigade_name="Brigade Alpha",
                superficie_rehabilitee=5, annee_rehabilitation=2024,
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
    client = TestClient(app)

    response = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne", "snapshot": SAMPLE_SNAPSHOT},
    )
    assert response.status_code == 201
    dispatch = response.json()["dispatch"]
    assert dispatch["fiches_dispatched"] == 1
    assert dispatch["teams"][0]["team_name"] == "Équipe sans binôme"
    assert dispatch["teams"][0]["binomes"] == 0
    assert any("aucun binôme" in w.lower() for w in dispatch["warnings"])

    with TestingSession() as db:
        assert db.query(Plantation).count() == 1
        assert (
            db.query(TeamAuditAssignment)
            .filter(TeamAuditAssignment.team_id == 1)
            .count()
        ) == 1
def test_delete_suggestion_removes_dispatched_plantations():
    """Supprimer la suggestion retire les fiches distribuées aux équipes."""
    client, session_factory = make_client()

    created = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "À supprimer", "snapshot": SAMPLE_SNAPSHOT},
    )
    assert created.status_code == 201
    suggestion_id = created.json()["id"]
    assert created.json()["dispatch"]["fiches_dispatched"] == 1

    deleted = client.delete(f"/api/rehabilitations/audit-suggestions/{suggestion_id}")
    assert deleted.status_code == 204
    assert (
        client.get(f"/api/rehabilitations/audit-suggestions/{suggestion_id}").status_code
        == 404
    )

    with session_factory() as db:
        # Plus aucune trace de la distribution dans les équipes.
        assert db.query(SampleAssignment).count() == 0
        assert db.query(TeamAuditAssignment).count() == 0
        assert db.query(Plantation).count() == 0
        # La fiche de réhabilitation est conservée, mais ne pointe plus vers rien.
        rehab = db.query(Rehabilitation).filter(Rehabilitation.id == 1).first()
        assert rehab is not None
        assert rehab.plantation_id is None


def make_reused_plantations_client():
    """Équipe + brigade + fiche dont la plantation existe déjà (réutilisation)."""
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
                full_name="Admin",
                role="admin",
                is_active=True,
                hashed_password="hashed",
            )
        )
        db.add(Team(id=1, name="Équipe A"))
        db.add(Binome(id=1, name="Binôme 1", team_id=1))
        db.add(BrigadeEntity(id=1, name="Brigade Alpha"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(
            Rehabilitation(
                id=1, pda_number="PDA-1", brigade_name="Brigade Alpha",
                superficie_rehabilitee=5, annee_rehabilitation=2024,
            )
        )
        # La plantation de la fiche existe déjà avant toute suggestion.
        db.add(Plantation(
            id=1, pda_number="PDA-1", brigade_id=1,
            is_sample=True, source_rehabilitation_id=1,
        ))
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
    return TestClient(app), TestingSession


def test_delete_reused_suggestion_spares_other_suggestion_distribution():
    """Une plantation réutilisée ne disparaît pas si une autre
    suggestion la référence encore — seule la suggestion « propriétaire »
    (celle qui a créé le lien équipe) nettoie la distribution."""
    client, session_factory = make_reused_plantations_client()

    a = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne A", "snapshot": SAMPLE_SNAPSHOT},
    ).json()
    b = client.post(
        "/api/rehabilitations/audit-suggestions",
        json={"title": "Campagne B", "snapshot": SAMPLE_SNAPSHOT},
    ).json()
    assert a["dispatch"]["plantations_reused"] == 1
    assert b["dispatch"]["plantations_reused"] == 1

    # Une seule attribution de binôme, un seul lien équipe (contrainte unique).
    with session_factory() as db:
        assert db.query(SampleAssignment).count() == 1
        assert db.query(TeamAuditAssignment).count() == 1

    # Supprimer la suggestion B (réutilisée sans lien propre) : rien ne bouge.
    assert client.delete(f"/api/rehabilitations/audit-suggestions/{b['id']}").status_code == 204
    with session_factory() as db:
        assert db.query(Plantation).count() == 1
        assert db.query(SampleAssignment).count() == 1

    # Supprimer la suggestion propriétaire A : la distribution disparaît.
    assert client.delete(f"/api/rehabilitations/audit-suggestions/{a['id']}").status_code == 204
    with session_factory() as db:
        assert db.query(Plantation).count() == 0
        assert db.query(SampleAssignment).count() == 0
        assert db.query(TeamAuditAssignment).count() == 0

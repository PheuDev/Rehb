"""Page « Plantations hors échantillon » — marquer comme utilisée (remplacement).

Scénario utilisateur :
- L'équipe choisit une plantation hors-échantillon du stock d'une brigade.
- « Marquer comme utilisée » → on choisit une plantation échantillonnée de la
  MÊME brigade à remplacer.
- La hors-échantillon devient grisée (non réutilisable) et l'échantillonnée
  passe au statut « remplacée » dans Mes plantations.
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
    ReplacementSelection,
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
CHEF_A = User(
    id=2, username="chef_a", full_name="Chef A", role="chef_equipe",
    team_id=1, is_active=True, hashed_password="x",
)
CHEF_B = User(
    id=3, username="chef_b", full_name="Chef B", role="chef_equipe",
    team_id=2, is_active=True, hashed_password="x",
)
BINOME_A = User(
    id=4, username="binome_a", full_name="Binôme A", role="binome",
    team_id=1, binome_id=1, is_active=True, hashed_password="x",
)


CHEF_WITHOUT_TEAM = User(
    id=5, username="chef_sans_equipe", full_name="Chef sans equipe",
    role="chef_equipe", is_active=True, hashed_password="x",
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
        db.add(User(id=2, username="chef_a", full_name="Chef A", role="chef_equipe", team_id=1, is_active=True, hashed_password="x"))
        db.add(User(id=3, username="chef_b", full_name="Chef B", role="chef_equipe", team_id=2, is_active=True, hashed_password="x"))
        db.add(User(id=4, username="binome_a", full_name="Binôme A", role="binome", team_id=1, binome_id=1, is_active=True, hashed_password="x"))

        db.add(Team(id=1, name="Équipe A"))
        db.add(Team(id=2, name="Équipe B"))
        db.add(Binome(id=1, name="Binôme 1", team_id=1))
        db.add(Binome(id=2, name="Binôme 2", team_id=1))

        db.add(BrigadeEntity(id=1, name="Brigade A"))
        db.add(BrigadeEntity(id=2, name="Brigade B"))
        db.add(TeamBrigadeAssignment(brigade_id=1, team_id=1))
        db.add(TeamBrigadeAssignment(brigade_id=2, team_id=2))

        # Échantillonnées — brigade A
        db.add(Plantation(id=1, pda_number="PDA-1", brigade_id=1, is_sample=True))
        db.add(Plantation(id=2, pda_number="PDA-2", brigade_id=1, is_sample=True))
        # Hors-échantillon — brigade A (stock de remplacement)
        db.add(Plantation(id=3, pda_number="PDA-3", brigade_id=1, is_sample=False))
        db.add(Plantation(id=4, pda_number="PDA-4", brigade_id=1, is_sample=False))
        # Hors-échantillon — brigade B
        db.add(Plantation(id=5, pda_number="PDA-5", brigade_id=2, is_sample=False))

        db.add(SampleAssignment(plantation_id=1, binome_id=1))
        db.add(SampleAssignment(plantation_id=2, binome_id=2))
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


def test_list_hors_echantillon_scoped_to_brigade():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    response = client.get("/api/plantations/hors-echantillon", params={"brigade_id": 1})
    assert response.status_code == 200
    items = response.json()
    ids = {p["id"] for p in items}
    # Uniquement le stock hors-échantillon de la brigade A.
    assert ids == {3, 4}
    assert all(p["is_sample"] is False for p in items)
    assert all(p["is_locked"] is False for p in items)


def test_unassigned_user_cannot_list_plantations_from_all_teams():
    client = make_client_builder()[0](CHEF_WITHOUT_TEAM)

    hors = client.get("/api/plantations/hors-echantillon")
    sample = client.get("/api/plantations/echantillon")

    assert hors.status_code == 200
    assert hors.json() == []
    assert sample.status_code == 200
    assert sample.json() == []


def test_list_echantillon_excludes_already_replaced():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    # Marque la hors-échantillon 3 comme remplaçante de l'échantillonnée 1.
    created = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 3, "original_plantation_id": 1},
    )
    assert created.status_code == 201

    # La liste des candidates au remplacement ne contient plus la 1.
    response = client.get("/api/plantations/echantillon", params={"brigade_id": 1})
    assert response.status_code == 200
    assert {p["id"] for p in response.json()} == {2}
def test_from_stock_grises_replacement_and_marks_sample_replaced():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    created = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 3, "original_plantation_id": 1},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["original_plantation_id"] == 1
    assert body["replacement_plantation_id"] == 3
    assert body["locked_by_id"] == 2  # le chef A
    assert body["locked_by_me"] is True

    # La hors-échantillon 3 est désormais grisée dans le stock.
    stock = client.get("/api/plantations/hors-echantillon", params={"brigade_id": 1}).json()
    by_id = {p["id"]: p for p in stock}
    assert by_id[3]["is_locked"] is True
    assert by_id[3]["locked_by_me"] is True
    assert by_id[4]["is_locked"] is False

    # L'échantillonnée 1 passe au statut « remplacée » dans Mes plantations.
    mine = client.get("/api/binomes/1/plantations").json()
    orig = next(p for p in mine if p["id"] == 1)
    assert orig["is_replaced"] is True


def test_from_stock_rejects_double_use_of_replacement():
    build, _ = make_client_builder()
    client = build(CHEF_A)

    first = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 3, "original_plantation_id": 1},
    )
    assert first.status_code == 201

    # La même hors-échantillon ne peut pas servir une seconde fois.
    second = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 3, "original_plantation_id": 2},
    )
    assert second.status_code == 409


def test_from_stock_requires_same_brigade():
    build, _ = make_client_builder()
    client = build(ADMIN)

    # Plantation 5 = brigade B, plantation 1 = brigade A → refusé.
    response = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 5, "original_plantation_id": 1},
    )
    assert response.status_code == 400
    assert "même brigade" in response.json()["detail"]


def test_from_stock_scoped_to_team_brigades():
    build, _ = make_client_builder()
    client = build(CHEF_B)  # équipe B : seule la brigade B la concerne

    response = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 3, "original_plantation_id": 1},
    )
    assert response.status_code == 403


def test_from_stock_by_binome_uses_his_binome():
    build, TestingSession = make_client_builder()
    client = build(BINOME_A)

    created = client.post(
        "/api/replacements/from-stock",
        json={"replacement_plantation_id": 4, "original_plantation_id": 2},
    )
    assert created.status_code == 201
    assert created.json()["binome_id"] == 1

    with TestingSession() as db:
        sel = db.query(ReplacementSelection).filter(
            ReplacementSelection.original_plantation_id == 2
        ).first()
        assert sel is not None
        assert sel.binome_id == 1

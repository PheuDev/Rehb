"""Tests de robustesse du démarrage (cause de l'échec de déploiement Render).

Régression : toutes les instructions DDL partageaient UNE SEULE transaction.
PostgreSQL avortant la transaction courante à la première erreur, la création
de la table `users` — et de tout le reste — échouait silencieusement, puis la
première requête de contrôle non protégée provoquait :

    current transaction is aborted, commands ignored until end of transaction
    ERROR: Application startup failed. Exiting.  →  Exited with status 3

Ces tests garantissent que :
1. une instruction DDL en échec ne bloque plus les suivantes ;
2. une étape de démarrage en échec n'empêche plus l'API de démarrer ;
3. les migrations ne suppriment aucune donnée (colonne ou ligne).
"""

import inspect

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main
from app.database import Base


def _sqlite_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def _tables(engine) -> set[str]:
    with engine.connect() as conn:
        return {
            row[0]
            for row in conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }


def test_failed_ddl_does_not_block_following_statements(monkeypatch):
    """La table `users` doit être créée même si une instruction précédente échoue."""
    engine = _sqlite_engine()
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "BASE_DDL", [
        "CREATE TABLE teams (id INTEGER PRIMARY KEY)",
        "CREATE TABLE teams (id INTEGER PRIMARY KEY)",  # échoue : existe déjà
        "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)",
    ])

    main.ensure_database_schema()

    assert {"teams", "users"} <= _tables(engine)


def test_exec_ddl_signals_failure_without_raising(monkeypatch):
    engine = _sqlite_engine()
    monkeypatch.setattr(main, "engine", engine)

    assert main._exec_ddl("CREATE TABLE ok (id INTEGER PRIMARY KEY)") is True
    assert main._exec_ddl("CREATE TABLE ok (id INTEGER PRIMARY KEY)") is False
    assert main._exec_ddl("THIS IS NOT VALID SQL") is False


def test_lifespan_survives_a_failing_step(monkeypatch):
    """Une étape en échec est journalisée : le démarrage se poursuit."""
    executed = []

    def boom():
        raise RuntimeError("schéma cassé")

    def ok():
        executed.append("ok")

    monkeypatch.setattr(
        main, "STARTUP_STEPS", (("étape cassée", boom), ("étape saine", ok))
    )

    app = FastAPI()
    app.router.lifespan_context = main.lifespan
    with TestClient(app):
        pass

    assert executed == ["ok"]


def test_teams_migration_keeps_existing_data():
    """La campagne devient facultative, elle n'est jamais supprimée."""
    code = inspect.getsource(main.migrate_teams_schema)

    assert "DROP NOT NULL" in code
    assert "DROP COLUMN" not in code
    assert "DELETE" not in code


def test_assignments_migration_keeps_existing_data():
    """Aucun dédoublonnage destructeur : pas de DELETE automatique."""
    code = inspect.getsource(main.migrate_assignments_schema)

    assert "DROP NOT NULL" in code
    assert "DROP COLUMN" not in code
    assert "DELETE FROM" not in code


def test_brigade_sync_is_purely_additive():
    """La synchronisation des brigades n'insère que des lignes manquantes."""
    code = inspect.getsource(main.sync_brigades_from_fiches)

    assert "INSERT INTO brigade_entities" in code
    assert "DELETE" not in code
    assert "DROP " not in code


def test_brigade_sync_commits_its_inserts(monkeypatch):
    """Régression : les brigades créées doivent être COMMITÉES, pas annulées.

    Exécuter l'INSERT dans `engine.connect()` le fait être rollback à la
    fermeture de la connexion (SQLAlchemy 2.0) : la synchro semblait réussir
    dans les logs mais la table restait vide côté API.
    """
    from app.models import BrigadeEntity, Rehabilitation

    engine = _sqlite_engine()
    monkeypatch.setattr(main, "engine", engine)
    Base.metadata.create_all(engine)

    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO rehabilitations (pda_number, brigade_name, "
            "brigade_manager_name, superficie_rehabilitee) "
            "VALUES ('P1', '  Brigade du Nord  ', 'Moussa', 4)"
        )
        conn.exec_driver_sql(
            "INSERT INTO rehabilitations (pda_number, brigade_name, "
            "superficie_rehabilitee) VALUES ('P2', 'Brigade du Nord', 2)"
        )

    main.sync_brigades_from_fiches()

    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        names = [b.name for b in db.query(BrigadeEntity).all()]
        fiches = db.query(Rehabilitation).count()

    # Un seul nom (espaces normalisés) et la donnée est bien persistée.
    assert names == ["Brigade du Nord"]
    assert fiches == 2

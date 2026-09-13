import os

# Force une URL SQLite AVANT l'import d'`app.database`, pour que la suite de
# tests tourne sans PostgreSQL local (les tests créent leurs propres engines).
# La variable d'environnement reste prioritaire si elle est déjà définie.
os.environ.setdefault("DATABASE_URL", "sqlite:///./_test_app.db")
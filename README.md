# Gestion des réhabilitations forestières

Application web de gestion des fiches de réhabilitation forestière (PDA),
générée à partir du fichier `Architecture_complète.xls` (feuille `REHAB-2024`).

- **Backend** : Python / FastAPI / SQLAlchemy / PostgreSQL
- **Frontend** : React 18 / Vite / Tailwind CSS / Axios

## Arborescence

```
rehab-app/
├── backend/
│   ├── app/
│   │   ├── main.py            # Point d'entrée FastAPI
│   │   ├── config.py          # Configuration (variables d'environnement)
│   │   ├── database.py        # Connexion SQLAlchemy
│   │   ├── models.py          # Modèle ORM
│   │   ├── schemas.py         # Schémas Pydantic (validation)
│   │   ├── crud.py            # Logique métier / requêtes
│   │   ├── dependencies.py
│   │   └── routers/
│   │       └── rehabilitations.py
│   ├── sql/
│   │   └── schema.sql         # Table, trigger, index, vue
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── hooks/
    │   ├── pages/
    │   ├── utils/
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── .env.example
```

## 1. Prérequis

- PostgreSQL ≥ 13
- Python ≥ 3.10
- Node.js ≥ 18

## 2. Base de données

Créer la base et exécuter le script de schéma :

```bash
createdb rehab_db
psql -d rehab_db -f backend/sql/schema.sql
```

> Le script active l'extension `pg_trgm`, crée la table `rehabilitations`
> (avec la colonne générée `sup_class`), le trigger `updated_at`, les index
> (classiques + GIN trigramme) et la vue `v_rehabilitations_synthese`.

## 3. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows : venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Adapter DATABASE_URL, PORT, CORS_ORIGIN si besoin

uvicorn app.main:app --reload --port 8000
```

L'API est disponible sur `http://localhost:8000`.
Documentation interactive : `http://localhost:8000/docs`.

### Endpoints principaux

| Méthode | Route                              | Description                                   |
|---------|-------------------------------------|------------------------------------------------|
| GET     | `/api/rehabilitations`              | Liste paginée, recherche, filtres, tri         |
| GET     | `/api/rehabilitations/{id}`         | Détail d'une fiche                             |
| POST    | `/api/rehabilitations`              | Création                                       |
| PUT     | `/api/rehabilitations/{id}`         | Mise à jour                                    |
| DELETE  | `/api/rehabilitations/{id}`         | Suppression                                    |
| GET     | `/api/rehabilitations/filters`      | Valeurs distinctes pour les filtres            |
| GET     | `/api/rehabilitations/stats`        | Statistiques globales et agrégats              |
| GET     | `/api/rehabilitations/export`       | Export CSV (respecte les filtres actifs)       |

## 4. Frontend (React + Vite)

```bash
cd frontend
npm install

cp .env.example .env
# VITE_API_URL=/api (proxy Vite déjà configuré vers http://localhost:8000)

npm run dev
```

L'application est disponible sur `http://localhost:5173`.

## 5. Importer les données existantes du fichier Excel

Le script Python ci-dessous (à adapter au besoin) permet de charger les
données de `Architecture_complète.xls` (feuille `REHAB-2024`) vers l'API :

```python
import pandas as pd
import requests

df = pd.read_excel("Architecture_complète.xls", sheet_name="REHAB-2024")
API_URL = "http://localhost:8000/api/rehabilitations"

# Adapter le mapping des colonnes Excel -> champs API, puis :
for _, row in df.iterrows():
    payload = { ... }  # construire le dictionnaire à partir de `row`
    requests.post(API_URL, json=payload)
```

## 6. Build de production (frontend)

```bash
cd frontend
npm run build
npm run preview
```

## Notes techniques

- La classe de superficie (`sup_class`) est calculée automatiquement côté
  base de données (colonne générée) ; le frontend en affiche un aperçu en
  temps réel dans le formulaire, mais la valeur de référence reste celle
  renvoyée par l'API.
- L'export CSV utilise le séparateur `;` et un BOM UTF-8 pour une
  compatibilité optimale avec Excel.
- La recherche plein texte s'appuie sur un index GIN trigramme
  (`pg_trgm`) pour rester performante sur de gros volumes.
# Rehb

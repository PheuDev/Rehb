from decimal import Decimal
from typing import Optional

from sqlalchemy import or_, func, asc, desc
from sqlalchemy.orm import Session

from app.models import BrigadeEntity, Rehabilitation, SavedAuditSuggestion, TeamBrigadeAssignment, User
from app.schemas import RehabilitationCreate, RehabilitationUpdate
from app.completion import incomplete_condition

SORTABLE_COLUMNS = {
    "created_at": Rehabilitation.created_at,
    "updated_at": Rehabilitation.updated_at,
    "pda_number": Rehabilitation.pda_number,
    "departement": Rehabilitation.departement,
    "commune": Rehabilitation.commune,
    "arrondissement": Rehabilitation.arrondissement,
    "village": Rehabilitation.village,
    "annee_rehabilitation": Rehabilitation.annee_rehabilitation,
    "superficie_rehabilitee": Rehabilitation.superficie_rehabilitee,
    "sup_class": Rehabilitation.sup_class,
    "brigade_name": Rehabilitation.brigade_name,
    "producer_name": Rehabilitation.producer_name,
}

SUP_CLASSES = [
    "S < 1 ha",
    "1 ≤ S < 2 ha",
    "2 ≤ S < 3 ha",
    "3 ≤ S < 5 ha",
    "5 ≤ S < 10 ha",
    "10 ≤ S < 20 ha",
    "20 ≤ S ≤ 30 ha",
    "S > 30 ha",
]


def _brigade_scope_condition(brigade_names: list[str]):
    """Condition SQL de restriction par brigade.

    Les noms de brigade proviennent d'imports Excel : on compare sans tenir
    compte des espaces superflus ni de la casse, sinon une équipe pourrait ne
    voir aucune fiche à cause d'un simple espace en trop.
    """
    normalized = [name.strip().lower() for name in brigade_names if name and name.strip()]
    return func.lower(func.trim(Rehabilitation.brigade_name)).in_(normalized)


def _apply_filters(
    query,
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
):
    """Applique les filtres utilisateur à une requête sur les fiches.

    ``brigade_names`` porte la restriction de visibilité :
      - ``None``      → aucune restriction (administrateur) ;
      - ``[]``        → aucune brigade autorisée (donc aucun résultat) ;
      - ``["A", "B"]``→ seules les fiches de ces brigades sont visibles.
    """
    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Rehabilitation.pda_number.ilike(like),
                Rehabilitation.departement.ilike(like),
                Rehabilitation.commune.ilike(like),
                Rehabilitation.arrondissement.ilike(like),
                Rehabilitation.village.ilike(like),
                Rehabilitation.brigade_name.ilike(like),
                Rehabilitation.brigade_manager_name.ilike(like),
                Rehabilitation.producer_name.ilike(like),
            )
        )
    if departement:
        query = query.filter(Rehabilitation.departement.ilike(f"%{departement}%"))
    if commune:
        query = query.filter(Rehabilitation.commune.ilike(f"%{commune}%"))
    if arrondissement:
        query = query.filter(Rehabilitation.arrondissement.ilike(f"%{arrondissement}%"))
    if village:
        query = query.filter(Rehabilitation.village.ilike(f"%{village}%"))
    if brigade_name:
        query = query.filter(Rehabilitation.brigade_name.ilike(f"%{brigade_name}%"))
    if annee:
        query = query.filter(Rehabilitation.annee_rehabilitation == annee)
    if sup_class:
        query = query.filter(Rehabilitation.sup_class == sup_class)
    return query


# ---------------------------------------------------------------------------
# Visibilité : administrateur = toutes les fiches ; équipe = uniquement les
# fiches des brigades qui lui sont affectées (table team_brigade_assignments).
# ---------------------------------------------------------------------------

def get_team_brigade_names(db: Session, team_id: int) -> list[str]:
    """Noms des brigades affectées à une équipe (comparables à brigade_name)."""
    rows = (
        db.query(BrigadeEntity.name)
        .join(
            TeamBrigadeAssignment,
            TeamBrigadeAssignment.brigade_id == BrigadeEntity.id,
        )
        .filter(TeamBrigadeAssignment.team_id == team_id)
        .all()
    )
    return [row[0] for row in rows if row[0]]


def get_visible_brigade_names(db: Session, user: Optional[User]) -> Optional[list[str]]:
    """Périmètre de visibilité des fiches pour un utilisateur.

    - ``None`` → aucune restriction (administrateur : voit toutes les fiches) ;
    - ``[]``   → aucune brigade affectée à l'équipe (donc aucune fiche visible) ;
    - liste   → noms des brigades affectées à l'équipe de l'utilisateur.
    """
    if user is None or user.role == "admin":
        return None
    if not user.team_id:
        return []
    return get_team_brigade_names(db, user.team_id)


def is_fiche_visible(
    db: Session, user: Optional[User], brigade_name: Optional[str]
) -> bool:
    """Indique si une fiche (via son nom de brigade) est visible par l'utilisateur."""
    allowed = get_visible_brigade_names(db, user)
    if allowed is None:
        return True
    if not brigade_name:
        return False
    # Même normalisation que _brigade_scope_condition (espaces / casse)
    return brigade_name.strip().lower() in {name.strip().lower() for name in allowed}


def get_list(
    db: Session,
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    brigade_names: Optional[list[str]] = None,
):
    base_query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
        brigade_names=brigade_names,
    )

    total = base_query.count()

    superficie_totale = (
        _apply_filters(
            db.query(func.coalesce(func.sum(Rehabilitation.superficie_rehabilitee), 0)),
            q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
            brigade_names=brigade_names,
        ).scalar()
        or Decimal(0)
    )

    sort_column = SORTABLE_COLUMNS.get(sort_by, Rehabilitation.created_at)
    order_fn = asc if sort_order == "asc" else desc

    items = (
        base_query.order_by(order_fn(sort_column))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    total_pages = max((total + limit - 1) // limit, 1)

    pagination = {
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "hasNext": page < total_pages,
        "hasPrev": page > 1,
        "superficieTotale": float(superficie_totale),
    }

    return items, pagination


def get_incomplete_list(
    db: Session,
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    brigade_names: Optional[list[str]] = None,
):
    """Liste paginée des fiches ayant au moins une donnée métier manquante."""
    base_query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
        brigade_names=brigade_names,
    ).filter(incomplete_condition())
    total = base_query.count()
    sort_column = SORTABLE_COLUMNS.get(sort_by, Rehabilitation.created_at)
    order_fn = asc if sort_order == "asc" else desc
    items = (
        base_query.order_by(order_fn(sort_column))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    total_pages = max((total + limit - 1) // limit, 1)
    superficie_totale = (
        base_query.with_entities(func.coalesce(func.sum(Rehabilitation.superficie_rehabilitee), 0)).scalar()
        or Decimal(0)
    )
    return items, {
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "hasNext": page < total_pages,
        "hasPrev": page > 1,
        "superficieTotale": float(superficie_totale),
    }


def get_by_id(db: Session, rehab_id: int) -> Optional[Rehabilitation]:
    return db.query(Rehabilitation).filter(Rehabilitation.id == rehab_id).first()


def create(db: Session, payload: RehabilitationCreate) -> Rehabilitation:
    obj = Rehabilitation(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def bulk_create(db: Session, payloads) -> list:
    objs = [Rehabilitation(**p.model_dump()) for p in payloads]
    db.add_all(objs)
    db.commit()
    for obj in objs:
        db.refresh(obj)
    return objs


def update(db: Session, obj: Rehabilitation, payload: RehabilitationUpdate) -> Rehabilitation:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, obj: Rehabilitation) -> None:
    db.delete(obj)
    db.commit()


def delete_many(db: Session, ids: list[int]) -> int:
    if not ids:
        return 0
    deleted = db.query(Rehabilitation).filter(Rehabilitation.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted


def clear_all(db: Session) -> int:
    deleted = db.query(Rehabilitation).delete(synchronize_session=False)
    db.commit()
    return deleted


def get_filters(db: Session, brigade_names: Optional[list[str]] = None):
    """Valeurs distinctes des listes déroulantes (restreintes au périmètre)."""
    def scoped(query):
        if brigade_names is not None:
            query = query.filter(_brigade_scope_condition(brigade_names))
        return query

    def distinct_values(column):
        rows = (
            scoped(db.query(column))
            .filter(column.isnot(None), column != "")
            .distinct()
            .order_by(column)
            .all()
        )
        return [r[0] for r in rows]

    annees = [
        r[0]
        for r in scoped(db.query(Rehabilitation.annee_rehabilitation))
        .filter(Rehabilitation.annee_rehabilitation.isnot(None))
        .distinct()
        .order_by(Rehabilitation.annee_rehabilitation.desc())
        .all()
    ]

    return {
        "departements": distinct_values(Rehabilitation.departement),
        "communes": distinct_values(Rehabilitation.commune),
        "arrondissements": distinct_values(Rehabilitation.arrondissement),
        "villages": distinct_values(Rehabilitation.village),
        "brigades": distinct_values(Rehabilitation.brigade_name),
        "annees": annees,
        "supClasses": SUP_CLASSES,
    }


def get_brigades(db: Session, brigade_names: Optional[list[str]] = None) -> list[dict]:
    """Liste des brigades disponibles, regroupées par nom.

    Pour des raisons historiques de conflit, une même brigade peut être
    enregistrée plusieurs fois dans `rehabilitations` (clés primaires
    différentes). Regrouper par ``brigade_name`` garantit qu'un nom ne
    s'affiche qu'une seule fois, accompagné de son nombre de fiches.
    """
    query = db.query(
        Rehabilitation.brigade_name,
        func.count(Rehabilitation.id),
    ).filter(Rehabilitation.brigade_name.isnot(None), Rehabilitation.brigade_name != "")
    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    rows = (
        query.group_by(Rehabilitation.brigade_name)
        .order_by(func.lower(Rehabilitation.brigade_name))
        .all()
    )
    return [{"name": name, "fiches": count} for name, count in rows]


def get_brigades_detail(
    db: Session,
    q: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
) -> dict:
    """Liste détaillée des brigades avec toutes les informations agrégées.

    Pour chaque brigade : nom, responsable (nom + téléphone), nombre de fiches,
    superficie totale, départements, communes, villages, années actives.
    """
    query = db.query(Rehabilitation).filter(
        Rehabilitation.brigade_name.isnot(None),
        Rehabilitation.brigade_name != "",
    )
    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Rehabilitation.brigade_name.ilike(like),
                Rehabilitation.brigade_manager_name.ilike(like),
                Rehabilitation.brigade_manager_phone.ilike(like),
                Rehabilitation.departement.ilike(like),
                Rehabilitation.commune.ilike(like),
                Rehabilitation.village.ilike(like),
            )
        )

    rows = query.order_by(func.lower(Rehabilitation.brigade_name)).all()

    brigades: dict[str, dict] = {}
    for r in rows:
        key = r.brigade_name
        if key not in brigades:
            brigades[key] = {
                "brigade_name": key,
                "manager_name": None,
                "manager_phone": None,
                "fiches": 0,
                "superficie_totale": 0.0,
                "departements": set(),
                "communes": set(),
                "villages": set(),
                "annees": set(),
            }
        b = brigades[key]
        b["fiches"] += 1
        # On prend le premier responsable non vide rencontré
        if not b["manager_name"] and r.brigade_manager_name:
            b["manager_name"] = r.brigade_manager_name
        if not b["manager_phone"] and r.brigade_manager_phone:
            b["manager_phone"] = r.brigade_manager_phone
        if r.superficie_rehabilitee is not None:
            b["superficie_totale"] += float(r.superficie_rehabilitee)
        if r.departement:
            b["departements"].add(r.departement)
        if r.commune:
            b["communes"].add(r.commune)
        if r.village:
            b["villages"].add(r.village)
        if r.annee_rehabilitation:
            b["annees"].add(r.annee_rehabilitation)

    items = [
        {
            "brigade_name": b["brigade_name"],
            "manager_name": b["manager_name"],
            "manager_phone": b["manager_phone"],
            "fiches": b["fiches"],
            "superficie_totale": round(b["superficie_totale"], 2),
            "nb_departements": len(b["departements"]),
            "nb_communes": len(b["communes"]),
            "nb_villages": len(b["villages"]),
            "departements": sorted(b["departements"]),
            "communes": sorted(b["communes"]),
            "villages": sorted(b["villages"]),
            "annees": sorted(b["annees"]),
        }
        for b in brigades.values()
    ]

    return {"items": items, "total": len(items)}



# ─── Audit superficies ────────────────────────────────────────────────────────

AUDIT_CLASSES = [
    ("S < 1 ha",        None,  1.0),
    ("1 ≤ S < 2 ha",    1.0,   2.0),
    ("2 ≤ S < 3 ha",    2.0,   3.0),
    ("3 ≤ S < 5 ha",    3.0,   5.0),
    ("5 ≤ S < 10 ha",   5.0,  10.0),
    ("10 ≤ S < 20 ha", 10.0,  20.0),
    ("20 ≤ S ≤ 30 ha", 20.0,  30.0),
    ("S > 30 ha",      30.0,  None),
]


def _audit_class(superficie: float) -> str:
    """Retourne le label de classe d'audit pour une superficie donnée."""
    for label, low, high in AUDIT_CLASSES:
        above = (low is None) or (superficie >= low)
        below = (high is None) or (superficie < high) or (high == 30.0 and superficie <= 30.0)
        if above and below:
            return label
    return "S > 30 ha"


def get_audit_sample(
    db: Session, brigade_names: Optional[list[str]] = None
) -> dict:
    """Génère un plan d'échantillonnage aléatoire pour l'audit des superficies.

    Contraintes :
    - Au moins 20 % de la superficie de CHAQUE brigade est couverte.
    - La superficie totale sélectionnée >= 25 % de la superficie totale du système.
    - Toutes les classes présentes sont représentées.
    """
    import random
    import math

    query = db.query(Rehabilitation).filter(
        Rehabilitation.superficie_rehabilitee.isnot(None),
        Rehabilitation.superficie_rehabilitee > 0,
    )
    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    rows = query.all()

    if not rows:
        return {
            "fiches": [],
            "fiches_hors_echantillon": [],
            "total_fiches": 0,
            "superficie_echantillon": 0.0,
            "superficie_totale": 0.0,
            "pourcentage_couverture": 0.0,
            "par_classe": [],
            "par_brigade": [],
        }

    superficie_totale = sum(float(r.superficie_rehabilitee) for r in rows)
    seuil_global = superficie_totale * 0.25

    # Regrouper par brigade
    par_brigade_fiches: dict[str, list] = {}
    for r in rows:
        brigade = r.brigade_name or "— Sans brigade —"
        par_brigade_fiches.setdefault(brigade, []).append(r)

    selected_ids: set[int] = set()
    selected: list = []

    # Pour chaque brigade : selectionner au moins 20% du NOMBRE de fiches de la brigade
    for brigade, fiches_brigade in par_brigade_fiches.items():
        nb_brigade = len(fiches_brigade)
        seuil_brigade = max(1, math.ceil(nb_brigade * 0.20))
        shuffled = fiches_brigade.copy()
        random.shuffle(shuffled)
        nb_sel = 0
        for fiche in shuffled:
            if fiche.id not in selected_ids:
                selected_ids.add(fiche.id)
                selected.append(fiche)
                nb_sel += 1
                if nb_sel >= seuil_brigade:
                    break

    # Completer si le global n'atteint pas 25%
    superficie_echantillon = sum(float(r.superficie_rehabilitee) for r in selected)
    if superficie_echantillon < seuil_global:
        remaining = sorted(
            [r for r in rows if r.id not in selected_ids],
            key=lambda r: float(r.superficie_rehabilitee),
            reverse=True,
        )
        for fiche in remaining:
            if superficie_echantillon >= seuil_global:
                break
            selected_ids.add(fiche.id)
            selected.append(fiche)
            superficie_echantillon += float(fiche.superficie_rehabilitee)

    # Fiches hors echantillon
    hors_echantillon = [r for r in rows if r.id not in selected_ids]

    # Synthese par classe
    classe_map: dict[str, dict] = {}
    for label, _, _ in AUDIT_CLASSES:
        classe_map[label] = {"classe": label, "fiches": 0, "superficie": 0.0, "brigades": set()}
    for r in selected:
        cls = _audit_class(float(r.superficie_rehabilitee))
        classe_map[cls]["fiches"] += 1
        classe_map[cls]["superficie"] += float(r.superficie_rehabilitee)
        if r.brigade_name:
            classe_map[cls]["brigades"].add(r.brigade_name)
    par_classe = [
        {"classe": v["classe"], "fiches": v["fiches"], "superficie": round(v["superficie"], 2), "nb_brigades": len(v["brigades"])}
        for v in classe_map.values() if v["fiches"] > 0
    ]

    # Synthese par brigade
    par_brigade_synth = []
    for brigade, fiches_brigade in par_brigade_fiches.items():
        sup_b = sum(float(r.superficie_rehabilitee) for r in fiches_brigade)
        sel_b = [r for r in fiches_brigade if r.id in selected_ids]
        sup_sel_b = sum(float(r.superficie_rehabilitee) for r in sel_b)
        nb_total = len(fiches_brigade)
        nb_sel_b = len(sel_b)
        par_brigade_synth.append({
            "brigade": brigade,
            "total_fiches": nb_total,
            "fiches_echantillon": nb_sel_b,
            "pourcentage_fiches": round((nb_sel_b / nb_total * 100) if nb_total else 0, 1),
            "superficie_brigade": round(sup_b, 2),
            "superficie_echantillon": round(sup_sel_b, 2),
            "pourcentage_superficie": round((sup_sel_b / sup_b * 100) if sup_b else 0, 1),
        })
    par_brigade_synth.sort(key=lambda x: x["brigade"])

    superficie_echantillon = round(sum(float(r.superficie_rehabilitee) for r in selected), 2)
    pourcentage = round((superficie_echantillon / superficie_totale * 100) if superficie_totale else 0, 2)

    return {
        "fiches": selected,
        "fiches_hors_echantillon": hors_echantillon,
        "total_fiches": len(selected),
        "superficie_echantillon": superficie_echantillon,
        "superficie_totale": round(superficie_totale, 2),
        "pourcentage_couverture": pourcentage,
        "par_classe": par_classe,
        "par_brigade": par_brigade_synth,
    }


def get_departements(
    db: Session,
    q: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
) -> dict:
    """Liste des départements avec agrégats : fiches, superficie, communes, villages, brigades, années."""
    query = db.query(Rehabilitation).filter(
        Rehabilitation.departement.isnot(None),
        Rehabilitation.departement != "",
    )
    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    if q:
        like = f"%{q}%"
        query = query.filter(Rehabilitation.departement.ilike(like))

    rows = query.order_by(func.lower(Rehabilitation.departement)).all()

    depts: dict[str, dict] = {}
    for r in rows:
        key = r.departement
        if key not in depts:
            depts[key] = {
                "departement": key,
                "fiches": 0,
                "superficie_totale": 0.0,
                "communes": set(),
                "arrondissements": set(),
                "villages": set(),
                "brigades": set(),
                "annees": set(),
            }
        d = depts[key]
        d["fiches"] += 1
        if r.superficie_rehabilitee is not None:
            d["superficie_totale"] += float(r.superficie_rehabilitee)
        if r.commune:
            d["communes"].add(r.commune)
        if r.arrondissement:
            d["arrondissements"].add(r.arrondissement)
        if r.village:
            d["villages"].add(r.village)
        if r.brigade_name:
            d["brigades"].add(r.brigade_name)
        if r.annee_rehabilitation:
            d["annees"].add(r.annee_rehabilitation)

    items = [
        {
            "departement": d["departement"],
            "fiches": d["fiches"],
            "superficie_totale": round(d["superficie_totale"], 2),
            "nb_communes": len(d["communes"]),
            "nb_arrondissements": len(d["arrondissements"]),
            "nb_villages": len(d["villages"]),
            "communes": sorted(d["communes"]),
            "brigades": sorted(d["brigades"]),
            "annees": sorted(d["annees"]),
        }
        for d in depts.values()
    ]

    return {"items": items, "total": len(items)}


def get_producers(
    db: Session,
    q: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
) -> dict:
    """Liste des producteurs distincts, regroupés par nom.

    Chaque entrée contient le téléphone, le nombre de fiches, la superficie
    totale, ainsi que les communes, villages et brigades associés.
    Un filtre optionnel ``q`` permet une recherche par nom ou téléphone.
    """
    from sqlalchemy import String

    query = (
        db.query(Rehabilitation)
        .filter(
            Rehabilitation.producer_name.isnot(None),
            Rehabilitation.producer_name != "",
        )
    )

    if brigade_names is not None:
        query = query.filter(_brigade_scope_condition(brigade_names))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Rehabilitation.producer_name.ilike(like),
                Rehabilitation.producer_phone.ilike(like),
                Rehabilitation.commune.ilike(like),
                Rehabilitation.village.ilike(like),
            )
        )

    rows = query.order_by(func.lower(Rehabilitation.producer_name)).all()

    # Regroupe par (producer_name, producer_phone)
    producers: dict[tuple, dict] = {}
    for r in rows:
        key = (r.producer_name, r.producer_phone or "")
        if key not in producers:
            producers[key] = {
                "producer_name": r.producer_name,
                "producer_phone": r.producer_phone or None,
                "fiches": 0,
                "superficie_totale": 0.0,
                "communes": set(),
                "villages": set(),
                "brigades": set(),
            }
        p = producers[key]
        p["fiches"] += 1
        if r.superficie_rehabilitee is not None:
            p["superficie_totale"] += float(r.superficie_rehabilitee)
        if r.commune:
            p["communes"].add(r.commune)
        if r.village:
            p["villages"].add(r.village)
        if r.brigade_name:
            p["brigades"].add(r.brigade_name)

    items = [
        {
            **{k: v for k, v in p.items() if k not in ("communes", "villages", "brigades")},
            "superficie_totale": round(p["superficie_totale"], 2),
            "communes": sorted(p["communes"]),
            "villages": sorted(p["villages"]),
            "brigades": sorted(p["brigades"]),
        }
        for p in producers.values()
    ]

    return {"items": items, "total": len(items)}


def get_stats(db: Session, brigade_names: Optional[list[str]] = None):
    """Statistiques globales, restreintes au périmètre de brigades autorisé."""
    def scoped(query):
        if brigade_names is not None:
            query = query.filter(_brigade_scope_condition(brigade_names))
        return query

    total_fiches = scoped(db.query(func.count(Rehabilitation.id))).scalar() or 0
    superficie_totale = float(
        scoped(db.query(func.coalesce(func.sum(Rehabilitation.superficie_rehabilitee), 0))).scalar() or 0
    )
    total_departements = scoped(
        db.query(func.count(func.distinct(Rehabilitation.departement)))
    ).scalar() or 0
    total_communes = scoped(
        db.query(func.count(func.distinct(Rehabilitation.commune)))
    ).scalar() or 0
    total_villages = scoped(
        db.query(func.count(func.distinct(Rehabilitation.village)))
    ).scalar() or 0
    total_brigades = (
        scoped(db.query(func.count(func.distinct(Rehabilitation.brigade_name))))
        .filter(Rehabilitation.brigade_name.isnot(None), Rehabilitation.brigade_name != "")
        .scalar()
        or 0
    )

    par_departement = [
        {"departement": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in scoped(
            db.query(
                Rehabilitation.departement,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.departement)
            .order_by(Rehabilitation.departement)
        ).all()
    ]

    par_annee = [
        {"annee": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in scoped(
            db.query(
                Rehabilitation.annee_rehabilitation,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.annee_rehabilitation)
            .order_by(Rehabilitation.annee_rehabilitation)
        ).all()
    ]

    par_sup_class = [
        {"supClass": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in scoped(
            db.query(
                Rehabilitation.sup_class,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.sup_class)
        ).all()
    ]

    par_brigade = [
        {"brigade": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in scoped(
            db.query(
                Rehabilitation.brigade_name,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .filter(
                Rehabilitation.brigade_name.isnot(None),
                Rehabilitation.brigade_name != "",
            )
            .group_by(Rehabilitation.brigade_name)
            .order_by(func.count(Rehabilitation.id).desc())
        ).all()
    ]

    return {
        "totalFiches": total_fiches,
        "superficieTotale": superficie_totale,
        "totalDepartements": total_departements,
        "totalCommunes": total_communes,
        "totalVillages": total_villages,
        "totalBrigades": total_brigades,
        "parDepartement": par_departement,
        "parAnnee": par_annee,
        "parSupClass": par_sup_class,
        "parBrigade": par_brigade,
    }


def get_all_for_export(
    db: Session,
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
):
    query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
        brigade_names=brigade_names,
    )
    return query.order_by(Rehabilitation.id).all()


def get_all_incomplete_for_export(
    db: Session,
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    brigade_names: Optional[list[str]] = None,
):
    return _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
        brigade_names=brigade_names,
    ).filter(incomplete_condition()).order_by(Rehabilitation.id).all()


def create_saved_audit_suggestion(
    db: Session,
    *,
    user: User,
    title: str,
    snapshot: dict,
    brigade_filter: Optional[list[str]] = None,
) -> SavedAuditSuggestion:
    row = SavedAuditSuggestion(
        title=title,
        created_by_id=user.id,
        brigade_filter=brigade_filter or None,
        snapshot=snapshot,
        nb_fiches_echantillon=len(snapshot.get("fiches") or []),
        superficie_echantillon=snapshot.get("superficie_echantillon"),
        pourcentage_couverture=snapshot.get("pourcentage_couverture"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_saved_audit_suggestions(db: Session) -> list[SavedAuditSuggestion]:
    from sqlalchemy.orm import joinedload

    return (
        db.query(SavedAuditSuggestion)
        .options(joinedload(SavedAuditSuggestion.created_by))
        .order_by(SavedAuditSuggestion.created_at.desc())
        .all()
    )


def get_saved_audit_suggestion(db: Session, suggestion_id: int) -> Optional[SavedAuditSuggestion]:
    from sqlalchemy.orm import joinedload

    return (
        db.query(SavedAuditSuggestion)
        .options(joinedload(SavedAuditSuggestion.created_by))
        .filter(SavedAuditSuggestion.id == suggestion_id)
        .first()
    )


def delete_saved_audit_suggestion(db: Session, suggestion_id: int) -> bool:
    row = get_saved_audit_suggestion(db, suggestion_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def audit_snapshot_to_export_result(snapshot: dict) -> dict:
    """Convertit un snapshot JSON en structure compatible avec l'export Excel audit."""

    class _Row:
        def __init__(self, data: dict):
            self._data = data

        def __getattr__(self, name):
            return self._data.get(name)

    fiches = [_Row(f) for f in snapshot.get("fiches") or []]
    hors = [_Row(f) for f in snapshot.get("fiches_hors_echantillon") or []]
    return {
        "fiches": fiches,
        "fiches_hors_echantillon": hors,
        "par_brigade": snapshot.get("par_brigade") or [],
        "superficie_echantillon": snapshot.get("superficie_echantillon") or 0,
        "pourcentage_couverture": snapshot.get("pourcentage_couverture") or 0,
    }

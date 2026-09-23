from decimal import Decimal
from typing import Optional

from sqlalchemy import or_, func, asc, desc
from sqlalchemy.orm import Session

from app.models import Rehabilitation
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

SUP_CLASSES = ["S ≤ 5 ha", "5 < S ≤ 10 ha", "10 < S ≤ 20 ha", "S > 20 ha"]


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
):
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
):
    base_query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
    )

    total = base_query.count()

    superficie_totale = (
        _apply_filters(
            db.query(func.coalesce(func.sum(Rehabilitation.superficie_rehabilitee), 0)),
            q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
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
):
    """Liste paginée des fiches ayant au moins une donnée métier manquante."""
    base_query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
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


def get_filters(db: Session):
    def distinct_values(column):
        rows = (
            db.query(column)
            .filter(column.isnot(None), column != "")
            .distinct()
            .order_by(column)
            .all()
        )
        return [r[0] for r in rows]

    annees = [
        r[0]
        for r in db.query(Rehabilitation.annee_rehabilitation)
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


def get_brigades(db: Session) -> list[dict]:
    """Liste des brigades disponibles, regroupées par nom.

    Pour des raisons historiques de conflit, une même brigade peut être
    enregistrée plusieurs fois dans `rehabilitations` (clés primaires
    différentes). Regrouper par ``brigade_name`` garantit qu'un nom ne
    s'affiche qu'une seule fois, accompagné de son nombre de fiches.
    """
    rows = (
        db.query(
            Rehabilitation.brigade_name,
            func.count(Rehabilitation.id),
        )
        .filter(Rehabilitation.brigade_name.isnot(None), Rehabilitation.brigade_name != "")
        .group_by(Rehabilitation.brigade_name)
        .order_by(func.lower(Rehabilitation.brigade_name))
        .all()
    )
    return [{"name": name, "fiches": count} for name, count in rows]


def get_producers(db: Session, q: Optional[str] = None) -> dict:
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


def get_stats(db: Session):
    total_fiches = db.query(func.count(Rehabilitation.id)).scalar() or 0
    superficie_totale = float(
        db.query(func.coalesce(func.sum(Rehabilitation.superficie_rehabilitee), 0)).scalar() or 0
    )
    total_departements = db.query(func.count(func.distinct(Rehabilitation.departement))).scalar() or 0
    total_communes = db.query(func.count(func.distinct(Rehabilitation.commune))).scalar() or 0
    total_villages = db.query(func.count(func.distinct(Rehabilitation.village))).scalar() or 0
    total_brigades = (
        db.query(func.count(func.distinct(Rehabilitation.brigade_name)))
        .filter(Rehabilitation.brigade_name.isnot(None), Rehabilitation.brigade_name != "")
        .scalar()
        or 0
    )

    par_departement = [
        {"departement": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in (
            db.query(
                Rehabilitation.departement,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.departement)
            .order_by(Rehabilitation.departement)
            .all()
        )
    ]

    par_annee = [
        {"annee": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in (
            db.query(
                Rehabilitation.annee_rehabilitation,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.annee_rehabilitation)
            .order_by(Rehabilitation.annee_rehabilitation)
            .all()
        )
    ]

    par_sup_class = [
        {"supClass": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in (
            db.query(
                Rehabilitation.sup_class,
                func.count(Rehabilitation.id),
                func.sum(Rehabilitation.superficie_rehabilitee),
            )
            .group_by(Rehabilitation.sup_class)
            .all()
        )
    ]

    par_brigade = [
        {"brigade": row[0], "fiches": row[1], "superficie": float(row[2] or 0)}
        for row in (
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
            .all()
        )
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
):
    query = _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
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
):
    return _apply_filters(
        db.query(Rehabilitation),
        q, departement, commune, arrondissement, village, brigade_name, annee, sup_class,
    ).filter(incomplete_condition()).order_by(Rehabilitation.id).all()

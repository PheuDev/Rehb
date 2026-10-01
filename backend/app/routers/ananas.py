"""API dédiée au système Ananas : import strict, fiches et échantillonnage."""

import io
import math
import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import ananas_excel
from app.dependencies import get_db, require_active, require_admin
from app.models import AnanasPlantation, SavedAnanasAuditSuggestion, User


router = APIRouter(prefix="/api/ananas", tags=["Système Ananas"])
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
SAMPLE_AREA_FIELD = "superficie_confirmee"
CLASS_SAMPLE_PERCENT = 30.0
FRICHE_SAMPLE_PERCENT = 30.0
SAMPLE_TARGET_PERCENT = 40.0
SORTABLE_FIELDS = {
    "numero": AnanasPlantation.numero,
    "nom_prenoms": AnanasPlantation.nom_prenoms,
    "commune": AnanasPlantation.commune,
    "arrondissement": AnanasPlantation.arrondissement,
    "superficie_confirmee": AnanasPlantation.superficie_confirmee,
}


class AnanasUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    numero: Optional[int] = Field(None, ge=0)
    nom_prenoms: Optional[str] = Field(None, max_length=255)
    sexe: Optional[str] = Field(None, max_length=30)
    commune: Optional[str] = Field(None, max_length=180)
    arrondissement: Optional[str] = Field(None, max_length=180)
    village_hameau: Optional[str] = Field(None, max_length=180)
    coord_x: Optional[Decimal] = Field(None, ge=0)
    coord_y: Optional[Decimal] = Field(None, ge=0)
    superficie_declaree: Optional[Decimal] = Field(None, ge=0)
    superficie_trackee: Optional[Decimal] = Field(None, ge=0)
    type_friche: Optional[str] = Field(None, max_length=180)
    type_espece_vegetale: Optional[str] = Field(None, max_length=180)
    type_sol: Optional[str] = Field(None, max_length=180)
    precedents_culturaux: Optional[str] = None
    decision_equipe_validation: Optional[str] = Field(None, max_length=180)
    decision_atda7: Optional[str] = Field(None, max_length=180)
    superficie_confirmee: Optional[Decimal] = Field(None, ge=0)


class SaveSuggestionPayload(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    snapshot: dict[str, Any]


def _decimal_float(value: Any) -> Optional[float]:
    return float(value) if value is not None else None


def _class_for_area(value: Optional[Decimal]) -> Optional[str]:
    if value is None or value < 0:
        return None
    if value < Decimal("5"):
        return "Classe 1 · 0 à 4,9 ha"
    if value < Decimal("10"):
        return "Classe 2 · 5 à 9,9 ha"
    return "Classe 3 · 10 ha et plus"


def _plantation_out(item: AnanasPlantation) -> dict[str, Any]:
    result = {
        "id": item.id,
        "numero": item.numero,
        "nom_prenoms": item.nom_prenoms,
        "sexe": item.sexe,
        "commune": item.commune,
        "arrondissement": item.arrondissement,
        "village_hameau": item.village_hameau,
        "coord_x": _decimal_float(item.coord_x),
        "coord_y": _decimal_float(item.coord_y),
        "superficie_declaree": _decimal_float(item.superficie_declaree),
        "superficie_trackee": _decimal_float(item.superficie_trackee),
        "type_friche": item.type_friche,
        "type_espece_vegetale": item.type_espece_vegetale,
        "type_sol": item.type_sol,
        "precedents_culturaux": item.precedents_culturaux,
        "decision_equipe_validation": item.decision_equipe_validation,
        "decision_atda7": item.decision_atda7,
        "superficie_confirmee": _decimal_float(item.superficie_confirmee),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }
    result["classe_superficie"] = _class_for_area(item.superficie_confirmee)
    return result


def _workbook_response(workbook, filename: str) -> StreamingResponse:
    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _query_items(
    db: Session,
    q: Optional[str],
    commune: Optional[str],
    arrondissement: Optional[str],
    classe: Optional[int],
):
    query = db.query(AnanasPlantation)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            AnanasPlantation.nom_prenoms.ilike(term),
            AnanasPlantation.commune.ilike(term),
            AnanasPlantation.arrondissement.ilike(term),
            AnanasPlantation.village_hameau.ilike(term),
            AnanasPlantation.type_espece_vegetale.ilike(term),
        ))
    if commune:
        query = query.filter(AnanasPlantation.commune == commune)
    if arrondissement:
        query = query.filter(AnanasPlantation.arrondissement == arrondissement)
    if classe is not None:
        if classe not in (1, 2, 3):
            raise HTTPException(status_code=400, detail="La classe doit être 1, 2 ou 3.")
        low, high = {
            1: (Decimal("0"), Decimal("5")),
            2: (Decimal("5"), Decimal("10")),
            3: (Decimal("10"), None),
        }[classe]
        query = query.filter(AnanasPlantation.superficie_confirmee >= low)
        if high is not None:
            query = query.filter(AnanasPlantation.superficie_confirmee < high)
    return query


def _generate_sample(db: Session) -> dict[str, Any]:
    rows = db.query(AnanasPlantation).order_by(AnanasPlantation.id.asc()).all()
    known_area = [row for row in rows if row.superficie_confirmee is not None]
    eligible = [row for row in known_area if row.arrondissement and row.arrondissement.strip()]
    no_area = [row for row in rows if row.superficie_confirmee is None]
    no_arrondissement = [row for row in known_area if not row.arrondissement or not row.arrondissement.strip()]
    if not known_area:
        raise HTTPException(
            status_code=400,
            detail="Aucune plantation n'a de superficie attribuée / confirmée pour l'échantillonnage.",
        )
    if not eligible:
        raise HTTPException(
            status_code=409,
            detail="Les superficies sont renseignées, mais aucun arrondissement n'est disponible pour stratifier l'échantillon.",
        )

    randomizer = random.SystemRandom()
    strata: dict[tuple[str, str], list[AnanasPlantation]] = {}
    classes: dict[str, list[AnanasPlantation]] = {}
    friches: dict[str, list[AnanasPlantation]] = {}
    friche_labels: dict[str, str] = {}
    for row in eligible:
        cls = _class_for_area(row.superficie_confirmee)
        if cls:
            classes.setdefault(cls, []).append(row)
        if row.type_friche and row.type_friche.strip():
            friche_label = row.type_friche.strip()
            friche_key = friche_label.casefold()
            friches.setdefault(friche_key, []).append(row)
            friche_labels.setdefault(friche_key, friche_label)
    for row in eligible:
        cls = _class_for_area(row.superficie_confirmee)
        if not cls:
            continue
        arrondissement = row.arrondissement.strip().casefold()
        strata.setdefault((arrondissement, cls), []).append(row)

    selected: dict[int, AnanasPlantation] = {}
    for candidates in strata.values():
        chosen = randomizer.choice(candidates)
        selected[chosen.id] = chosen

    # Garantit les quotas de fiches de chaque classe et de chaque type de friche.
    class_targets = {
        cls: math.ceil(len(population) * CLASS_SAMPLE_PERCENT / 100)
        for cls, population in classes.items()
    }
    friche_targets = {
        key: math.ceil(len(population) * FRICHE_SAMPLE_PERCENT / 100)
        for key, population in friches.items()
    }
    selected_by_class = {
        cls: sum(1 for row in selected.values() if _class_for_area(row.superficie_confirmee) == cls)
        for cls in classes
    }
    selected_by_friche = {
        key: sum(1 for row in selected.values() if row.type_friche and row.type_friche.strip().casefold() == key)
        for key in friches
    }
    quota_candidates = [row for row in eligible if row.id not in selected]
    while True:
        best: list[AnanasPlantation] = []
        best_score = 0
        for row in quota_candidates:
            cls = _class_for_area(row.superficie_confirmee)
            friche_key = row.type_friche.strip().casefold() if row.type_friche and row.type_friche.strip() else None
            score = int(cls in class_targets and selected_by_class[cls] < class_targets[cls])
            score += int(friche_key in friche_targets and selected_by_friche[friche_key] < friche_targets[friche_key])
            if score > best_score:
                best = [row]
                best_score = score
            elif score and score == best_score:
                best.append(row)
        if not best_score:
            break
        chosen = randomizer.choice(best)
        selected[chosen.id] = chosen
        quota_candidates.remove(chosen)
        cls = _class_for_area(chosen.superficie_confirmee)
        if cls in selected_by_class:
            selected_by_class[cls] += 1
        friche_key = chosen.type_friche.strip().casefold() if chosen.type_friche and chosen.type_friche.strip() else None
        if friche_key in selected_by_friche:
            selected_by_friche[friche_key] += 1

    total_area = sum((row.superficie_confirmee or Decimal("0") for row in known_area), Decimal("0"))
    selected_area = sum((row.superficie_confirmee or Decimal("0") for row in selected.values()), Decimal("0"))
    target_area = total_area * Decimal(str(SAMPLE_TARGET_PERCENT / 100))
    remaining = [row for row in quota_candidates if row.id not in selected]
    randomizer.shuffle(remaining)
    for row in remaining:
        if selected_area >= target_area:
            break
        selected[row.id] = row
        selected_area += row.superficie_confirmee or Decimal("0")

    if selected_area < target_area:
        raise HTTPException(
            status_code=409,
            detail=(
                f"La cible de superficie de {SAMPLE_TARGET_PERCENT:g} % ne peut pas être atteinte tant que des plantations "
                "avec superficie confirmée n'ont pas d'arrondissement renseigné. "
                f"{len(no_arrondissement)} fiche(s) à compléter."
            ),
        )

    sample_items = sorted(selected.values(), key=lambda row: (row.arrondissement or "", row.numero, row.id))
    hors_items = sorted(
        (row for row in eligible if row.id not in selected),
        key=lambda row: (row.arrondissement or "", row.numero, row.id),
    )
    coverage = float(selected_area / total_area * 100) if total_area > 0 else 0.0

    class_summary = []
    for cls in ("Classe 1 · 0 à 4,9 ha", "Classe 2 · 5 à 9,9 ha", "Classe 3 · 10 ha et plus"):
        population = classes.get(cls, [])
        sampled = [item for item in population if item.id in selected]
        class_summary.append({
            "classe": cls,
            "plantations_total": len(population),
            "plantations_echantillon": len(sampled),
            "minimum_requis": class_targets.get(cls, 0),
            "pourcentage_cible": CLASS_SAMPLE_PERCENT,
            "superficie_totale": float(sum((item.superficie_confirmee or Decimal("0") for item in population), Decimal("0"))),
            "superficie_echantillon": float(sum((item.superficie_confirmee or Decimal("0") for item in sampled), Decimal("0"))),
        })

    friche_summary = []
    for key, population in sorted(friches.items(), key=lambda item: friche_labels[item[0]].casefold()):
        sampled_count = sum(1 for item in population if item.id in selected)
        friche_summary.append({
            "type_friche": friche_labels[key],
            "plantations_total": len(population),
            "plantations_echantillon": sampled_count,
            "minimum_requis": friche_targets[key],
            "pourcentage_cible": FRICHE_SAMPLE_PERCENT,
        })

    strata_summary = []
    for (arr_key, cls), population in sorted(strata.items()):
        arr_name = next((row.arrondissement.strip() for row in population if row.arrondissement and row.arrondissement.strip()), "Arrondissement non renseigné")
        chosen_count = sum(1 for row in population if row.id in selected)
        strata_summary.append({
            "arrondissement": arr_name,
            "classe": cls,
            "plantations_total": len(population),
            "plantations_echantillon": chosen_count,
        })

    return {
        "fiches": [_plantation_out(row) for row in sample_items],
        "fiches_hors_echantillon": [_plantation_out(row) for row in hors_items],
        "fiches_sans_superficie_confirmee": [_plantation_out(row) for row in no_area],
        "fiches_sans_arrondissement": [_plantation_out(row) for row in no_arrondissement],
        "total_fiches": len(rows),
        "total_fiches_eligibles": len(eligible),
        "superficie_totale": float(total_area),
        "superficie_echantillon": float(selected_area),
        "pourcentage_couverture": round(coverage, 2),
        "pourcentage_cible": SAMPLE_TARGET_PERCENT,
        "pourcentage_cible_par_classe": CLASS_SAMPLE_PERCENT,
        "pourcentage_cible_par_type_friche": FRICHE_SAMPLE_PERCENT,
        "base_superficie": "Superficie attribuée / confirmée (ha)",
        "par_classe": class_summary,
        "par_type_friche": friche_summary,
        "par_arrondissement_et_classe": strata_summary,
    }


@router.get("/plantations")
def list_plantations(
    q: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    classe: Optional[int] = Query(None, ge=1, le=3),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    sort_by: str = Query("numero"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if sort_by not in SORTABLE_FIELDS:
        raise HTTPException(status_code=400, detail="Champ de tri invalide.")
    query = _query_items(db, q, commune, arrondissement, classe)
    total = query.count()
    column = SORTABLE_FIELDS[sort_by]
    query = query.order_by(column.desc() if sort_order == "desc" else column.asc(), AnanasPlantation.id.asc())
    items = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [_plantation_out(item) for item in items],
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
    }


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    rows = db.query(AnanasPlantation).all()
    area = sum((row.superficie_confirmee or Decimal("0") for row in rows), Decimal("0"))
    classes = {1: 0, 2: 0, 3: 0}
    for row in rows:
        cls = _class_for_area(row.superficie_confirmee)
        if cls:
            classes[1 if row.superficie_confirmee < 5 else 2 if row.superficie_confirmee < 10 else 3] += 1
    return {
        "total_plantations": len(rows),
        "superficie_confirmee_totale": float(area),
        "sans_superficie_confirmee": sum(1 for row in rows if row.superficie_confirmee is None),
        "sans_arrondissement": sum(1 for row in rows if not row.arrondissement or not row.arrondissement.strip()),
        "par_classe": classes,
    }


@router.get("/filters")
def get_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    rows = db.query(AnanasPlantation.commune, AnanasPlantation.arrondissement).distinct().all()
    return {
        "communes": sorted({commune for commune, _ in rows if commune}, key=str.casefold),
        "arrondissements": sorted({arr for _, arr in rows if arr}, key=str.casefold),
    }


@router.get("/import-template")
def download_template(current_user: User = Depends(require_active)):
    return _workbook_response(ananas_excel.build_template_workbook(), "modele_import_ananas.xlsx")


@router.post("/import-excel")
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith((".xls", ".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format Excel (.xls, .xlsx ou .xlsm).")
    try:
        rows, errors = ananas_excel.parse_import_workbook(await file.read())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if rows:
        try:
            db.bulk_insert_mappings(AnanasPlantation, rows)
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=400, detail="L'import a échoué ; aucune ligne de ce fichier n'a été ajoutée.") from exc
    return {
        "total": len(rows) + len(errors),
        "importees": len(rows),
        "erreurs": errors,
    }


@router.delete("/database")
def clear_ananas_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Supprime uniquement les fiches et suggestions propres au système Ananas."""
    try:
        suggestions_deleted = db.query(SavedAnanasAuditSuggestion).delete(synchronize_session=False)
        plantations_deleted = db.query(AnanasPlantation).delete(synchronize_session=False)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Impossible de vider les données Ananas.") from exc
    return {
        "plantations_supprimees": plantations_deleted,
        "suggestions_supprimees": suggestions_deleted,
    }


@router.get("/export-excel")
def export_plantations(
    q: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    classe: Optional[int] = Query(None, ge=1, le=3),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    rows = _query_items(db, q, commune, arrondissement, classe).order_by(AnanasPlantation.numero, AnanasPlantation.id).all()
    return _workbook_response(
        ananas_excel.build_data_workbook([("Plantations", [_plantation_out(row) for row in rows])]),
        "plantations_ananas.xlsx",
    )


@router.get("/plantations/{plantation_id}")
def get_plantation(
    plantation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    item = db.query(AnanasPlantation).filter(AnanasPlantation.id == plantation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plantation Ananas introuvable.")
    return _plantation_out(item)


@router.patch("/plantations/{plantation_id}")
def update_plantation(
    plantation_id: int,
    payload: AnanasUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    item = db.query(AnanasPlantation).filter(AnanasPlantation.id == plantation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plantation Ananas introuvable.")
    changes = payload.model_dump(exclude_unset=True)
    if "numero" in changes and changes["numero"] is None:
        raise HTTPException(status_code=400, detail="Le champ « N » est obligatoire.")
    for coordinate in ("coord_x", "coord_y"):
        value = changes.get(coordinate)
        if value is not None and value != value.to_integral_value():
            raise HTTPException(status_code=400, detail=f"Le champ « {coordinate} » doit être un nombre entier.")
    for field, value in changes.items():
        setattr(item, field, value)
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _plantation_out(item)


@router.delete("/plantations/{plantation_id}")
def delete_plantation(
    plantation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    item = db.query(AnanasPlantation).filter(AnanasPlantation.id == plantation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plantation Ananas introuvable.")
    db.delete(item)
    db.commit()
    return {"deleted": True}


@router.get("/audit-sample")
def get_audit_sample(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    return _generate_sample(db)


@router.get("/audit-sample/export-excel")
def export_audit_sample(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    result = _generate_sample(db)
    sheets = [
        ("Échantillon", result["fiches"]),
        ("Hors échantillon", result["fiches_hors_echantillon"]),
    ]
    if result["fiches_sans_superficie_confirmee"]:
        sheets.append(("À compléter", result["fiches_sans_superficie_confirmee"]))
    if result["fiches_sans_arrondissement"]:
        sheets.append(("Sans arrondissement", result["fiches_sans_arrondissement"]))
    return _workbook_response(ananas_excel.build_data_workbook(sheets), "echantillon_ananas.xlsx")


@router.post("/audit-sample/export-excel")
def export_current_audit_sample(
    payload: SaveSuggestionPayload,
    current_user: User = Depends(require_active),
):
    """Exporte le résultat affiché sans relancer un nouveau tirage aléatoire."""
    snapshot = payload.snapshot
    if not isinstance(snapshot.get("fiches"), list):
        raise HTTPException(status_code=400, detail="La suggestion ne contient pas de liste d'échantillon valide.")
    sheets = [("Échantillon", snapshot.get("fiches", [])), ("Hors échantillon", snapshot.get("fiches_hors_echantillon", []))]
    if snapshot.get("fiches_sans_superficie_confirmee"):
        sheets.append(("À compléter", snapshot["fiches_sans_superficie_confirmee"]))
    if snapshot.get("fiches_sans_arrondissement"):
        sheets.append(("Sans arrondissement", snapshot["fiches_sans_arrondissement"]))
    return _workbook_response(ananas_excel.build_data_workbook(sheets), "echantillon_ananas.xlsx")


@router.post("/audit-suggestions", status_code=201)
def save_audit_suggestion(
    payload: SaveSuggestionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    sample = payload.snapshot.get("fiches")
    if not isinstance(sample, list):
        raise HTTPException(status_code=400, detail="La suggestion ne contient pas de liste d'échantillon valide.")
    title = (payload.title or "").strip() or f"Suggestion Ananas du {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    item = SavedAnanasAuditSuggestion(
        title=title,
        created_by_id=current_user.id,
        snapshot=payload.snapshot,
        nb_fiches_echantillon=len(sample),
        superficie_echantillon=payload.snapshot.get("superficie_echantillon", 0),
        pourcentage_couverture=payload.snapshot.get("pourcentage_couverture", 0),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "title": item.title, "created_at": item.created_at.isoformat() if item.created_at else None}


@router.get("/audit-suggestions")
def list_audit_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    items = db.query(SavedAnanasAuditSuggestion).order_by(SavedAnanasAuditSuggestion.created_at.desc()).all()
    return [{
        "id": item.id,
        "title": item.title,
        "nb_fiches_echantillon": item.nb_fiches_echantillon,
        "superficie_echantillon": _decimal_float(item.superficie_echantillon),
        "pourcentage_couverture": _decimal_float(item.pourcentage_couverture),
        "created_at": item.created_at.isoformat() if item.created_at else None,
    } for item in items]


@router.get("/audit-suggestions/{suggestion_id}")
def get_audit_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    item = db.query(SavedAnanasAuditSuggestion).filter(SavedAnanasAuditSuggestion.id == suggestion_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion Ananas introuvable.")
    return {"id": item.id, "title": item.title, "created_at": item.created_at.isoformat() if item.created_at else None, **item.snapshot}


@router.get("/audit-suggestions/{suggestion_id}/export-excel")
def export_saved_audit_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    item = db.query(SavedAnanasAuditSuggestion).filter(SavedAnanasAuditSuggestion.id == suggestion_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion Ananas introuvable.")
    snapshot = item.snapshot or {}
    sheets = [("Échantillon", snapshot.get("fiches", [])), ("Hors échantillon", snapshot.get("fiches_hors_echantillon", []))]
    if snapshot.get("fiches_sans_superficie_confirmee"):
        sheets.append(("À compléter", snapshot["fiches_sans_superficie_confirmee"]))
    if snapshot.get("fiches_sans_arrondissement"):
        sheets.append(("Sans arrondissement", snapshot["fiches_sans_arrondissement"]))
    filename = f"suggestion_ananas_{item.id}.xlsx"
    return _workbook_response(ananas_excel.build_data_workbook(sheets), filename)

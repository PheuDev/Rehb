import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud, excel_utils, schemas
from app.dependencies import get_db
from app.crud import SORTABLE_COLUMNS, SUP_CLASSES

router = APIRouter(prefix="/api/rehabilitations", tags=["Réhabilitations"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _workbook_response(workbook, filename: str) -> StreamingResponse:
    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# Liste paginée avec recherche / filtres / tri
# ---------------------------------------------------------------------------
@router.get("", response_model=schemas.RehabilitationListResponse)
def list_rehabilitations(
    q: Optional[str] = Query(None, description="Recherche plein texte"),
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = Query(None, description="Classe de superficie"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=200),
    sortBy: str = Query("created_at"),
    sortOrder: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    if sup_class is not None and sup_class not in SUP_CLASSES:
        raise HTTPException(status_code=400, detail="Classe de superficie invalide.")
    if sortBy not in SORTABLE_COLUMNS:
        raise HTTPException(status_code=400, detail="Champ de tri invalide.")

    items, pagination = crud.get_list(
        db,
        q=q,
        departement=departement,
        commune=commune,
        arrondissement=arrondissement,
        village=village,
        brigade_name=brigade_name,
        annee=annee,
        sup_class=sup_class,
        page=page,
        limit=limit,
        sort_by=sortBy,
        sort_order=sortOrder,
    )
    return {"items": items, "pagination": pagination}


# ---------------------------------------------------------------------------
# Valeurs distinctes pour les listes déroulantes de filtres
# ---------------------------------------------------------------------------
@router.get("/filters", response_model=schemas.FiltersResponse)
def get_filters(db: Session = Depends(get_db)):
    return crud.get_filters(db)


# ---------------------------------------------------------------------------
# Statistiques globales et agrégats
# ---------------------------------------------------------------------------
@router.get("/stats", response_model=schemas.StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    return crud.get_stats(db)


# ---------------------------------------------------------------------------
# Export CSV (respecte les filtres actifs)
# ---------------------------------------------------------------------------
@router.get("/export")
def export_csv(
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    db: Session = Depends(get_db),
):
    rows = crud.get_all_for_export(
        db, q, departement, commune, arrondissement, village, brigade_name, annee, sup_class
    )

    buffer = io.StringIO()
    buffer.write("\ufeff")  # BOM UTF-8 pour Excel
    writer = csv.writer(buffer, delimiter=";")

    headers = [
        "N°PDA", "Département", "Commune", "Arrondissement", "Village",
        "Année", "Superficie réhabilitée (ha)", "Classe de superficie",
        "Nom de la brigade", "Responsable brigade", "Téléphone responsable",
        "Producteur bénéficiaire", "Téléphone producteur",
        "Désherbage (ha)", "Opérateur désherbage", "Téléphone opérateur désherbage",
        "Éclaircie (ha)", "Opérateur éclaircie", "Téléphone opérateur éclaircie",
        "Élagage (ha)", "Opérateur élagage", "Téléphone opérateur élagage",
        "Débardage (ha)", "Opérateur débardage", "Téléphone opérateur débardage",
        "Observations",
    ]
    writer.writerow(headers)

    for r in rows:
        writer.writerow([
            r.pda_number, r.departement, r.commune, r.arrondissement, r.village,
            r.annee_rehabilitation, r.superficie_rehabilitee, r.sup_class,
            r.brigade_name or "", r.brigade_manager_name or "", r.brigade_manager_phone or "",
            r.producer_name or "", r.producer_phone or "",
            r.desherbage_superficie or "", r.desherbage_operateur_nom or "", r.desherbage_operateur_phone or "",
            r.eclaircie_superficie or "", r.eclaircie_operateur_nom or "", r.eclaircie_operateur_phone or "",
            r.elagage_superficie or "", r.elagage_operateur_nom or "", r.elagage_operateur_phone or "",
            r.debardage_superficie or "", r.debardage_operateur_nom or "", r.debardage_operateur_phone or "",
            r.observations or "",
        ])

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=rehabilitations.csv"},
    )


# ---------------------------------------------------------------------------
# Modèle Excel à télécharger (mêmes colonnes que le fichier source)
# ---------------------------------------------------------------------------
@router.get("/import-template")
def download_import_template():
    workbook = excel_utils.build_template_workbook()
    return _workbook_response(workbook, "modele_import_rehabilitations.xlsx")


# ---------------------------------------------------------------------------
# Export Excel (respecte les filtres actifs)
# ---------------------------------------------------------------------------
@router.get("/export-excel")
def export_excel(
    q: Optional[str] = None,
    departement: Optional[str] = None,
    commune: Optional[str] = None,
    arrondissement: Optional[str] = None,
    village: Optional[str] = None,
    brigade_name: Optional[str] = None,
    annee: Optional[int] = None,
    sup_class: Optional[str] = None,
    db: Session = Depends(get_db),
):
    rows = crud.get_all_for_export(
        db, q, departement, commune, arrondissement, village, brigade_name, annee, sup_class
    )
    workbook = excel_utils.build_export_workbook(rows)
    return _workbook_response(workbook, "rehabilitations.xlsx")


# ---------------------------------------------------------------------------
# Import Excel (structure identique au fichier source / au modèle téléchargeable)
# ---------------------------------------------------------------------------
@router.post("/import-excel", response_model=schemas.ImportResult)
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format Excel (.xlsx).")

    content = await file.read()
    try:
        valid_payloads, row_errors = excel_utils.parse_import_workbook(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - fichier corrompu, mauvais format, etc.
        raise HTTPException(status_code=400, detail=f"Impossible de lire le fichier Excel : {exc}") from exc

    imported = []
    if valid_payloads:
        try:
            imported = crud.bulk_create(db, valid_payloads)
        except Exception as exc:  # pragma: no cover
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Erreur lors de l'import : {exc}") from exc

    return {
        "total": len(valid_payloads) + len(row_errors),
        "importees": len(imported),
        "erreurs": row_errors,
    }


# ---------------------------------------------------------------------------
# Détail
# ---------------------------------------------------------------------------
@router.get("/{rehab_id}", response_model=schemas.RehabilitationOut)
def get_rehabilitation(rehab_id: int, db: Session = Depends(get_db)):
    obj = crud.get_by_id(db, rehab_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Fiche de réhabilitation introuvable.")
    return obj


# ---------------------------------------------------------------------------
# Création
# ---------------------------------------------------------------------------
@router.post("", response_model=schemas.RehabilitationOut, status_code=201)
def create_rehabilitation(payload: schemas.RehabilitationCreate, db: Session = Depends(get_db)):
    try:
        return crud.create(db, payload)
    except Exception as exc:  # pragma: no cover - erreurs DB génériques
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur lors de la création : {exc}") from exc


# ---------------------------------------------------------------------------
# Mise à jour
# ---------------------------------------------------------------------------
@router.put("/{rehab_id}", response_model=schemas.RehabilitationOut)
def update_rehabilitation(rehab_id: int, payload: schemas.RehabilitationUpdate, db: Session = Depends(get_db)):
    obj = crud.get_by_id(db, rehab_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Fiche de réhabilitation introuvable.")
    try:
        return crud.update(db, obj, payload)
    except Exception as exc:  # pragma: no cover
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur lors de la mise à jour : {exc}") from exc


# ---------------------------------------------------------------------------
# Suppression
# ---------------------------------------------------------------------------
# NB : la route statique "/all" (vidage) DOIT être déclarée AVANT la route
# dynamique "/{rehab_id}" : dans FastAPI, le routage se fait dans l'ordre de
# déclaration. Sinon "all" tente d'être converti en int et renvoie un 422.
@router.delete("/all")
def clear_rehabilitations(db: Session = Depends(get_db)):
    deleted = crud.clear_all(db)
    return {"deleted": deleted, "message": "Toutes les fiches ont été supprimées."}


@router.delete("/{rehab_id}")
def delete_rehabilitation(rehab_id: int, db: Session = Depends(get_db)):
    obj = crud.get_by_id(db, rehab_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Fiche de réhabilitation introuvable.")
    crud.delete(db, obj)
    return {"message": "Fiche supprimée avec succès."}


@router.post("/bulk-delete")
def delete_rehabilitations(payload: schemas.BulkDeleteRequest, db: Session = Depends(get_db)):
    ids = sorted(set(payload.ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Aucune fiche sélectionnée.")

    deleted = crud.delete_many(db, ids)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Aucune fiche sélectionnée n’a été trouvée.")

    return {"deleted": deleted, "message": f"{deleted} fiche(s) supprimée(s) avec succès."}

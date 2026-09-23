import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud, excel_utils, schemas
from app.completion import missing_fields
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


@router.get("/incomplete", response_model=schemas.RehabilitationIncompleteListResponse)
def list_incomplete_rehabilitations(
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
    """Retourne les fiches qui possèdent au moins une donnée à renseigner."""
    if sup_class is not None and sup_class not in SUP_CLASSES:
        raise HTTPException(status_code=400, detail="Classe de superficie invalide.")
    if sortBy not in SORTABLE_COLUMNS:
        raise HTTPException(status_code=400, detail="Champ de tri invalide.")

    items, pagination = crud.get_incomplete_list(
        db, q, departement, commune, arrondissement, village, brigade_name,
        annee, sup_class, page, limit, sortBy, sortOrder,
    )
    response_items = []
    for item in items:
        data = schemas.RehabilitationOut.model_validate(item).model_dump()
        data["missingFields"] = missing_fields(item)
        response_items.append(data)
    return {"items": response_items, "pagination": pagination}


# ---------------------------------------------------------------------------
# Valeurs distinctes pour les listes déroulantes de filtres
# ---------------------------------------------------------------------------
@router.get("/filters", response_model=schemas.FiltersResponse)
def get_filters(db: Session = Depends(get_db)):
    return crud.get_filters(db)


# ---------------------------------------------------------------------------
# Liste des brigades disponibles (regroupées par nom)
# ---------------------------------------------------------------------------
# NB : route statique, à déclarer avant la route dynamique "/{rehab_id}".
@router.get("/brigades", response_model=list[schemas.BrigadeOut])
def list_brigades(db: Session = Depends(get_db)):
    """Brigades distinctes regroupées par nom."""
    return crud.get_brigades(db)


@router.get("/brigades-detail", response_model=schemas.BrigadeDetailListResponse)
def list_brigades_detail(
    q: Optional[str] = Query(None, description="Recherche par nom, responsable, commune, village…"),
    db: Session = Depends(get_db),
):
    """Brigades avec toutes les informations agrégées (responsable, superficie, communes…)."""
    return crud.get_brigades_detail(db, q=q)


# ---------------------------------------------------------------------------
# Audit superficies — échantillonnage aléatoire
# ---------------------------------------------------------------------------
@router.get("/audit-sample", response_model=schemas.AuditSampleResponse)
def get_audit_sample(db: Session = Depends(get_db)):
    """Génère un plan d'échantillonnage aléatoire pour l'audit des superficies."""
    result = crud.get_audit_sample(db)

    # Enrichir chaque fiche avec sa classe d'audit
    fiches_out = []
    for r in result["fiches"]:
        sup = float(r.superficie_rehabilitee) if r.superficie_rehabilitee else None
        fiche_data = schemas.AuditFicheOut.model_validate(r)
        fiche_data.audit_classe = crud._audit_class(sup) if sup else None
        fiches_out.append(fiche_data)

    return {
        "fiches": fiches_out,
        "total_fiches": result["total_fiches"],
        "superficie_echantillon": result["superficie_echantillon"],
        "superficie_totale": result["superficie_totale"],
        "pourcentage_couverture": result["pourcentage_couverture"],
        "par_classe": result["par_classe"],
    }


@router.get("/audit-sample/export-excel")
def export_audit_excel(db: Session = Depends(get_db)):
    """Génère et télécharge le plan d'audit en Excel (2 feuilles)."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    result = crud.get_audit_sample(db)
    fiches = result["fiches"]
    par_classe = result["par_classe"]

    HEADER_FILL = PatternFill(start_color="2D6846", end_color="2D6846", fill_type="solid")
    HEADER_FONT = Font(color="FFFFFF", bold=True)

    wb = Workbook()

    # ── Feuille 1 : liste des fiches ──────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Échantillon audit"
    headers1 = [
        "N°PDA", "Classe de superficie", "Département", "Commune",
        "Arrondissement", "Village", "Brigade", "Producteur",
        "Superficie (ha)", "Année",
    ]
    ws1.append(headers1)
    for col_idx, _ in enumerate(headers1, start=1):
        cell = ws1.cell(row=1, column=col_idx)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws1.column_dimensions[get_column_letter(col_idx)].width = 22
    ws1.row_dimensions[1].height = 30
    ws1.freeze_panes = "A2"

    for r in fiches:
        sup = float(r.superficie_rehabilitee) if r.superficie_rehabilitee else None
        ws1.append([
            r.pda_number,
            crud._audit_class(sup) if sup else None,
            r.departement,
            r.commune,
            r.arrondissement,
            r.village,
            r.brigade_name,
            r.producer_name,
            sup,
            r.annee_rehabilitation,
        ])

    # ── Feuille 2 : synthèse par classe ───────────────────────────────────
    ws2 = wb.create_sheet("Synthèse par classe")
    headers2 = ["Classe de superficie", "Fiches sélectionnées", "Superficie (ha)", "Brigades couvertes"]
    ws2.append(headers2)
    for col_idx, _ in enumerate(headers2, start=1):
        cell = ws2.cell(row=1, column=col_idx)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center")
        ws2.column_dimensions[get_column_letter(col_idx)].width = 26
    ws2.freeze_panes = "A2"

    for cls in par_classe:
        ws2.append([cls["classe"], cls["fiches"], cls["superficie"], cls["nb_brigades"]])

    # Ligne totaux
    total_row = len(par_classe) + 2
    ws2.cell(row=total_row, column=1, value="TOTAL").font = Font(bold=True)
    ws2.cell(row=total_row, column=2, value=result["total_fiches"]).font = Font(bold=True)
    ws2.cell(row=total_row, column=3, value=result["superficie_echantillon"]).font = Font(bold=True)
    ws2.cell(row=total_row + 1, column=1, value="Superficie totale système").font = Font(italic=True)
    ws2.cell(row=total_row + 1, column=3, value=result["superficie_totale"]).font = Font(italic=True)
    ws2.cell(row=total_row + 2, column=1, value="Couverture (%)").font = Font(italic=True)
    ws2.cell(row=total_row + 2, column=3, value=f"{result['pourcentage_couverture']} %").font = Font(italic=True)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plan_audit_superficies.xlsx"},
    )


# ---------------------------------------------------------------------------
# Liste des départements
# ---------------------------------------------------------------------------
@router.get("/departements", response_model=schemas.DepartementListResponse)
def list_departements(
    q: Optional[str] = Query(None, description="Recherche par nom de département"),
    db: Session = Depends(get_db),
):
    """Départements distincts avec leurs agrégats (fiches, superficie, communes…)."""
    return crud.get_departements(db, q=q)


# ---------------------------------------------------------------------------
# Liste des producteurs (regroupés par nom)
# ---------------------------------------------------------------------------
@router.get("/producteurs", response_model=schemas.ProducerListResponse)
def list_producers(
    q: Optional[str] = Query(None, description="Recherche par nom, téléphone, commune ou village"),
    db: Session = Depends(get_db),
):
    """Producteurs distincts avec leurs informations agrégées (fiches, superficie, communes…)."""
    return crud.get_producers(db, q=q)


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


@router.get("/export-incomplete-excel")
def export_incomplete_excel(
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
    rows = crud.get_all_incomplete_for_export(
        db, q, departement, commune, arrondissement, village, brigade_name, annee, sup_class
    )
    workbook = excel_utils.build_incomplete_export_workbook(rows)
    return _workbook_response(workbook, "fiches_a_completer.xlsx")


# ---------------------------------------------------------------------------
# Import Excel (structure identique au fichier source / au modèle téléchargeable)
# ---------------------------------------------------------------------------
@router.post("/import-excel", response_model=schemas.ImportResult)
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format Excel (.xlsx).")

    content = await file.read()
    try:
        valid_payloads, row_errors, incomplete_count = excel_utils.parse_import_workbook(content)
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
        "aCompleter": incomplete_count,
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

"""Data ingestion and management API routes."""

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.models.data import (
    ColumnConfigRequest,
    ColumnConfigResponse,
    PreviewResponse,
    RowsResponse,
    SummaryResponse,
    UploadResponse,
)
from app.services.ingestion import (
    build_column_info,
    get_excel_sheets,
    load_csv,
    load_excel,
    load_parquet,
)
from app.services.statistics import compute_dataset_summary
from app.session import store

router = APIRouter(prefix="/api/data", tags=["data"])

ALLOWED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls", ".parquet"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
SAMPLE_METADATA = {
    "palmer_penguins": {
        "display_name": "Palmer Penguins",
        "description": "Penguin measurements from Palmer Station, Antarctica",
    },
    "iris": {
        "display_name": "Iris Flowers",
        "description": "Classic Fisher iris flower measurements",
    },
    "titanic": {
        "display_name": "Titanic Passengers",
        "description": "Passenger survival data from RMS Titanic",
    },
}


def _get_session(dataset_id: str):
    """Get a session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _samples_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "samples"


@router.get("/samples")
async def list_samples():
    """List available sample datasets."""

    samples_path = _samples_dir()
    if not samples_path.exists():
        return []

    samples = []
    for csv_file in sorted(samples_path.glob("*.csv")):
        name = csv_file.stem
        metadata = SAMPLE_METADATA.get(name)
        if metadata is None:
            metadata = {
                "display_name": name.replace("_", " ").title(),
                "description": "Bundled sample dataset",
            }

        samples.append(
            {
                "name": name,
                "display_name": metadata["display_name"],
                "description": metadata["description"],
            }
        )

    return samples


@router.post("/samples/{sample_name}", response_model=UploadResponse)
async def load_sample(sample_name: str):
    """Load a bundled sample dataset without upload."""

    if sample_name not in SAMPLE_METADATA:
        raise HTTPException(status_code=404, detail=f"Sample dataset '{sample_name}' not found")

    sample_path = _samples_dir() / f"{sample_name}.csv"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail=f"Sample dataset '{sample_name}' not found")

    try:
        file_bytes = sample_path.read_bytes()
        session = load_csv(file_bytes, sample_path.name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to load sample dataset: {exc}") from exc

    columns = build_column_info(session.dataframe)
    return UploadResponse(
        dataset_id=session.dataset_id,
        file_name=session.file_name,
        file_format=session.file_format,
        row_count=session.row_count,
        column_count=session.column_count,
        columns=columns,
        sheets=None,
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    sheet: str | None = Query(None, description="Sheet name for Excel files"),
):
    """Upload a CSV, TSV, Excel, or Parquet file."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate extension
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file bytes
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")

    try:
        if ext in (".csv", ".tsv"):
            session = load_csv(content, file.filename)
        elif ext in (".xlsx", ".xls"):
            session = load_excel(content, file.filename, sheet_name=sheet)
        elif ext == ".parquet":
            session = load_parquet(content, file.filename)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse file: {str(e)}",
        )

    columns = build_column_info(session.dataframe)

    # Check if Excel has multiple sheets
    sheets = None
    if session.file_format == "excel" and session.column_config:
        sheets_data = session.column_config[0] if session.column_config else {}
        sheets = sheets_data.get("_sheets") if isinstance(sheets_data, dict) else None
        session.column_config = []  # Clear temporary sheet storage

    return UploadResponse(
        dataset_id=session.dataset_id,
        file_name=session.file_name,
        file_format=session.file_format,
        row_count=session.row_count,
        column_count=session.column_count,
        columns=columns,
        sheets=sheets,
    )


@router.get("/{dataset_id}/preview", response_model=PreviewResponse)
async def get_preview(
    dataset_id: str,
    rows: int = Query(100, ge=1, le=1000, description="Number of preview rows"),
):
    """Get first N rows for preview with column types."""

    session = _get_session(dataset_id)
    df = session.dataframe

    preview_df = df.head(rows)
    # Convert to JSON-safe values (handle NaN, datetime, etc.)
    data = preview_df.where(preview_df.notna(), None).values.tolist()

    return PreviewResponse(
        columns=list(df.columns.astype(str)),
        dtypes=[str(df[c].dtype) for c in df.columns],
        data=data,
        row_count=len(preview_df),
        total_rows=session.row_count,
    )


@router.get("/{dataset_id}/rows", response_model=RowsResponse)
async def get_rows(
    dataset_id: str,
    offset: int = Query(0, ge=0, description="Row offset"),
    limit: int = Query(1000, ge=1, le=10000, description="Max rows to return"),
    sort_by: str | None = Query(None, description="Column name to sort by"),
    sort_desc: bool = Query(False, description="Sort descending"),
):
    """Get paginated rows with optional sorting."""

    session = _get_session(dataset_id)
    df = session.dataframe

    # Apply sorting
    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=not sort_desc, na_position="last")

    # Paginate
    page = df.iloc[offset : offset + limit]
    data = page.where(page.notna(), None).values.tolist()

    return RowsResponse(
        columns=list(df.columns.astype(str)),
        data=data,
        offset=offset,
        limit=limit,
        total=session.row_count,
    )


@router.get("/{dataset_id}/summary", response_model=SummaryResponse)
async def get_summary(dataset_id: str):
    """Get column-level summary statistics for the dataset."""

    session = _get_session(dataset_id)
    column_summaries = compute_dataset_summary(session.dataframe)

    return SummaryResponse(
        dataset_id=session.dataset_id,
        row_count=session.row_count,
        column_count=session.column_count,
        columns=column_summaries,
    )


@router.post("/{dataset_id}/column-config", response_model=ColumnConfigResponse)
async def update_column_config(dataset_id: str, request: ColumnConfigRequest):
    """Update column types, renames, and exclusions."""

    session = _get_session(dataset_id)

    from app.services.ingestion import apply_column_config

    config_dicts = [item.model_dump() for item in request.columns]
    apply_column_config(session, config_dicts)

    columns = build_column_info(session.dataframe)
    return ColumnConfigResponse(ok=True, columns=columns)


@router.get("/{dataset_id}/sheets")
async def get_sheets(dataset_id: str):
    """Get available sheet names for an Excel dataset (already loaded)."""

    session = _get_session(dataset_id)
    if session.file_format != "excel":
        raise HTTPException(status_code=400, detail="Not an Excel dataset")
    # Sheets were stored during initial load
    return {"sheets": [session.sheet_name] if session.sheet_name else []}

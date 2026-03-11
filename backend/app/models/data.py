"""Pydantic request/response models for data endpoints."""

from pydantic import BaseModel


class ColumnInfo(BaseModel):
    """Column metadata returned after ingestion."""

    name: str
    dtype: str  # "numeric", "categorical", "datetime", "text", "boolean"
    original_dtype: str  # pandas dtype string
    missing_count: int
    unique_count: int


class UploadResponse(BaseModel):
    """Response after successfully uploading a file."""

    dataset_id: str
    file_name: str
    file_format: str
    sheet_name: str | None = None
    row_count: int
    column_count: int
    columns: list[ColumnInfo]
    sheets: list[str] | None = None  # Only for Excel files


class PreviewResponse(BaseModel):
    """Response for data preview (first N rows)."""

    columns: list[str]
    dtypes: list[str]
    data: list[list]  # Row-major: list of rows, each row is a list of values
    row_count: int
    total_rows: int


class RowsResponse(BaseModel):
    """Paginated row data response."""

    columns: list[str]
    data: list[list]
    offset: int
    limit: int
    total: int


class ColumnSummary(BaseModel):
    """Summary statistics for a single column."""

    name: str
    dtype: str
    missing_count: int
    missing_pct: float
    unique_count: int
    # Numeric-only stats (None for non-numeric)
    mean: float | None = None
    std: float | None = None
    min: float | None = None
    max: float | None = None
    median: float | None = None
    # Categorical-only stats
    top_value: str | None = None
    top_freq: int | None = None


class SummaryResponse(BaseModel):
    """Dataset-level summary statistics."""

    dataset_id: str
    row_count: int
    column_count: int
    columns: list[ColumnSummary]


class ColumnConfigItem(BaseModel):
    """User override for a single column."""

    name: str
    dtype: str | None = None  # Override type: "numeric", "categorical", "datetime", "text"
    excluded: bool = False
    rename: str | None = None


class ColumnConfigRequest(BaseModel):
    """Request to update column configurations."""

    columns: list[ColumnConfigItem]


class CastColumnRequest(BaseModel):
    """Request to cast a single column to a target dtype."""

    column: str
    target_dtype: str


class ColumnConfigResponse(BaseModel):
    ok: bool = True
    columns: list[ColumnInfo]


class SampleResponse(BaseModel):
    """Response for sampled dataset rows."""

    columns: list[str]
    dtypes: list[str]
    data: list[list]
    row_count: int
    total_rows: int
    method: str


class SheetsResponse(BaseModel):
    """Response listing available sheets in an Excel file."""

    sheets: list[str]


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    detail: str
    user_message: str | None = None

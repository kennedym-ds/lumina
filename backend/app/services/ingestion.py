"""Data ingestion service — CSV, TSV, Excel, Parquet file loading."""

import csv
import io
import uuid
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from app.models.data import ColumnInfo
from app.session import DatasetSession, store


def infer_lumina_dtype(series: pd.Series) -> str:
    """Map a pandas Series dtype to a Lumina type string."""

    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # Check if low-cardinality string → categorical
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        if series.nunique() < min(50, len(series) * 0.05) and len(series) > 20:
            return "categorical"
        return "text"
    if isinstance(series.dtype, pd.CategoricalDtype):
        return "categorical"
    return "text"


def build_column_info(df: pd.DataFrame) -> list[ColumnInfo]:
    """Build column metadata from a DataFrame."""

    columns = []
    for col in df.columns:
        series = df[col]
        columns.append(
            ColumnInfo(
                name=str(col),
                dtype=infer_lumina_dtype(series),
                original_dtype=str(series.dtype),
                missing_count=int(series.isna().sum()),
                unique_count=int(series.nunique()),
            )
        )
    return columns


def load_csv(file_bytes: bytes, file_name: str) -> DatasetSession:
    """Load a CSV or TSV file with auto-delimiter detection."""

    # Detect delimiter from first 8KB
    sample = file_bytes[:8192].decode("utf-8", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ","  # Fallback to comma

    df = pd.read_csv(
        io.BytesIO(file_bytes),
        delimiter=delimiter,
        low_memory=False,
        on_bad_lines="warn",
    )

    # Try to parse date columns heuristically
    for col in df.columns:
        if df[col].dtype == object:
            try:
                parsed = pd.to_datetime(df[col], errors="coerce", format="mixed")
                if parsed.notna().sum() > len(df) * 0.5:
                    df[col] = parsed
            except (ValueError, TypeError):
                pass

    dataset_id = str(uuid.uuid4())
    session = DatasetSession(
        dataset_id=dataset_id,
        file_path=file_name,
        file_name=file_name,
        file_format="csv",
        dataframe=df,
        original_dtypes={str(c): str(df[c].dtype) for c in df.columns},
    )
    store.create(session)
    return session


def load_excel(file_bytes: bytes, file_name: str, sheet_name: str | None = None) -> DatasetSession:
    """Load an Excel file. If sheet_name is None, loads the first sheet."""

    xls = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
    sheet_names = xls.sheet_names

    target_sheet_raw = sheet_name if sheet_name and sheet_name in sheet_names else sheet_names[0]
    target_sheet = str(target_sheet_raw)
    df = pd.read_excel(xls, sheet_name=target_sheet)

    dataset_id = str(uuid.uuid4())
    session = DatasetSession(
        dataset_id=dataset_id,
        file_path=file_name,
        file_name=file_name,
        file_format="excel",
        dataframe=df,
        original_dtypes={str(c): str(df[c].dtype) for c in df.columns},
        sheet_name=target_sheet,
    )
    # Store sheet names in column_config temporarily for the response
    session.column_config = [{"_sheets": sheet_names}]
    store.create(session)
    return session


def get_excel_sheets(file_bytes: bytes) -> list[str]:
    """Get sheet names from an Excel file without loading data."""

    xls = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
    return [str(name) for name in xls.sheet_names]


def load_file(file_bytes: bytes, filename: str, sheet_name: str | None = None) -> pd.DataFrame:
    """Load a supported file type into a DataFrame.

    Supports CSV/TSV, Excel, and Parquet by inspecting the filename extension.
    """

    ext = Path(filename).suffix.lower()

    if ext in {".csv", ".tsv"}:
        sample = file_bytes[:8192].decode("utf-8", errors="replace")
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ","

        df = pd.read_csv(
            io.BytesIO(file_bytes),
            delimiter=delimiter,
            low_memory=False,
            on_bad_lines="warn",
        )

        for col in df.columns:
            if df[col].dtype == object:
                try:
                    parsed = pd.to_datetime(df[col], errors="coerce", format="mixed")
                    if parsed.notna().sum() > len(df) * 0.5:
                        df[col] = parsed
                except (ValueError, TypeError):
                    pass

        return df

    if ext in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
        target_sheet_raw = sheet_name if sheet_name and sheet_name in xls.sheet_names else xls.sheet_names[0]
        target_sheet = str(target_sheet_raw)
        return pd.read_excel(xls, sheet_name=target_sheet)

    if ext == ".parquet":
        table = pq.read_table(io.BytesIO(file_bytes))
        return table.to_pandas()

    raise ValueError(f"Unsupported file type: {ext}")


def load_parquet(file_bytes: bytes, file_name: str) -> DatasetSession:
    """Load a Parquet file via PyArrow."""

    table = pq.read_table(io.BytesIO(file_bytes))
    df = table.to_pandas()

    dataset_id = str(uuid.uuid4())
    session = DatasetSession(
        dataset_id=dataset_id,
        file_path=file_name,
        file_name=file_name,
        file_format="parquet",
        dataframe=df,
        original_dtypes={str(c): str(df[c].dtype) for c in df.columns},
    )
    store.create(session)
    return session


def apply_column_config(session: DatasetSession, config: list[dict]) -> None:
    """Apply user column configuration (type overrides, renames, exclusions)."""

    df = session.dataframe

    for item in config:
        col_name = item.get("name")
        if col_name not in df.columns:
            continue

        # Rename
        new_name = item.get("rename")
        if new_name and new_name != col_name:
            df.rename(columns={col_name: new_name}, inplace=True)
            col_name = new_name

        # Type override
        new_dtype = item.get("dtype")
        if new_dtype:
            try:
                if new_dtype == "numeric":
                    df[col_name] = pd.to_numeric(df[col_name], errors="coerce")
                elif new_dtype == "categorical":
                    df[col_name] = df[col_name].astype("category")
                elif new_dtype == "datetime":
                    df[col_name] = pd.to_datetime(df[col_name], errors="coerce", format="mixed")
                elif new_dtype == "text":
                    df[col_name] = df[col_name].astype(str)
            except (ValueError, TypeError):
                pass  # Keep original if conversion fails

    session.column_config = config

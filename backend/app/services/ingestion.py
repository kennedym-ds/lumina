"""Data ingestion service — CSV, TSV, Excel, Parquet, JSON, SQLite, and Feather loading."""

import csv
import io
import json
import sqlite3
import tempfile
import uuid
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from app.models.data import ColumnInfo
from app.session import DatasetSession, store

CASTABLE_DTYPES = {"numeric", "categorical", "datetime", "text"}


def infer_lumina_dtype(series: pd.Series) -> str:
    """Map a pandas Series dtype to a Lumina type string."""

    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if isinstance(series.dtype, pd.CategoricalDtype):
        return "categorical"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # Check if low-cardinality string → categorical
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        if series.nunique() < min(50, len(series) * 0.05) and len(series) > 20:
            return "categorical"
        return "text"
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


def _coerce_datetime_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Parse likely datetime columns without failing on free-form text."""

    for col in df.columns:
        if df[col].dtype == object:
            try:
                parsed = pd.to_datetime(df[col], errors="coerce", format="mixed")
                if parsed.notna().sum() > len(df) * 0.5:
                    df[col] = parsed
            except (ValueError, TypeError):
                pass

    return df


def _create_session(
    df: pd.DataFrame,
    file_name: str,
    *,
    file_format: str,
    sheet_name: str | None = None,
    column_config: list[dict] | None = None,
) -> DatasetSession:
    """Create and store a dataset session from a DataFrame."""

    normalized = _coerce_datetime_columns(df.copy())
    dataset_id = str(uuid.uuid4())
    session = DatasetSession(
        dataset_id=dataset_id,
        file_path=file_name,
        file_name=file_name,
        file_format=file_format,
        dataframe=normalized,
        original_dtypes={str(c): str(normalized[c].dtype) for c in normalized.columns},
        sheet_name=sheet_name,
    )
    if column_config is not None:
        session.column_config = column_config
    store.create(session)
    return session


def _read_delimited_dataframe(file_bytes: bytes, delimiter: str | None = None) -> pd.DataFrame:
    """Load a delimited text file into a DataFrame."""

    if delimiter is None:
        sample = file_bytes[:8192].decode("utf-8", errors="replace")
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ","

    return pd.read_csv(
        io.BytesIO(file_bytes),
        delimiter=delimiter,
        low_memory=False,
        on_bad_lines="warn",
    )


def _read_json_dataframe(file_bytes: bytes) -> pd.DataFrame:
    """Load a JSON payload into a DataFrame."""

    data = json.loads(file_bytes.decode("utf-8"))

    if isinstance(data, list):
        if data and not isinstance(data[0], dict):
            raise ValueError("Unsupported JSON structure")
        return pd.DataFrame(data)

    if isinstance(data, dict):
        try:
            return pd.DataFrame(data)
        except ValueError:
            return pd.DataFrame([data])

    raise ValueError("Unsupported JSON structure")


def _read_excel_dataframe(file_bytes: bytes, sheet_name: str | None = None) -> tuple[pd.DataFrame, str, list[str]]:
    """Load an Excel workbook and return the selected sheet data."""

    xls = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
    sheet_names = [str(name) for name in xls.sheet_names]
    target_sheet = sheet_name if sheet_name and sheet_name in sheet_names else sheet_names[0]
    return pd.read_excel(xls, sheet_name=target_sheet), str(target_sheet), sheet_names


def _read_parquet_dataframe(file_bytes: bytes) -> pd.DataFrame:
    """Load a Parquet file into a DataFrame."""

    table = pq.read_table(io.BytesIO(file_bytes))
    return table.to_pandas()


def _escape_sqlite_identifier(identifier: str) -> str:
    """Escape a SQLite identifier using bracket quoting."""

    return f"[{identifier.replace(']', ']]')}]"


def _read_sqlite_dataframe(file_bytes: bytes, table_name: str | None = None) -> pd.DataFrame:
    """Load a SQLite database file into a DataFrame."""

    with tempfile.NamedTemporaryFile(delete=False, suffix=".sqlite") as tmp:
        tmp.write(file_bytes)
        tmp_path = Path(tmp.name)

    try:
        connection = sqlite3.connect(tmp_path)
        try:
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type = ?",
                connection,
                params=("table",),
            )
            if tables.empty:
                raise ValueError("No tables found in SQLite database")

            available_tables = {str(name) for name in tables["name"].tolist()}
            selected_table = table_name or str(tables.iloc[0]["name"])
            if selected_table not in available_tables:
                raise ValueError(f"Table '{selected_table}' not found in SQLite database")

            escaped_table = _escape_sqlite_identifier(selected_table)
            return pd.read_sql_query(f"SELECT * FROM {escaped_table}", connection)
        finally:
            connection.close()
    finally:
        tmp_path.unlink(missing_ok=True)


def _read_feather_dataframe(file_bytes: bytes) -> pd.DataFrame:
    """Load a Feather or Arrow IPC file into a DataFrame."""

    return pd.read_feather(io.BytesIO(file_bytes))


def load_csv(
    file_bytes: bytes,
    file_name: str,
    *,
    delimiter: str | None = None,
    file_format: str = "csv",
) -> DatasetSession:
    """Load a CSV or TSV file into a dataset session."""

    df = _read_delimited_dataframe(file_bytes, delimiter=delimiter)
    return _create_session(df, file_name, file_format=file_format)


def load_excel(file_bytes: bytes, file_name: str, sheet_name: str | None = None) -> DatasetSession:
    """Load an Excel file. If sheet_name is None, loads the first sheet."""

    df, target_sheet, sheet_names = _read_excel_dataframe(file_bytes, sheet_name=sheet_name)
    return _create_session(
        df,
        file_name,
        file_format="excel",
        sheet_name=target_sheet,
        column_config=[{"_sheets": sheet_names}],
    )


def load_json(file_bytes: bytes, file_name: str) -> DatasetSession:
    """Load a JSON file into a dataset session."""

    df = _read_json_dataframe(file_bytes)
    return _create_session(df, file_name, file_format="json")


def load_sqlite(file_bytes: bytes, file_name: str, table_name: str | None = None) -> DatasetSession:
    """Load a SQLite database file into a dataset session."""

    df = _read_sqlite_dataframe(file_bytes, table_name=table_name)
    return _create_session(df, file_name, file_format="sqlite")


def load_feather(file_bytes: bytes, file_name: str, *, file_format: str = "feather") -> DatasetSession:
    """Load a Feather or Arrow file into a dataset session."""

    df = _read_feather_dataframe(file_bytes)
    return _create_session(df, file_name, file_format=file_format)


def get_excel_sheets(file_bytes: bytes) -> list[str]:
    """Get sheet names from an Excel file without loading data."""

    _, _, sheet_names = _read_excel_dataframe(file_bytes)
    return sheet_names


def load_file(file_bytes: bytes, filename: str, sheet_name: str | None = None) -> pd.DataFrame:
    """Load a supported file type into a DataFrame.

    Supports CSV/TSV, Excel, and Parquet by inspecting the filename extension.
    """

    ext = Path(filename).suffix.lower()

    if ext == ".csv":
        return _coerce_datetime_columns(_read_delimited_dataframe(file_bytes))

    if ext in {".tsv", ".tab"}:
        return _coerce_datetime_columns(_read_delimited_dataframe(file_bytes, delimiter="\t"))

    if ext in {".xlsx", ".xls"}:
        dataframe, _, _ = _read_excel_dataframe(file_bytes, sheet_name=sheet_name)
        return _coerce_datetime_columns(dataframe)

    if ext == ".parquet":
        return _coerce_datetime_columns(_read_parquet_dataframe(file_bytes))

    if ext == ".json":
        return _coerce_datetime_columns(_read_json_dataframe(file_bytes))

    if ext in {".db", ".sqlite", ".sqlite3"}:
        return _coerce_datetime_columns(_read_sqlite_dataframe(file_bytes))

    if ext in {".feather", ".arrow"}:
        return _coerce_datetime_columns(_read_feather_dataframe(file_bytes))

    raise ValueError(f"Unsupported file type: {ext}")


def load_parquet(file_bytes: bytes, file_name: str) -> DatasetSession:
    """Load a Parquet file via PyArrow."""

    df = _read_parquet_dataframe(file_bytes)
    return _create_session(df, file_name, file_format="parquet")


def cast_column(session: DatasetSession, column_name: str, target_dtype: str) -> None:
    """Cast a single column in-place and persist the override in session config."""

    if column_name not in session.dataframe.columns:
        raise KeyError(f"Column '{column_name}' not found")

    if target_dtype not in CASTABLE_DTYPES:
        raise ValueError("target_dtype must be one of: numeric, categorical, datetime, text")

    series = session.dataframe[column_name]
    if target_dtype == "numeric":
        session.dataframe[column_name] = pd.to_numeric(series, errors="coerce")
    elif target_dtype == "categorical":
        session.dataframe[column_name] = series.astype("category")
    elif target_dtype == "datetime":
        session.dataframe[column_name] = pd.to_datetime(series, errors="coerce", format="mixed")
    elif target_dtype == "text":
        session.dataframe[column_name] = series.astype("string")

    existing_configs = [
        dict(item)
        for item in session.column_config
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ]
    config_by_name = {item["name"]: item for item in existing_configs}
    next_config = config_by_name.get(column_name, {"name": column_name})
    next_config["dtype"] = target_dtype
    config_by_name[column_name] = next_config

    ordered_names = [item["name"] for item in existing_configs if item["name"] in config_by_name]
    if column_name not in ordered_names:
        ordered_names.append(column_name)

    session.column_config = [config_by_name[name] for name in ordered_names]


def sample_dataframe(
    df: pd.DataFrame,
    *,
    n: int,
    method: str = "random",
    stratify_by: str | None = None,
) -> pd.DataFrame:
    """Return a sampled subset of a DataFrame."""

    if df.empty or n >= len(df):
        return df.copy()

    normalized_method = method.lower()
    if normalized_method == "head":
        return df.head(n)

    if normalized_method == "random":
        return df.sample(n=n, random_state=42)

    if normalized_method != "stratified":
        raise ValueError("method must be one of: random, head, stratified")

    if stratify_by is None or stratify_by not in df.columns:
        for column in df.columns:
            if infer_lumina_dtype(df[column]) in {"categorical", "boolean", "text"} and df[column].nunique(dropna=False) > 1:
                stratify_by = str(column)
                break

    if stratify_by is None or stratify_by not in df.columns:
        return df.sample(n=n, random_state=42)

    samples: list[pd.DataFrame] = []
    remaining = n
    groups = list(df.groupby(stratify_by, dropna=False, group_keys=False))
    total_rows = len(df)

    for index, (_, group) in enumerate(groups):
        if remaining <= 0:
            break

        if index == len(groups) - 1:
            target_size = remaining
        else:
            proportional_size = round(n * (len(group) / total_rows))
            target_size = max(1, proportional_size)

        take = min(len(group), target_size)
        sample = group if take == len(group) else group.sample(n=take, random_state=42)
        samples.append(sample)
        remaining -= len(sample)

    sampled = pd.concat(samples).drop_duplicates()
    if len(sampled) < n:
        available = df.drop(sampled.index, errors="ignore")
        if not available.empty:
            additional = available.sample(n=min(n - len(sampled), len(available)), random_state=42)
            sampled = pd.concat([sampled, additional])

    return sampled.head(n)


def apply_column_config(session: DatasetSession, config: list[dict]) -> None:
    """Apply user column configuration (type overrides, renames, exclusions)."""

    df = session.dataframe
    excluded: set[str] = set()

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

        if item.get("excluded", False):
            excluded.add(str(col_name))

    session.excluded_columns = excluded
    session.column_config = config

"""Column-level summary statistics computation."""

import pandas as pd

from app.models.data import ColumnSummary
from app.services.ingestion import infer_lumina_dtype


def compute_column_summary(series: pd.Series, col_name: str) -> ColumnSummary:
    """Compute summary statistics for a single column."""

    dtype = infer_lumina_dtype(series)
    missing = int(series.isna().sum())
    total = len(series)

    summary = ColumnSummary(
        name=col_name,
        dtype=dtype,
        missing_count=missing,
        missing_pct=round(missing / total * 100, 2) if total > 0 else 0.0,
        unique_count=int(series.nunique()),
    )

    if dtype == "numeric":
        desc = series.describe()
        summary.mean = round(float(desc.get("mean", 0)), 4) if "mean" in desc else None
        summary.std = round(float(desc.get("std", 0)), 4) if "std" in desc else None
        summary.min = float(desc.get("min", 0)) if "min" in desc else None
        summary.max = float(desc.get("max", 0)) if "max" in desc else None
        summary.median = round(float(series.median()), 4) if not series.isna().all() else None
    elif dtype in ("text", "categorical"):
        mode = series.mode()
        if len(mode) > 0:
            summary.top_value = str(mode.iloc[0])
            summary.top_freq = int((series == mode.iloc[0]).sum())

    return summary


def compute_dataset_summary(df: pd.DataFrame) -> list[ColumnSummary]:
    """Compute summary statistics for all columns in a DataFrame."""

    return [compute_column_summary(df[col], str(col)) for col in df.columns]

"""Dataset profiling service."""

from __future__ import annotations

import math
from typing import Any, Literal, cast

import numpy as np
import pandas as pd

from app.models.profiling import ColumnProfile, DatasetProfile
from app.services.ingestion import infer_lumina_dtype

HISTOGRAM_BIN_COUNT = 20
TOP_VALUES_LIMIT = 10


def profile_dataset(dataset_id: str, df: pd.DataFrame) -> DatasetProfile:
    """Generate a comprehensive profiling report for a DataFrame."""

    columns = [_profile_column(df[column_name], str(column_name), len(df)) for column_name in df.columns]

    return DatasetProfile(
        dataset_id=dataset_id,
        row_count=len(df),
        column_count=len(df.columns),
        total_memory_bytes=int(df.memory_usage(deep=True).sum()),
        duplicate_row_count=int(df.duplicated().sum()),
        columns=columns,
    )


def compute_correlation(
    df: pd.DataFrame, method: str = "pearson"
) -> tuple[list[str], list[list[float | None]]]:
    """Compute a correlation matrix for all numeric columns."""

    valid_methods = {"pearson", "spearman", "kendall"}
    if method not in valid_methods:
        allowed = ", ".join(sorted(valid_methods))
        raise ValueError(f"Invalid method: {method}. Use: {allowed}")

    numeric_df = df.select_dtypes(include="number")
    if numeric_df.empty:
        return [], []

    validated_method = cast(Literal["pearson", "spearman", "kendall"], method)
    correlation = numeric_df.corr(method=validated_method)
    columns = [str(column) for column in correlation.columns]
    matrix = [
        [round(float(value), 4) if pd.notna(value) else None for value in row]
        for row in correlation.to_numpy(dtype=object)
    ]

    return columns, matrix


def _profile_column(series: pd.Series, col_name: str, total: int) -> ColumnProfile:
    """Profile a single DataFrame column."""

    dtype = _infer_profile_dtype(series)
    missing = int(series.isna().sum())
    unique_count = int(series.nunique(dropna=True))

    profile = ColumnProfile(
        name=col_name,
        dtype=dtype,
        total_count=total,
        missing_count=missing,
        missing_pct=round(missing / total * 100, 2) if total > 0 else 0.0,
        unique_count=unique_count,
        memory_bytes=int(series.memory_usage(deep=True, index=False)),
    )

    if dtype == "numeric":
        _apply_numeric_profile(profile, series)
    elif dtype in {"categorical", "text", "boolean"}:
        _apply_top_values(profile, series, total, missing)

    return profile


def _apply_numeric_profile(profile: ColumnProfile, series: pd.Series) -> None:
    """Populate numeric statistics for a profiled column."""

    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return

    desc = numeric.describe()
    profile.mean = _rounded_float(desc.get("mean"))
    profile.std = _rounded_float(desc.get("std"))
    profile.min = _finite_float(desc.get("min"))
    profile.max = _finite_float(desc.get("max"))
    profile.median = _rounded_float(numeric.median())
    profile.q1 = _rounded_float(desc.get("25%"))
    profile.q3 = _rounded_float(desc.get("75%"))
    profile.skewness = _rounded_float(numeric.skew())
    profile.kurtosis = _rounded_float(numeric.kurtosis())
    profile.zeros_count = int((numeric == 0).sum())

    counts, edges = np.histogram(numeric.to_numpy(dtype=float), bins=HISTOGRAM_BIN_COUNT)
    profile.histogram_bins = [round(float(edge), 4) for edge in edges]
    profile.histogram_counts = [int(count) for count in counts]


def _apply_top_values(profile: ColumnProfile, series: pd.Series, total: int, missing: int) -> None:
    """Populate top-value frequencies for categorical-like columns."""

    value_counts = series.value_counts(dropna=True).head(TOP_VALUES_LIMIT)
    non_null_total = total - missing
    profile.top_values = [
        {
            "value": str(value),
            "count": int(count),
            "pct": round(count / non_null_total * 100, 2) if non_null_total > 0 else 0.0,
        }
        for value, count in value_counts.items()
    ]


def _infer_profile_dtype(series: pd.Series) -> str:
    """Infer a profiling-friendly Lumina dtype for the series."""

    dtype = infer_lumina_dtype(series)
    if dtype != "text":
        return dtype

    non_null = series.dropna()
    if non_null.empty:
        return dtype

    unique_count = int(non_null.nunique())
    unique_ratio = unique_count / len(non_null)

    if unique_count <= 20 and ((len(non_null) < 20 and unique_ratio <= 0.5) or unique_ratio <= 0.2):
        return "categorical"

    return dtype


def _finite_float(value: Any) -> float | None:
    """Return a float when the value is finite, else None."""

    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(numeric) or math.isinf(numeric):
        return None

    return numeric


def _rounded_float(value: object, digits: int = 4) -> float | None:
    """Return a rounded float when the value is finite, else None."""

    numeric = _finite_float(value)
    if numeric is None:
        return None

    return round(numeric, digits)

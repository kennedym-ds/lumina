"""Missing value detection and preprocessing strategies for regression."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.models.regression import MissingValueReport


def check_missing_values(df: pd.DataFrame, columns: list[str]) -> MissingValueReport:
    """Check for missing values in the specified columns."""

    missing_columns = [col for col in columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Column(s) not found: {', '.join(missing_columns)}")

    subset = df[columns]
    row_count = len(subset)
    columns_with_missing: list[dict[str, Any]] = []

    for col in columns:
        count = int(subset[col].isna().sum())
        if count > 0:
            pct = float((count / row_count) * 100) if row_count else 0.0
            columns_with_missing.append(
                {
                    "name": col,
                    "count": count,
                    "pct": round(pct, 4),
                }
            )

    total_rows_affected = int(subset.isna().any(axis=1).sum())
    has_missing = total_rows_affected > 0

    recommendation = "No missing values detected in selected columns."
    if has_missing:
        recommendation = (
            "Missing values detected. Use listwise deletion for strict analysis "
            "or mean/mode imputation to preserve rows."
        )

    return MissingValueReport(
        has_missing=has_missing,
        columns_with_missing=columns_with_missing,
        total_rows_affected=total_rows_affected,
        recommendation=recommendation,
    )


def apply_missing_strategy(
    df: pd.DataFrame,
    columns: list[str],
    strategy: str,
) -> tuple[pd.DataFrame, list[str]]:
    """Apply missing value strategy and return (cleaned_df, warnings)."""

    if strategy not in {"listwise", "mean_imputation"}:
        raise ValueError("missing_strategy must be 'listwise' or 'mean_imputation'")

    missing_columns = [col for col in columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Column(s) not found: {', '.join(missing_columns)}")

    working = df[columns].copy()
    warnings: list[str] = []

    if strategy == "listwise":
        before = len(working)
        cleaned = working.dropna(axis=0, how="any")
        dropped = before - len(cleaned)
        if dropped > 0:
            pct = (dropped / before) * 100 if before else 0.0
            warnings.append(f"Dropped {dropped} rows ({pct:.1f}%) using listwise deletion")
        return cleaned, warnings

    # mean_imputation
    for col in columns:
        series = working[col]
        if not series.isna().any():
            continue

        if pd.api.types.is_numeric_dtype(series):
            fill_value = float(series.mean())
            working[col] = series.fillna(fill_value)
            warnings.append(f"Imputed mean for column '{col}'")
        else:
            modes = series.mode(dropna=True)
            fill_value = modes.iloc[0] if not modes.empty else ""
            working[col] = series.fillna(fill_value)
            warnings.append(f"Imputed mode for column '{col}'")

    return working, warnings

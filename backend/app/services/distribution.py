"""Distribution overlay service for kernel density estimation traces."""

from __future__ import annotations

import numpy as np
import pandas as pd
from numpy.linalg import LinAlgError
from scipy.stats import gaussian_kde


def _serialize_array(values: np.ndarray) -> list[float]:
    return [round(float(value), 6) for value in values]


def _estimate_trace(group: str, values: np.ndarray, x_grid: np.ndarray) -> dict[str, object] | None:
    if len(values) < 2:
        return None

    try:
        density = gaussian_kde(values)(x_grid)
    except LinAlgError:
        return None

    return {
        "group": group,
        "x": _serialize_array(x_grid),
        "y": _serialize_array(density),
    }


def compute_kde(
    df: pd.DataFrame,
    column: str,
    group_by: str | None = None,
    n_points: int = 200,
) -> list[dict[str, object]]:
    """Compute KDE traces for a numeric column, optionally split by a grouping column."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    if group_by is not None and group_by not in df.columns:
        raise ValueError(f"Column '{group_by}' not found")
    if n_points < 2:
        raise ValueError("n_points must be at least 2")

    series = df[column]
    if not pd.api.types.is_numeric_dtype(series):
        raise ValueError(f"Column '{column}' is not numeric")

    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if len(numeric) < 2:
        return []

    if group_by is None:
        x_grid = np.linspace(float(numeric.min()), float(numeric.max()), n_points)
        trace = _estimate_trace("all", numeric.to_numpy(dtype=float), x_grid)
        return [trace] if trace is not None else []

    grouped = df[[column, group_by]].dropna().copy()
    grouped[column] = pd.to_numeric(grouped[column], errors="coerce")
    grouped = grouped.dropna(subset=[column])

    if len(grouped) < 2:
        return []

    group_order = grouped[group_by].value_counts().head(10).index.tolist()
    x_grid = np.linspace(float(grouped[column].min()), float(grouped[column].max()), n_points)

    traces: list[dict[str, object]] = []
    for group_value in group_order:
        values = grouped.loc[grouped[group_by] == group_value, column].to_numpy(dtype=float)
        trace = _estimate_trace(str(group_value), values, x_grid)
        if trace is not None:
            traces.append(trace)

    return traces
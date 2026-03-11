"""Filter engine for applying row-level filter rules to DataFrames."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.models.filters import FilterRule

VALID_OPERATORS = {
    "==",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "in",
    "not_in",
    "is_null",
    "not_null",
    "contains",
    "not_contains",
}


def apply_filters(df: pd.DataFrame, filters: list[FilterRule]) -> pd.DataFrame:
    """Apply AND-joined filter rules to a DataFrame."""

    if not filters:
        return df

    mask = pd.Series(True, index=df.index, dtype=bool)

    for rule in filters:
        if rule.column not in df.columns or rule.operator not in VALID_OPERATORS:
            continue

        rule_mask = _apply_single_rule(df[rule.column], rule)
        mask = mask & rule_mask.reindex(df.index, fill_value=False).astype(bool)

    return df.loc[mask]


def _apply_single_rule(col: pd.Series, rule: FilterRule) -> pd.Series:
    """Apply a single filter rule and return a boolean mask."""

    op = rule.operator
    val = rule.value

    if op == "is_null":
        return col.isna()
    if op == "not_null":
        return col.notna()

    if op == "==":
        return col == _coerce_value(col, val)
    if op == "!=":
        return col != _coerce_value(col, val)
    if op == ">":
        return _compare_numeric(col, val, lambda left, right: left > right)
    if op == ">=":
        return _compare_numeric(col, val, lambda left, right: left >= right)
    if op == "<":
        return _compare_numeric(col, val, lambda left, right: left < right)
    if op == "<=":
        return _compare_numeric(col, val, lambda left, right: left <= right)
    if op == "in":
        return col.isin([_coerce_value(col, item) for item in _normalize_sequence(val)])
    if op == "not_in":
        return ~col.isin([_coerce_value(col, item) for item in _normalize_sequence(val)])
    if op == "contains":
        if val is None:
            return pd.Series(False, index=col.index, dtype=bool)
        return col.astype(str).str.contains(str(val), case=False, na=False)
    if op == "not_contains":
        if val is None:
            return pd.Series(True, index=col.index, dtype=bool)
        return ~col.astype(str).str.contains(str(val), case=False, na=False)

    return pd.Series(True, index=col.index, dtype=bool)


def _compare_numeric(col: pd.Series, val: Any, comparator) -> pd.Series:
    numeric_col = pd.to_numeric(col, errors="coerce")
    numeric_val = pd.to_numeric(pd.Series([val]), errors="coerce").iloc[0]

    if pd.isna(numeric_val):
        return pd.Series(False, index=col.index, dtype=bool)

    return comparator(numeric_col, float(numeric_val)).fillna(False)


def _coerce_value(col: pd.Series, val: Any) -> Any:
    """Try to coerce the filter value to align with the Series dtype."""

    if pd.api.types.is_numeric_dtype(col):
        try:
            return float(val)
        except (TypeError, ValueError):
            return val

    if pd.api.types.is_datetime64_any_dtype(col):
        parsed = pd.to_datetime(val, errors="coerce")
        return val if pd.isna(parsed) else parsed

    return val


def _normalize_sequence(val: Any) -> list[Any]:
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        values = [item.strip() for item in val.split(",")]
        return [item for item in values if item]
    return [val]

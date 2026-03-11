"""Transform engine for computed dataset columns."""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

import numpy as np
import pandas as pd

from app.models.transforms import TransformRequest
from app.services.plugin_loader import get_transform_plugins
from app.session import DatasetSession

_TRANSFORM_TYPES: list[dict[str, str]] = [
    {"type": "bin", "label": "Bin"},
    {"type": "recode", "label": "Recode"},
    {"type": "date_part", "label": "Date part"},
    {"type": "log", "label": "Logarithm"},
    {"type": "sqrt", "label": "Square root"},
    {"type": "zscore", "label": "Z-score"},
    {"type": "arithmetic", "label": "Arithmetic"},
]

_IDENTIFIER_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")


@dataclass(frozen=True)
class Token:
    """Single token in an arithmetic expression."""

    kind: str
    value: str


class ArithmeticParser:
    """Safe recursive-descent parser for arithmetic expressions over DataFrame columns."""

    def __init__(self, expression: str, dataframe: pd.DataFrame) -> None:
        self._dataframe = dataframe
        self._tokens = self._tokenize(expression)
        self._position = 0

    def parse(self) -> pd.Series:
        """Parse the configured expression into a pandas Series."""

        if not self._tokens:
            raise ValueError("Arithmetic expression is required")

        result = self._parse_expr()
        if self._position != len(self._tokens):
            token = self._tokens[self._position]
            raise ValueError(f"Unexpected token '{token.value}' in arithmetic expression")

        if isinstance(result, pd.Series):
            return result

        return pd.Series(float(result), index=self._dataframe.index, dtype="float64")

    def _parse_expr(self) -> pd.Series | float:
        result = self._parse_term()
        while self._match("OP", "+") or self._match("OP", "-"):
            operator = self._previous().value
            rhs = self._parse_term()
            result = result + rhs if operator == "+" else result - rhs
        return result

    def _parse_term(self) -> pd.Series | float:
        result = self._parse_factor()
        while self._match("OP", "*") or self._match("OP", "/"):
            operator = self._previous().value
            rhs = self._parse_factor()
            result = result * rhs if operator == "*" else result / rhs
        return result

    def _parse_factor(self) -> pd.Series | float:
        if self._match("OP", "+"):
            return self._parse_factor()
        if self._match("OP", "-"):
            return -self._parse_factor()
        if self._match("NUMBER"):
            return float(self._previous().value)
        if self._match("IDENT"):
            column_name = self._previous().value
            if column_name not in self._dataframe.columns:
                raise ValueError(f"Unknown column '{column_name}' in arithmetic expression")
            return pd.to_numeric(self._dataframe[column_name], errors="coerce")
        if self._match("OP", "("):
            result = self._parse_expr()
            self._consume("OP", ")")
            return result

        current = self._peek()
        if current is None:
            raise ValueError("Unexpected end of arithmetic expression")
        raise ValueError(f"Unexpected token '{current.value}' in arithmetic expression")

    def _match(self, kind: str, value: str | None = None) -> bool:
        token = self._peek()
        if token is None or token.kind != kind:
            return False
        if value is not None and token.value != value:
            return False
        self._position += 1
        return True

    def _consume(self, kind: str, value: str | None = None) -> Token:
        token = self._peek()
        if token is None or token.kind != kind or (value is not None and token.value != value):
            expected = value if value is not None else kind
            actual = "end of expression" if token is None else token.value
            raise ValueError(f"Expected {expected}, found {actual}")
        self._position += 1
        return token

    def _peek(self) -> Token | None:
        if self._position >= len(self._tokens):
            return None
        return self._tokens[self._position]

    def _previous(self) -> Token:
        return self._tokens[self._position - 1]

    @staticmethod
    def _tokenize(expression: str) -> list[Token]:
        tokens: list[Token] = []
        index = 0

        while index < len(expression):
            char = expression[index]
            if char.isspace():
                index += 1
                continue

            if char in "+-*/()":
                tokens.append(Token("OP", char))
                index += 1
                continue

            if char.isdigit() or (char == "." and index + 1 < len(expression) and expression[index + 1].isdigit()):
                start = index
                index += 1
                while index < len(expression) and (expression[index].isdigit() or expression[index] == "."):
                    index += 1
                number = expression[start:index]
                if number.count(".") > 1:
                    raise ValueError(f"Invalid number '{number}' in arithmetic expression")
                tokens.append(Token("NUMBER", number))
                continue

            if char.isalpha() or char == "_":
                start = index
                index += 1
                while index < len(expression) and expression[index] in _IDENTIFIER_CHARS:
                    index += 1
                identifier = expression[start:index]
                tokens.append(Token("IDENT", identifier))
                continue

            raise ValueError(f"Invalid character '{char}' in arithmetic expression")

        return tokens


def list_transform_types() -> list[dict[str, str]]:
    """Return supported transform types in UI display order."""

    plugin_transforms = [
        {"type": name, "label": name.replace("_", " ").title()}
        for name in sorted(get_transform_plugins())
    ]
    return [dict(item) for item in _TRANSFORM_TYPES] + plugin_transforms


def apply_transform(dataframe: pd.DataFrame, request: TransformRequest) -> pd.Series:
    """Build a computed column from the supplied request."""

    output_column = request.output_column.strip()
    if not output_column:
        raise ValueError("Output column name is required")
    if output_column in dataframe.columns:
        raise ValueError(f"Output column '{output_column}' already exists")

    transform_type = request.transform_type.strip().lower()
    source_column = request.source_column
    plugin_transform = get_transform_plugins().get(transform_type)

    if transform_type != "arithmetic" and source_column not in dataframe.columns:
        raise ValueError(f"Source column '{source_column}' not found")

    if transform_type == "log":
        series = _log_transform(dataframe[source_column], request.params)
    elif transform_type == "sqrt":
        series = _sqrt_transform(dataframe[source_column])
    elif transform_type == "zscore":
        series = _zscore_transform(dataframe[source_column])
    elif transform_type == "bin":
        series = _bin_transform(dataframe[source_column], request.params)
    elif transform_type == "recode":
        series = _recode_transform(dataframe[source_column], request.params)
    elif transform_type == "date_part":
        series = _date_part_transform(dataframe[source_column], request.params)
    elif transform_type == "arithmetic":
        expression = str(request.params.get("expression", "")).strip()
        series = ArithmeticParser(expression, dataframe).parse()
    elif plugin_transform is not None:
        plugin_result = plugin_transform(dataframe, request.params)
        if isinstance(plugin_result, pd.Series):
            series = plugin_result.copy()
        else:
            series = pd.Series(plugin_result, index=dataframe.index)

        if len(series) != len(dataframe):
            raise ValueError(
                f"Plugin transform '{request.transform_type}' returned {len(series)} rows; expected {len(dataframe)}"
            )

        if not series.index.equals(dataframe.index):
            series = pd.Series(series.to_numpy(), index=dataframe.index)
    else:
        raise ValueError(f"Unsupported transform type '{request.transform_type}'")

    return series.rename(output_column)


def apply_transform_to_session(session: DatasetSession, request: TransformRequest) -> pd.Series:
    """Apply a transform and persist the computed column on the session dataframe."""

    result = apply_transform(session.dataframe, request)
    column_name = str(result.name)
    session.dataframe[column_name] = result
    session.computed_columns.add(column_name)
    session.excluded_columns.discard(column_name)
    session.clear_analysis_artifacts()
    return session.dataframe[column_name]


def remove_computed_column(session: DatasetSession, column_name: str) -> None:
    """Remove a previously created computed column from the session."""

    if column_name not in session.dataframe.columns:
        raise ValueError(f"Column '{column_name}' not found")
    if column_name not in session.computed_columns:
        raise ValueError(f"Column '{column_name}' is not a computed column")

    session.dataframe.drop(columns=[column_name], inplace=True)
    session.computed_columns.discard(column_name)
    session.excluded_columns.discard(column_name)
    session.active_filters = [rule for rule in session.active_filters if rule.column != column_name]
    session.clear_analysis_artifacts()


def preview_values(series: pd.Series, limit: int = 10) -> list:
    """Convert a series preview into JSON-safe Python values."""

    records = json.loads(series.head(limit).to_frame(name="value").to_json(orient="records", date_format="iso"))
    return [record["value"] for record in records]


def _log_transform(series: pd.Series, params: dict[str, object]) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    positive = numeric.where(numeric > 0)
    base = params.get("base", "e")

    if base in {None, "e", "natural"}:
        return pd.Series(np.log(positive.to_numpy()), index=positive.index, dtype="float64")

    numeric_base = float(cast(Any, base))
    if numeric_base <= 0 or numeric_base == 1:
        raise ValueError("Log base must be positive and not equal to 1")
    if numeric_base == 10:
        return pd.Series(np.log10(positive.to_numpy()), index=positive.index, dtype="float64")
    return pd.Series(np.log(positive.to_numpy()) / np.log(numeric_base), index=positive.index, dtype="float64")


def _sqrt_transform(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    safe_numeric = numeric.where(numeric >= 0)
    return pd.Series(np.sqrt(safe_numeric.to_numpy()), index=safe_numeric.index, dtype="float64")


def _zscore_transform(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    std = numeric.std(ddof=0)
    if pd.isna(std) or float(std) == 0.0:
        return pd.Series(np.where(numeric.notna(), 0.0, np.nan), index=series.index, dtype="float64")
    return (numeric - numeric.mean()) / std


def _bin_transform(series: pd.Series, params: dict[str, object]) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    bins = params.get("bins", params.get("count"))
    if bins is None:
        raise ValueError("Bin transform requires 'bins' or 'count'")
    typed_bins = cast(int | Sequence[float], bins)
    raw_labels = params.get("labels")
    labels = cast(Sequence[Any] | None, raw_labels)
    include_lowest = bool(params.get("include_lowest", True))
    return pd.cut(numeric, bins=typed_bins, labels=labels, include_lowest=include_lowest)


def _recode_transform(series: pd.Series, params: dict[str, object]) -> pd.Series:
    mapping = params.get("mapping")
    if not isinstance(mapping, dict):
        raise ValueError("Recode transform requires a 'mapping' object")

    recoded = series.map(mapping)
    if "default" in params:
        return recoded.fillna(cast(Any, params["default"]))
    return recoded.where(recoded.notna(), series)


def _date_part_transform(series: pd.Series, params: dict[str, object]) -> pd.Series:
    datetimes = pd.to_datetime(series, errors="coerce", format="mixed")
    part = str(params.get("part", "")).strip().lower()

    if part == "year":
        return datetimes.dt.year.astype("Int64")
    if part == "month":
        return datetimes.dt.month.astype("Int64")
    if part == "day":
        return datetimes.dt.day.astype("Int64")
    if part == "weekday":
        return datetimes.dt.weekday.astype("Int64")
    if part == "quarter":
        return datetimes.dt.quarter.astype("Int64")

    raise ValueError(f"Unsupported date part '{part}'")

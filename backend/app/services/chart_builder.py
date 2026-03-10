"""Chart builder service for EDA endpoints.

Builds Plotly-compatible JSON figure specs (dicts) without using plotly-python.
"""

from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd

from app.models.eda import ChartRequest

OKABE_ITO_COLORWAY = [
    "#E69F00",
    "#56B4E9",
    "#009E73",
    "#F0E442",
    "#0072B2",
    "#D55E00",
    "#CC79A7",
    "#000000",
]

SUPPORTED_CHART_TYPES = {"histogram", "scatter", "box", "bar", "line"}
WEBGL_THRESHOLD = 10_000


def _as_json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)

    item_method = getattr(value, "item", None)
    if callable(item_method):
        try:
            return item_method()
        except (TypeError, ValueError):
            pass

    iso_method = getattr(value, "isoformat", None)
    if callable(iso_method):
        return iso_method()

    return str(value)


def _to_json_list(values: Sequence[Any]) -> list[Any]:
    return [_as_json_value(v) for v in values]


def _validate_chart_request(df: pd.DataFrame, request: ChartRequest) -> None:
    if request.chart_type not in SUPPORTED_CHART_TYPES:
        raise ValueError(f"Unsupported chart_type '{request.chart_type}'")

    required_by_type: dict[str, set[str]] = {
        "histogram": {"x"},
        "scatter": {"x", "y"},
        "box": {"y"},
        "bar": {"x"},
        "line": {"x", "y"},
    }

    required_fields = required_by_type[request.chart_type]
    for field_name in required_fields:
        value = getattr(request, field_name)
        if not value:
            raise ValueError(f"'{field_name}' is required for chart_type '{request.chart_type}'")

    provided_columns = [request.x, request.y, request.color, request.facet]
    for column in provided_columns:
        if column and column not in df.columns:
            raise ValueError(f"Column '{column}' not found")


def _make_layout(title: str, x_title: str | None, y_title: str | None, barmode: str | None = None) -> dict[str, Any]:
    layout: dict[str, Any] = {
        "title": {"text": title},
        "template": "plotly_white",
        "colorway": OKABE_ITO_COLORWAY,
        "xaxis": {"title": {"text": x_title or ""}},
        "yaxis": {"title": {"text": y_title or ""}},
    }
    if barmode:
        layout["barmode"] = barmode
    return layout


def _build_histogram(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x] + ([request.color] if request.color else [])
    filtered = df[cols].dropna()

    traces: list[dict[str, Any]] = []
    if request.color:
        for color_value, group in filtered.groupby(request.color, dropna=True):
            trace: dict[str, Any] = {
                "type": "histogram",
                "name": str(color_value),
                "x": _to_json_list(group[request.x].tolist()),
            }
            if request.nbins:
                trace["nbinsx"] = request.nbins
            traces.append(trace)
    else:
        trace = {
            "type": "histogram",
            "x": _to_json_list(filtered[request.x].tolist()),
        }
        if request.nbins:
            trace["nbinsx"] = request.nbins
        traces.append(trace)

    layout = _make_layout(
        title=f"Histogram: {request.x}",
        x_title=request.x,
        y_title="Count",
    )
    return traces, len(filtered), False, layout


def _build_scatter(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x, request.y] + ([request.color] if request.color else [])
    filtered = df[cols].dropna()
    use_webgl = len(filtered) > WEBGL_THRESHOLD
    trace_type = "scattergl" if use_webgl else "scatter"

    traces: list[dict[str, Any]] = []
    if request.color:
        for color_value, group in filtered.groupby(request.color, dropna=True):
            traces.append(
                {
                    "type": trace_type,
                    "mode": "markers",
                    "name": str(color_value),
                    "x": _to_json_list(group[request.x].tolist()),
                    "y": _to_json_list(group[request.y].tolist()),
                }
            )
    else:
        traces.append(
            {
                "type": trace_type,
                "mode": "markers",
                "x": _to_json_list(filtered[request.x].tolist()),
                "y": _to_json_list(filtered[request.y].tolist()),
            }
        )

    layout = _make_layout(
        title=f"Scatter: {request.y} vs {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return traces, len(filtered), use_webgl, layout


def _build_box(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.y] + ([request.color] if request.color else [])
    filtered = df[cols].dropna()

    traces: list[dict[str, Any]] = []
    if request.color:
        for color_value, group in filtered.groupby(request.color, dropna=True):
            y_values = _to_json_list(group[request.y].tolist())
            traces.append(
                {
                    "type": "box",
                    "name": str(color_value),
                    "x": [str(color_value)] * len(y_values),
                    "y": y_values,
                }
            )
    else:
        traces.append(
            {
                "type": "box",
                "y": _to_json_list(filtered[request.y].tolist()),
            }
        )

    x_axis_title = request.color if request.color else ""
    layout = _make_layout(
        title=f"Box Plot: {request.y}",
        x_title=x_axis_title,
        y_title=request.y,
    )
    return traces, len(filtered), False, layout


def _build_bar(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x] + ([request.y] if request.y else []) + ([request.color] if request.color else [])
    filtered = df[cols].dropna()

    traces: list[dict[str, Any]] = []

    if request.color:
        group_cols = [request.x, request.color]
        if request.y:
            aggregated = filtered.groupby(group_cols, dropna=True)[request.y].mean().reset_index(name="value")
            y_title = f"Mean of {request.y}"
        else:
            aggregated = filtered.groupby(group_cols, dropna=True).size().reset_index(name="value")
            y_title = "Count"

        for color_value, group in aggregated.groupby(request.color, dropna=True):
            traces.append(
                {
                    "type": "bar",
                    "name": str(color_value),
                    "x": _to_json_list(group[request.x].tolist()),
                    "y": _to_json_list(group["value"].tolist()),
                }
            )
        layout = _make_layout(
            title=f"Bar: {request.x}" + (f" by {request.color}" if request.color else ""),
            x_title=request.x,
            y_title=y_title,
            barmode="group",
        )
    else:
        if request.y:
            aggregated = filtered.groupby(request.x, dropna=True)[request.y].mean().reset_index(name="value")
            y_title = f"Mean of {request.y}"
        else:
            aggregated = filtered.groupby(request.x, dropna=True).size().reset_index(name="value")
            y_title = "Count"

        traces.append(
            {
                "type": "bar",
                "x": _to_json_list(aggregated[request.x].tolist()),
                "y": _to_json_list(aggregated["value"].tolist()),
            }
        )
        layout = _make_layout(
            title=f"Bar: {request.x}",
            x_title=request.x,
            y_title=y_title,
        )

    return traces, len(filtered), False, layout


def _build_line(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x, request.y] + ([request.color] if request.color else [])
    filtered = df[cols].dropna()
    use_webgl = len(filtered) > WEBGL_THRESHOLD
    trace_type = "scattergl" if use_webgl else "scatter"

    traces: list[dict[str, Any]] = []
    if request.color:
        for color_value, group in filtered.groupby(request.color, dropna=True):
            sorted_group = group.sort_values(by=request.x)
            traces.append(
                {
                    "type": trace_type,
                    "mode": "lines",
                    "name": str(color_value),
                    "x": _to_json_list(sorted_group[request.x].tolist()),
                    "y": _to_json_list(sorted_group[request.y].tolist()),
                }
            )
    else:
        sorted_df = filtered.sort_values(by=request.x)
        traces.append(
            {
                "type": trace_type,
                "mode": "lines",
                "x": _to_json_list(sorted_df[request.x].tolist()),
                "y": _to_json_list(sorted_df[request.y].tolist()),
            }
        )

    layout = _make_layout(
        title=f"Line: {request.y} over {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return traces, len(filtered), use_webgl, layout


def build_chart_figure(df: pd.DataFrame, request: ChartRequest) -> tuple[dict[str, Any], int, bool]:
    """Build a Plotly-compatible figure dictionary from a DataFrame and request."""

    _validate_chart_request(df, request)

    if request.chart_type == "histogram":
        traces, row_count, webgl, layout = _build_histogram(df, request)
    elif request.chart_type == "scatter":
        traces, row_count, webgl, layout = _build_scatter(df, request)
    elif request.chart_type == "box":
        traces, row_count, webgl, layout = _build_box(df, request)
    elif request.chart_type == "bar":
        traces, row_count, webgl, layout = _build_bar(df, request)
    else:  # request.chart_type == "line"
        traces, row_count, webgl, layout = _build_line(df, request)

    return {"data": traces, "layout": layout}, row_count, webgl

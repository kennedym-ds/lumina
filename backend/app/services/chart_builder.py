"""Chart builder service for EDA endpoints.

Builds Plotly-compatible JSON figure specs (dicts) without using plotly-python.
"""

from collections.abc import Callable, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd
from scipy import stats

from app.models.eda import ChartRequest
from app.services.downsampling import lttb_downsample
from app.services.plugin_loader import get_chart_plugins

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

SUPPORTED_CHART_TYPES = {
    "histogram",
    "scatter",
    "box",
    "bar",
    "line",
    "violin",
    "heatmap",
    "density",
    "pie",
    "area",
    "qq_plot",
}
WEBGL_THRESHOLD = 10_000
DOWNSAMPLE_THRESHOLD = 10_000
MAX_FACET_VALUES = 12
TOP_PIE_CATEGORIES = 20

ChartBuilderResult = tuple[list[dict[str, Any]], int, bool, dict[str, Any]]
ChartBuilder = Callable[[pd.DataFrame, ChartRequest], ChartBuilderResult]


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


def _to_json_matrix(rows: Sequence[Sequence[Any]]) -> list[list[Any]]:
    return [[_as_json_value(value) for value in row] for row in rows]


def _coerce_numeric_series(series: pd.Series, column_name: str) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.isna().any():
        raise ValueError(f"Column '{column_name}' must be numeric")
    return numeric.astype(float)


def _make_pie_layout(title: str) -> dict[str, Any]:
    return {
        "title": {"text": title},
        "template": "plotly_white",
        "colorway": OKABE_ITO_COLORWAY,
        "showlegend": True,
    }


def _validate_chart_request(df: pd.DataFrame, request: ChartRequest) -> None:
    supported_chart_types = SUPPORTED_CHART_TYPES | set(get_chart_plugins())
    if request.chart_type not in supported_chart_types:
        raise ValueError(f"Unsupported chart_type '{request.chart_type}'")

    required_by_type: dict[str, set[str]] = {
        "histogram": {"x"},
        "scatter": {"x", "y"},
        "box": {"y"},
        "bar": {"x"},
        "line": {"x", "y"},
        "violin": {"y"},
        "heatmap": {"x", "y"},
        "density": {"x", "y"},
        "pie": {"x"},
        "area": {"x", "y"},
        "qq_plot": {"x"},
    }

    required_fields = required_by_type.get(request.chart_type, set())
    for field_name in required_fields:
        value = getattr(request, field_name)
        if not value:
            raise ValueError(f"'{field_name}' is required for chart_type '{request.chart_type}'")

    provided_columns = [request.x, request.y, request.color, request.facet, request.values]
    for column in provided_columns:
        if column and column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

    if request.chart_type == "heatmap":
        aggregation = request.aggregation or "count"
        if aggregation not in {"count", "sum", "mean"}:
            raise ValueError("Heatmap aggregation must be one of: count, sum, mean")
        if aggregation in {"sum", "mean"} and not request.values:
            raise ValueError(f"'values' is required for heatmap aggregation '{aggregation}'")


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
                    "customdata": _to_json_list(group.index.tolist()),
                }
            )
    else:
        traces.append(
            {
                "type": trace_type,
                "mode": "markers",
                "x": _to_json_list(filtered[request.x].tolist()),
                "y": _to_json_list(filtered[request.y].tolist()),
                "customdata": _to_json_list(filtered.index.tolist()),
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


def _build_violin(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.y] + ([request.color] if request.color else [])
    filtered = df[cols].dropna()

    traces: list[dict[str, Any]] = []
    if request.color:
        for color_value, group in filtered.groupby(request.color, dropna=True):
            y_values = _to_json_list(group[request.y].tolist())
            traces.append(
                {
                    "type": "violin",
                    "name": str(color_value),
                    "x": [str(color_value)] * len(y_values),
                    "y": y_values,
                }
            )
    else:
        traces.append(
            {
                "type": "violin",
                "y": _to_json_list(filtered[request.y].tolist()),
            }
        )

    layout = _make_layout(
        title=f"Violin Plot: {request.y}",
        x_title=request.color or "",
        y_title=request.y,
    )
    if request.color:
        layout["violinmode"] = "group"

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
                    "customdata": _to_json_list(sorted_group.index.tolist()),
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
                "customdata": _to_json_list(sorted_df.index.tolist()),
            }
        )

    layout = _make_layout(
        title=f"Line: {request.y} over {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return traces, len(filtered), use_webgl, layout


def _build_heatmap(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x, request.y] + ([request.values] if request.values else [])
    filtered = df[cols].dropna()
    aggregation = request.aggregation or "count"

    if aggregation == "count":
        matrix = pd.crosstab(filtered[request.y], filtered[request.x])
    else:
        values = _coerce_numeric_series(filtered[request.values], request.values)
        aggregated = filtered.assign(__values=values)
        matrix = aggregated.pivot_table(
            index=request.y,
            columns=request.x,
            values="__values",
            aggfunc=aggregation,
            fill_value=0.0,
        )

    trace = {
        "type": "heatmap",
        "x": _to_json_list(matrix.columns.tolist()),
        "y": _to_json_list(matrix.index.tolist()),
        "z": _to_json_matrix(matrix.to_numpy().tolist()),
        "colorscale": "Viridis",
    }
    layout = _make_layout(
        title=f"Heatmap: {request.y} vs {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return [trace], len(filtered), False, layout


def _build_density(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    filtered = df[[request.x, request.y]].dropna()
    x_values = _coerce_numeric_series(filtered[request.x], request.x)
    y_values = _coerce_numeric_series(filtered[request.y], request.y)

    trace = {
        "type": "histogram2dcontour",
        "x": _to_json_list(x_values.tolist()),
        "y": _to_json_list(y_values.tolist()),
        "colorscale": "Blues",
        "showscale": True,
    }
    layout = _make_layout(
        title=f"Density: {request.y} vs {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return [trace], len(filtered), False, layout


def _build_pie(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    cols = [request.x] + ([request.values] if request.values else [])
    filtered = df[cols].dropna()

    if request.values:
        values = _coerce_numeric_series(filtered[request.values], request.values)
        aggregated = (
            filtered.assign(__values=values)
            .groupby(request.x, dropna=True)["__values"]
            .sum()
            .reset_index(name="value")
        )
    else:
        aggregated = filtered.groupby(request.x, dropna=True).size().reset_index(name="value")

    aggregated["label"] = aggregated[request.x].map(lambda value: str(_as_json_value(value)))
    aggregated = aggregated.sort_values(by=["value", "label"], ascending=[False, True]).reset_index(drop=True)

    if len(aggregated) > TOP_PIE_CATEGORIES:
        top = aggregated.iloc[:TOP_PIE_CATEGORIES].copy()
        other_value = aggregated.iloc[TOP_PIE_CATEGORIES:]["value"].sum()
        aggregated = pd.concat(
            [
                top,
                pd.DataFrame([{request.x: "Other", "value": other_value, "label": "Other"}]),
            ],
            ignore_index=True,
        )

    trace = {
        "type": "pie",
        "labels": aggregated["label"].tolist(),
        "values": _to_json_list(aggregated["value"].tolist()),
    }
    layout = _make_pie_layout(title=f"Pie: {request.x}")
    return [trace], len(filtered), False, layout


def _build_area(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
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
                    "customdata": _to_json_list(sorted_group.index.tolist()),
                    "fill": "tozeroy",
                    "stackgroup": "one",
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
                "customdata": _to_json_list(sorted_df.index.tolist()),
                "fill": "tozeroy",
            }
        )

    layout = _make_layout(
        title=f"Area: {request.y} over {request.x}",
        x_title=request.x,
        y_title=request.y,
    )
    return traces, len(filtered), use_webgl, layout


def _build_qq_plot(df: pd.DataFrame, request: ChartRequest) -> tuple[list[dict[str, Any]], int, bool, dict[str, Any]]:
    filtered = df[[request.x]].dropna()
    values = _coerce_numeric_series(filtered[request.x], request.x)

    theoretical, ordered = stats.probplot(values.tolist(), dist="norm", fit=False)
    _, (slope, intercept, _) = stats.probplot(values.tolist(), dist="norm")
    line_x = [float(theoretical[0]), float(theoretical[-1])] if len(theoretical) else []
    line_y = [intercept + slope * point for point in line_x]

    traces = [
        {
            "type": "scatter",
            "mode": "markers",
            "name": "Sample Quantiles",
            "x": _to_json_list(list(theoretical)),
            "y": _to_json_list(list(ordered)),
        },
        {
            "type": "scatter",
            "mode": "lines",
            "name": "Reference Line",
            "x": _to_json_list(line_x),
            "y": _to_json_list(line_y),
        },
    ]
    layout = _make_layout(
        title=f"QQ Plot: {request.x}",
        x_title="Theoretical Quantiles",
        y_title="Sample Quantiles",
    )
    return traces, len(filtered), False, layout


def _apply_faceting(
    df: pd.DataFrame,
    request: ChartRequest,
    builder_fn: ChartBuilder,
) -> tuple[dict[str, Any], int, bool, list[str]]:
    """Wrap a chart builder to produce faceted subplot output."""

    if request.facet is None:
        traces, row_count, webgl, layout = builder_fn(df, request)
        return {"data": traces, "layout": layout}, row_count, webgl, []

    facet_col = request.facet
    unique_values = df[facet_col].dropna().unique().tolist()
    facet_values = sorted(unique_values, key=lambda value: str(_as_json_value(value)))[:MAX_FACET_VALUES]

    warnings: list[str] = []
    if len(unique_values) > MAX_FACET_VALUES:
        warnings.append(
            f"Facet column '{facet_col}' has {len(unique_values)} unique values; "
            f"showing first {MAX_FACET_VALUES}"
        )

    unfaceted_request = request.model_copy(update={"facet": None})
    if not facet_values:
        traces, row_count, webgl, layout = builder_fn(df, unfaceted_request)
        return {"data": traces, "layout": layout}, row_count, webgl, warnings

    n_facets = len(facet_values)
    n_cols = min(n_facets, 4)
    n_rows = (n_facets + n_cols - 1) // n_cols

    all_traces: list[dict[str, Any]] = []
    total_rows = 0
    any_webgl = False
    base_layout: dict[str, Any] | None = None

    for idx, facet_value in enumerate(facet_values):
        subset = df[df[facet_col] == facet_value]
        traces, row_count, webgl, layout = builder_fn(subset, unfaceted_request)

        if base_layout is None:
            base_layout = layout

        total_rows += row_count
        any_webgl = any_webgl or webgl

        axis_number = idx + 1
        x_ref = f"x{axis_number}" if axis_number > 1 else "x"
        y_ref = f"y{axis_number}" if axis_number > 1 else "y"

        for trace in traces:
            faceted_trace = trace.copy()
            faceted_trace["xaxis"] = x_ref
            faceted_trace["yaxis"] = y_ref
            if idx > 0:
                faceted_trace["showlegend"] = False
            all_traces.append(faceted_trace)

    assert base_layout is not None

    h_spacing = 0.05
    v_spacing = 0.08
    plot_width = (1.0 - h_spacing * (n_cols - 1)) / n_cols
    plot_height = (1.0 - v_spacing * (n_rows - 1)) / n_rows

    base_x_title = base_layout.get("xaxis", {}).get("title", {}).get("text", "")
    base_y_title = base_layout.get("yaxis", {}).get("title", {}).get("text", "")
    base_title = base_layout.get("title", {}).get("text", request.chart_type.title())

    layout: dict[str, Any] = {
        "title": {"text": f"{base_title} — faceted by {facet_col}"},
        "template": base_layout.get("template", "plotly_white"),
        "colorway": base_layout.get("colorway", OKABE_ITO_COLORWAY),
        "annotations": [],
        "height": max(420, 320 * n_rows),
    }
    if "barmode" in base_layout:
        layout["barmode"] = base_layout["barmode"]

    for idx, facet_value in enumerate(facet_values):
        row_idx = idx // n_cols
        col_idx = idx % n_cols
        axis_number = idx + 1
        x_key = f"xaxis{axis_number}" if axis_number > 1 else "xaxis"
        y_key = f"yaxis{axis_number}" if axis_number > 1 else "yaxis"

        x0 = col_idx * (plot_width + h_spacing)
        x1 = x0 + plot_width
        y1 = 1.0 - row_idx * (plot_height + v_spacing)
        y0 = y1 - plot_height

        layout[x_key] = {
            "domain": [x0, x1],
            "title": {"text": base_x_title},
            "anchor": f"y{axis_number}" if axis_number > 1 else "y",
        }
        layout[y_key] = {
            "domain": [y0, y1],
            "title": {"text": base_y_title},
            "anchor": f"x{axis_number}" if axis_number > 1 else "x",
        }
        layout["annotations"].append(
            {
                "text": f"<b>{_as_json_value(facet_value)}</b>",
                "x": (x0 + x1) / 2,
                "y": min(1.0, y1 + 0.03),
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 12},
            }
        )

    return {"data": all_traces, "layout": layout}, total_rows, any_webgl, warnings


def _apply_downsampling(
    figure: dict[str, Any], chart_type: str, warnings: list[str]
) -> tuple[bool, int | None]:
    """Apply LTTB downsampling to scatter/line chart traces when point count exceeds threshold."""

    if chart_type not in ("scatter", "line"):
        return False, None

    traces = figure.get("data", [])
    total_points = sum(len(trace.get("x", [])) for trace in traces)

    if total_points <= DOWNSAMPLE_THRESHOLD:
        return False, None

    displayed = 0
    for trace in traces:
        x = trace.get("x", [])
        y = trace.get("y", [])
        if not x or not y or len(x) != len(y):
            displayed += len(x)
            continue

        per_trace = max(100, int(DOWNSAMPLE_THRESHOLD * len(x) / total_points))
        try:
            sampled_x, sampled_y = lttb_downsample(x, y, per_trace)
        except (ValueError, TypeError):
            displayed += len(x)
            continue

        trace["x"] = sampled_x
        trace["y"] = sampled_y
        # LTTB currently returns sampled values but not the originating row indices,
        # so any row-level customdata would be incorrect after downsampling.
        trace.pop("customdata", None)
        displayed += len(sampled_x)

    warnings.append(
        f"Downsampled from {total_points:,} to {displayed:,} points for performance"
    )
    return True, displayed


def build_chart_figure(
    df: pd.DataFrame, request: ChartRequest
) -> tuple[dict[str, Any], int, bool, list[str], bool, int | None]:
    """Build a Plotly-compatible figure dictionary from a DataFrame and request."""

    _validate_chart_request(df, request)

    builders: dict[str, ChartBuilder] = {
        "histogram": _build_histogram,
        "scatter": _build_scatter,
        "box": _build_box,
        "bar": _build_bar,
        "line": _build_line,
        "violin": _build_violin,
        "heatmap": _build_heatmap,
        "density": _build_density,
        "pie": _build_pie,
        "area": _build_area,
        "qq_plot": _build_qq_plot,
    }
    builders.update(get_chart_plugins())
    builder_fn = builders.get(request.chart_type)
    if builder_fn is None:
        raise ValueError(f"Unsupported chart_type '{request.chart_type}'")

    if request.facet:
        figure, row_count, webgl, warnings = _apply_faceting(df, request, builder_fn)
        downsampled, displayed_count = _apply_downsampling(figure, request.chart_type, warnings)
        return figure, row_count, webgl, warnings, downsampled, displayed_count

    traces, row_count, webgl, layout = builder_fn(df, request)
    figure = {"data": traces, "layout": layout}
    warnings: list[str] = []
    downsampled, displayed_count = _apply_downsampling(figure, request.chart_type, warnings)
    return figure, row_count, webgl, warnings, downsampled, displayed_count

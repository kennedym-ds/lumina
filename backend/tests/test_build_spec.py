"""Tests for the PyInstaller spec used to build the backend sidecar."""

from __future__ import annotations

import ast
from pathlib import Path

import pandas as pd
import pytest

from app.models.eda import ChartRequest
from app.services.chart_builder import build_chart_figure


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = BACKEND_ROOT / "lumina-backend.spec"
REQUIREMENTS_PATH = BACKEND_ROOT / "requirements.txt"


def _parse_spec() -> ast.Module:
    spec_text = SPEC_PATH.read_text(encoding="utf-8")
    return ast.parse(spec_text)


def _extract_string_list(module: ast.Module, variable_name: str) -> list[str]:
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue

        if len(node.targets) != 1:
            continue

        target = node.targets[0]
        if not isinstance(target, ast.Name) or target.id != variable_name:
            continue

        if not isinstance(node.value, (ast.List, ast.Tuple)):
            return []

        values: list[str] = []
        for element in node.value.elts:
            if isinstance(element, ast.Constant) and isinstance(element.value, str):
                values.append(element.value)
        return values

    return []


def test_spec_file_is_valid_python() -> None:
    assert SPEC_PATH.exists(), f"Expected spec file at {SPEC_PATH}"
    _parse_spec()


def test_spec_file_exists_and_is_valid_python() -> None:
    test_spec_file_is_valid_python()


def test_spec_hidden_import_roots_cover_critical_packages() -> None:
    module = _parse_spec()
    hidden_import_roots = set(_extract_string_list(module, "HIDDEN_IMPORT_ROOTS"))

    expected_roots = {
        "fastapi",
        "uvicorn",
        "pandas",
        "pyarrow",
        "scipy",
        "statsmodels",
        "sklearn",
        "openpyxl",
        "plotly",
        "kaleido",
    }

    missing = expected_roots - hidden_import_roots
    assert not missing, f"Missing hidden import roots in spec: {sorted(missing)}"


def test_spec_sample_data_file_declarations_cover_csv_bundle() -> None:
    module = _parse_spec()
    sample_csvs = set(_extract_string_list(module, "SAMPLE_CSV_FILENAMES"))

    expected_csvs = {
        "iris.csv",
        "palmer_penguins.csv",
        "titanic.csv",
    }

    missing_csvs = expected_csvs - sample_csvs
    assert not missing_csvs, f"Missing sample CSV declarations in spec: {sorted(missing_csvs)}"

    constant_strings = {
        node.value
        for node in ast.walk(module)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    assert "app/data/samples" in constant_strings


def test_scipy_in_requirements() -> None:
    assert REQUIREMENTS_PATH.exists(), f"Expected requirements file at {REQUIREMENTS_PATH}"
    content = REQUIREMENTS_PATH.read_text(encoding="utf-8")
    assert "scipy" in content


def _build_chart(df: pd.DataFrame, request: ChartRequest) -> tuple[dict, int, bool, list[str], bool, int | None]:
    return build_chart_figure(df, request)


def test_violin_basic() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0, 3.5, 4.0]})

    figure, row_count, webgl, warnings, downsampled, displayed = _build_chart(
        df,
        ChartRequest(chart_type="violin", y="value"),
    )

    assert row_count == 4
    assert webgl is False
    assert warnings == []
    assert downsampled is False
    assert displayed is None
    assert len(figure["data"]) == 1
    assert figure["data"][0]["type"] == "violin"
    assert figure["data"][0]["y"] == [1.0, 2.0, 3.5, 4.0]


def test_violin_with_color() -> None:
    df = pd.DataFrame(
        {
            "value": [1.0, 2.0, 3.5, 4.0],
            "group": ["A", "A", "B", "B"],
        }
    )

    figure, *_ = _build_chart(
        df,
        ChartRequest(chart_type="violin", y="value", color="group"),
    )

    assert len(figure["data"]) == 2
    assert {trace["name"] for trace in figure["data"]} == {"A", "B"}
    assert all(trace["type"] == "violin" for trace in figure["data"])
    assert figure["layout"]["violinmode"] == "group"


def test_heatmap_basic() -> None:
    df = pd.DataFrame(
        {
            "x": ["A", "A", "B", "B", "B"],
            "y": ["K", "L", "K", "L", "L"],
        }
    )

    figure, row_count, *_ = _build_chart(
        df,
        ChartRequest(chart_type="heatmap", x="x", y="y"),
    )

    trace = figure["data"][0]
    assert row_count == 5
    assert trace["type"] == "heatmap"
    assert trace["colorscale"] == "Viridis"
    assert trace["x"] == ["A", "B"]
    assert trace["y"] == ["K", "L"]
    assert trace["z"] == [[1, 1], [1, 2]]


def test_heatmap_aggregation() -> None:
    df = pd.DataFrame(
        {
            "x": ["A", "A", "B", "B"],
            "y": ["K", "K", "K", "L"],
            "metric": [2.0, 4.0, 6.0, 8.0],
        }
    )

    figure, *_ = _build_chart(
        df,
        ChartRequest(
            chart_type="heatmap",
            x="x",
            y="y",
            values="metric",
            aggregation="mean",
        ),
    )

    trace = figure["data"][0]
    assert trace["z"] == [[3.0, 6.0], [0.0, 8.0]]


def test_density_basic() -> None:
    df = pd.DataFrame({"x": [1.0, 2.0, 3.0, 4.0], "y": [4.0, 3.0, 2.0, 1.0]})

    figure, row_count, webgl, warnings, downsampled, displayed = _build_chart(
        df,
        ChartRequest(chart_type="density", x="x", y="y"),
    )

    trace = figure["data"][0]
    assert row_count == 4
    assert webgl is False
    assert warnings == []
    assert downsampled is False
    assert displayed is None
    assert trace["type"] == "histogram2dcontour"
    assert trace["colorscale"] == "Blues"
    assert trace["showscale"] is True


def test_density_non_numeric_error() -> None:
    df = pd.DataFrame({"x": ["a", "b", "c"], "y": [1.0, 2.0, 3.0]})

    with pytest.raises(ValueError, match="must be numeric"):
        _build_chart(df, ChartRequest(chart_type="density", x="x", y="y"))


def test_pie_basic() -> None:
    df = pd.DataFrame({"category": ["A", "A", "B", "C"]})

    figure, row_count, *_ = _build_chart(
        df,
        ChartRequest(chart_type="pie", x="category"),
    )

    trace = figure["data"][0]
    assert row_count == 4
    assert trace["type"] == "pie"
    assert trace["labels"] == ["A", "B", "C"]
    assert trace["values"] == [2, 1, 1]
    assert "xaxis" not in figure["layout"]
    assert "yaxis" not in figure["layout"]


def test_pie_top_20_cap() -> None:
    categories = [f"cat_{index}" for index in range(22)]
    df = pd.DataFrame({"category": categories})

    figure, *_ = _build_chart(
        df,
        ChartRequest(chart_type="pie", x="category"),
    )

    trace = figure["data"][0]
    assert len(trace["labels"]) == 21
    assert trace["labels"][-1] == "Other"
    assert trace["values"][-1] == 2


def test_area_basic() -> None:
    df = pd.DataFrame({"x": [3, 1, 2], "y": [30.0, 10.0, 20.0]})

    figure, row_count, webgl, warnings, downsampled, displayed = _build_chart(
        df,
        ChartRequest(chart_type="area", x="x", y="y"),
    )

    trace = figure["data"][0]
    assert row_count == 3
    assert webgl is False
    assert warnings == []
    assert downsampled is False
    assert displayed is None
    assert trace["type"] == "scatter"
    assert trace["mode"] == "lines"
    assert trace["fill"] == "tozeroy"
    assert trace["x"] == [1, 2, 3]


def test_area_with_color() -> None:
    df = pd.DataFrame(
        {
            "x": [1, 2, 1, 2],
            "y": [5.0, 6.0, 7.0, 8.0],
            "group": ["A", "A", "B", "B"],
        }
    )

    figure, *_ = _build_chart(
        df,
        ChartRequest(chart_type="area", x="x", y="y", color="group"),
    )

    assert len(figure["data"]) == 2
    assert all(trace["stackgroup"] == "one" for trace in figure["data"])
    assert all(trace["fill"] == "tozeroy" for trace in figure["data"])


def test_qq_plot_basic() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 4.0, 5.0]})

    figure, row_count, webgl, warnings, downsampled, displayed = _build_chart(
        df,
        ChartRequest(chart_type="qq_plot", x="value"),
    )

    assert row_count == 5
    assert webgl is False
    assert warnings == []
    assert downsampled is False
    assert displayed is None
    assert len(figure["data"]) == 2
    assert figure["data"][0]["type"] == "scatter"
    assert figure["data"][0]["mode"] == "markers"
    assert figure["data"][1]["type"] == "scatter"
    assert figure["data"][1]["mode"] == "lines"
    assert figure["layout"]["xaxis"]["title"]["text"] == "Theoretical Quantiles"
    assert figure["layout"]["yaxis"]["title"]["text"] == "Sample Quantiles"


def test_qq_plot_non_numeric_error() -> None:
    df = pd.DataFrame({"value": ["a", "b", "c"]})

    with pytest.raises(ValueError, match="must be numeric"):
        _build_chart(df, ChartRequest(chart_type="qq_plot", x="value"))

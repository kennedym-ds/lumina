"""Tests for the backend plugin architecture."""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

import pandas as pd

from app.models.eda import ChartRequest
from app.models.transforms import TransformRequest
from app.services.chart_builder import build_chart_figure
from app.services.plugin_loader import (
    clear_plugins,
    get_chart_plugins,
    get_test_plugins,
    get_transform_plugins,
    load_plugins,
    register_chart_type,
    register_test,
    register_transform,
)
from app.services.transforms import apply_transform, list_transform_types


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("plugins.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_register_chart_type() -> None:
    clear_plugins()

    @register_chart_type("custom_chart")
    def my_chart(df, request):
        return [], 0, False, {}

    assert "custom_chart" in get_chart_plugins()
    clear_plugins()


def test_register_transform() -> None:
    clear_plugins()

    @register_transform("custom_transform")
    def my_transform(df, params):
        return df

    assert "custom_transform" in get_transform_plugins()
    clear_plugins()


def test_register_test() -> None:
    clear_plugins()

    @register_test("custom_test")
    def my_test(df, params):
        return {"ok": True}

    assert "custom_test" in get_test_plugins()
    clear_plugins()


def test_load_plugins_from_directory() -> None:
    clear_plugins()
    with tempfile.TemporaryDirectory() as tmpdir:
        plugin_file = Path(tmpdir) / "my_plugin.py"
        plugin_file.write_text(
            "from app.services.plugin_loader import register_chart_type\n"
            "@register_chart_type('test_plugin_chart')\n"
            "def build(df, request):\n"
            "    return [], 0, False, {}\n",
            encoding="utf-8",
        )
        result = load_plugins(tmpdir)
        assert "test_plugin_chart" in result["charts"]
    clear_plugins()


def test_load_plugins_nonexistent_dir() -> None:
    clear_plugins()
    result = load_plugins("/nonexistent/path")
    assert result == {"charts": [], "transforms": [], "tests": []}


def test_load_plugins_skips_underscore_files() -> None:
    clear_plugins()
    with tempfile.TemporaryDirectory() as tmpdir:
        (Path(tmpdir) / "_private.py").write_text("x = 1", encoding="utf-8")
        result = load_plugins(tmpdir)
        assert result == {"charts": [], "transforms": [], "tests": []}
    clear_plugins()


def test_plugin_chart_builder_is_available_to_chart_service() -> None:
    clear_plugins()

    @register_chart_type("custom_chart")
    def custom_chart(df, request):
        return (
            [{"type": "scatter", "mode": "lines", "x": [0, 1], "y": [1.0, 2.0]}],
            len(df),
            False,
            {"title": {"text": "Custom chart"}},
        )

    dataframe = pd.DataFrame({"value": [1.0, 2.0]})
    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(
        dataframe,
        ChartRequest(chart_type="custom_chart"),
    )

    assert row_count == 2
    assert webgl is False
    assert warnings == []
    assert downsampled is False
    assert displayed is None
    assert figure["data"][0]["type"] == "scatter"
    assert figure["layout"]["title"]["text"] == "Custom chart"
    clear_plugins()


def test_plugin_transform_is_listed_and_executable() -> None:
    clear_plugins()

    @register_transform("custom_transform")
    def custom_transform(df, params):
        return pd.Series([value * 2 for value in df["value"]], index=df.index, dtype="float64")

    transform_names = [item["type"] for item in list_transform_types()]
    assert "custom_transform" in transform_names

    result = apply_transform(
        pd.DataFrame({"value": [1.0, 2.0, 3.0]}),
        TransformRequest(
            transform_type="custom_transform",
            output_column="value_twice",
            source_column="value",
            params={},
        ),
    )

    assert result.name == "value_twice"
    assert result.tolist() == [2.0, 4.0, 6.0]
    clear_plugins()


def test_plugins_endpoint(client) -> None:
    response = client.get("/api/plugins/")
    assert response.status_code == 200
    body = response.json()
    assert "charts" in body
    assert "transforms" in body
    assert "tests" in body


def test_plugin_test_endpoint_runs_registered_test(client) -> None:
    clear_plugins()

    @register_test("mean_summary")
    def mean_summary(df, params):
        column = str(params["column"])
        return {
            "column": column,
            "mean": float(pd.to_numeric(df[column], errors="coerce").mean()),
        }

    dataset_id = _upload_csv(client, b"value\n1\n3\n5\n")
    response = client.post(f"/api/plugins/{dataset_id}/tests/mean_summary", json={"column": "value"})

    assert response.status_code == 200
    assert response.json() == {"column": "value", "mean": 3.0}
    clear_plugins()

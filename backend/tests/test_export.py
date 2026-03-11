"""Tests for export service routes and image rendering."""

from __future__ import annotations

import io

import pandas as pd

from app.services.export import export_figure
from app.services.export_service import (
    export_dataframe_csv,
    export_dataframe_excel,
    generate_summary_report,
)


def _simple_figure() -> dict:
    return {
        "data": [{"type": "scatter", "mode": "markers", "x": [1, 2], "y": [3, 4]}],
        "layout": {"title": {"text": "Simple"}},
    }


def _upload_csv(client, csv_bytes: bytes, *, filename: str = "test.csv") -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": (filename, io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_export_png_bytes():
    output = export_figure(_simple_figure(), fmt="png", width=640, height=480, scale=1)
    assert isinstance(output, bytes)
    assert output.startswith(b"\x89PNG\r\n\x1a\n")


def test_export_svg_bytes():
    output = export_figure(_simple_figure(), fmt="svg", width=640, height=480, scale=1)
    assert isinstance(output, bytes)
    assert b"<svg" in output.lower()


def test_export_dataframe_csv_returns_utf8_bytes():
    df = pd.DataFrame({"city": ["Oslo", "Tokyo"], "value": [1, 2]})

    output = export_dataframe_csv(df)

    assert isinstance(output, bytes)
    assert output.decode("utf-8").splitlines() == ["city,value", "Oslo,1", "Tokyo,2"]


def test_export_dataframe_excel_returns_xlsx_bytes():
    df = pd.DataFrame({"city": ["Oslo", "Tokyo"], "value": [1, 2]})

    output = export_dataframe_excel(df)

    assert isinstance(output, bytes)
    assert output.startswith(b"PK\x03\x04")


def test_generate_summary_report_includes_expected_sections():
    report = generate_summary_report(
        profile_data={"row_count": 12, "column_count": 4, "duplicate_row_count": 1},
        chart_configs=[{"chart_type": "scatter", "x": "x", "y": "y"}],
        inference_results=[{"test_type": "one_sample", "statistic": 2.31, "p_value": 0.02}],
        regression_summary={"model_type": "ols", "dependent": "y", "independents": ["x"], "r_squared": 0.81},
    )

    assert "# Lumina Analysis Report" in report
    assert "## Data Profile" in report
    assert "## Charts" in report
    assert "## Statistical Tests" in report
    assert "## Regression Model" in report


def test_csv_export_respects_active_filters(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)
    filter_response = client.post(
        f"/api/data/{dataset_id}/filters",
        json={
            "logic": "and",
            "filters": [{"column": "category", "operator": "==", "value": "A"}],
        },
    )
    assert filter_response.status_code == 200

    response = client.get(f"/api/export/{dataset_id}/csv")

    assert response.status_code == 200
    exported = pd.read_csv(io.BytesIO(response.content))
    assert exported.columns.tolist() == ["id", "name", "value", "category", "date"]
    assert len(exported) == 25
    assert exported["category"].tolist() == ["A"] * 25


def test_excel_export_respects_excluded_columns(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)
    config_response = client.post(
        f"/api/data/{dataset_id}/column-config",
        json={"columns": [{"name": "name", "excluded": True}]},
    )
    assert config_response.status_code == 200

    response = client.get(f"/api/export/{dataset_id}/excel")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.content.startswith(b"PK\x03\x04")

    exported = pd.read_excel(io.BytesIO(response.content))
    assert "name" not in exported.columns
    assert exported.columns.tolist() == ["id", "value", "category", "date"]


def test_report_export_includes_profile_chart_inference_and_regression_sections(
    client,
    regression_csv_bytes,
):
    dataset_id = _upload_csv(client, regression_csv_bytes, filename="regression.csv")

    profile_response = client.get(f"/api/eda/{dataset_id}/profile")
    assert profile_response.status_code == 200

    chart_response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "x1", "y": "y", "color": None, "facet": None},
    )
    assert chart_response.status_code == 200

    inference_response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={"test_type": "one_sample", "column_a": "x1", "mu": 0, "alternative": "two-sided"},
    )
    assert inference_response.status_code == 200

    regression_response = client.post(
        f"/api/model/{dataset_id}/regression",
        json={
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
            "missing_strategy": "listwise",
            "alpha": 1.0,
            "l1_ratio": 0.5,
            "polynomial_degree": 1,
            "max_depth": None,
            "n_estimators": 100,
        },
    )
    assert regression_response.status_code == 200

    response = client.get(f"/api/export/{dataset_id}/report")

    assert response.status_code == 200
    report = response.content.decode("utf-8")
    assert "## Data Profile" in report
    assert "## Charts" in report
    assert "## Statistical Tests" in report
    assert "## Regression Model" in report

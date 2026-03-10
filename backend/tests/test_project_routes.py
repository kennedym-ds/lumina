"""Tests for project save/load and export API endpoints."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def _project_payload(data_file_path: str) -> dict:
    return {
        "version": "1.0",
        "file_path": data_file_path,
        "file_name": Path(data_file_path).name,
        "file_format": "csv",
        "sheet_name": None,
        "column_config": [{"name": "x", "dtype": "numeric"}],
        "charts": [],
        "active_chart_id": None,
        "regression": None,
        "cross_filter": None,
    }


def _scatter_figure() -> dict:
    return {
        "data": [{"type": "scatter", "mode": "markers", "x": [1, 2], "y": [3, 4]}],
        "layout": {"title": {"text": "Test"}},
    }


def _save_project(client, save_path: str, project: dict):
    return client.post(
        "/api/project/save",
        json={
            "file_path": save_path,
            "project": project,
        },
    )


def _load_project(client, save_path: str):
    return client.post(
        "/api/project/load",
        json={"file_path": save_path},
    )


def test_save_project(client, tmp_path):
    sample_csv_path = tmp_path / "sample.csv"
    pd.DataFrame({"x": [1, 2, 3], "y": [10, 20, 30]}).to_csv(sample_csv_path, index=False)

    project_save_path = tmp_path / "workspace.lumina"
    project = _project_payload(str(sample_csv_path))

    response = _save_project(client, str(project_save_path), project)
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["file_path"] == str(project_save_path)
    assert project_save_path.exists()

    parsed = json.loads(project_save_path.read_text(encoding="utf-8"))
    assert parsed["file_name"] == "sample.csv"
    assert parsed["file_format"] == "csv"


def test_load_project(client, tmp_path):
    sample_csv_path = tmp_path / "sample.csv"
    pd.DataFrame({"x": [1, 2, 3], "y": [10, 20, 30]}).to_csv(sample_csv_path, index=False)

    project_save_path = tmp_path / "workspace.lumina"
    project = _project_payload(str(sample_csv_path))

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 200

    body = load_response.json()
    assert body["dataset_id"]
    assert body["file_name"] == "sample.csv"
    assert body["file_format"] == "csv"
    assert body["row_count"] == 3
    assert body["column_count"] == 2
    assert body["project"]["file_path"] == str(sample_csv_path)


def test_load_missing_file(client, tmp_path):
    missing_data_path = tmp_path / "missing.csv"
    project_save_path = tmp_path / "missing-data.lumina"
    project = _project_payload(str(missing_data_path))

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 404

    body = load_response.json()
    assert "Data file not found" in body["detail"]
    assert body["missing_file"] == str(missing_data_path)


def test_load_nonexistent_project(client, tmp_path):
    project_path = tmp_path / "does-not-exist.lumina"

    response = _load_project(client, str(project_path))
    assert response.status_code == 404


def test_save_load_roundtrip(client, tmp_path):
    sample_csv_path = tmp_path / "sample.csv"
    pd.DataFrame({"x": [1, 2, 3], "y": [10, 20, 30], "group": ["A", "A", "B"]}).to_csv(
        sample_csv_path,
        index=False,
    )

    project_save_path = tmp_path / "roundtrip.lumina"
    project = _project_payload(str(sample_csv_path))
    project["charts"] = [
        {
            "chart_id": "chart-1",
            "chart_type": "scatter",
            "x": "x",
            "y": "y",
            "color": "group",
            "facet": None,
            "nbins": None,
        }
    ]
    project["active_chart_id"] = "chart-1"
    project["regression"] = {
        "model_type": "ols",
        "dependent": "y",
        "independents": ["x"],
        "train_test_split": 0.8,
        "missing_strategy": "listwise",
    }

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 200

    loaded_project = load_response.json()["project"]
    assert loaded_project["charts"] == project["charts"]
    assert loaded_project["regression"] == project["regression"]
    assert loaded_project["active_chart_id"] == "chart-1"


def test_export_png(client):
    response = client.post(
        "/api/project/export",
        json={
            "figure": _scatter_figure(),
            "format": "png",
            "width": 640,
            "height": 480,
            "scale": 1,
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")


def test_export_svg(client):
    response = client.post(
        "/api/project/export",
        json={
            "figure": _scatter_figure(),
            "format": "svg",
            "width": 640,
            "height": 480,
            "scale": 1,
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in response.content.lower()


def test_export_invalid_format(client):
    response = client.post(
        "/api/project/export",
        json={
            "figure": _scatter_figure(),
            "format": "gif",
        },
    )
    assert response.status_code == 400

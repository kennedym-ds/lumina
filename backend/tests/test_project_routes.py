"""Tests for project save/load and export API endpoints."""

from __future__ import annotations

import io
import json
from pathlib import Path

import pandas as pd


def _project_payload(data_file_path: str, *, version: str = "1.1") -> dict:
    return {
        "version": version,
        "file_path": data_file_path,
        "file_name": Path(data_file_path).name,
        "file_format": "csv",
        "sheet_name": None,
        "column_config": [{"name": "x", "dtype": "numeric"}],
        "charts": [],
        "active_chart_id": None,
        "dashboard_panels": [],
        "regression": None,
        "cross_filter": None,
        "saved_views": [],
        "excluded_columns": [],
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


def _upload_csv(client, csv_bytes: bytes, *, filename: str = "test.csv") -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": (filename, io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


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
    assert parsed["version"] == "1.1"
    assert parsed["file_name"] == "sample.csv"
    assert parsed["file_format"] == "csv"
    assert parsed["dashboard_panels"] == []


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
    project["dashboard_panels"] = [
        {
            "id": "panel-1",
            "chart_id": "chart-1",
            "x": 0,
            "y": 0,
            "w": 3,
            "h": 2,
        }
    ]
    project["regression"] = {
        "model_type": "ols",
        "dependent": "y",
        "independents": ["x"],
        "train_test_split": 0.8,
        "missing_strategy": "listwise",
        "alpha": 1.0,
        "l1_ratio": 0.5,
        "polynomial_degree": 1,
        "max_depth": None,
        "n_estimators": 100,
    }

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 200

    loaded_project = load_response.json()["project"]
    assert loaded_project["charts"] == project["charts"]
    assert loaded_project["regression"] == project["regression"]
    assert loaded_project["active_chart_id"] == "chart-1"
    assert loaded_project["dashboard_panels"] == project["dashboard_panels"]


def test_project_save_load_preserves_saved_views(client, tmp_path, sample_csv_bytes):
    sample_csv_path = tmp_path / "sample.csv"
    sample_csv_path.write_bytes(sample_csv_bytes)

    dataset_id = _upload_csv(client, sample_csv_bytes, filename=sample_csv_path.name)
    created_view = client.post(
        f"/api/views/{dataset_id}",
        json={
            "name": "Test View",
            "charts": [{"chart_id": "c1", "chart_type": "scatter", "x": "id", "y": "value"}],
            "active_chart_id": "c1",
            "cross_filter": {"selected_indices": [1, 2], "selection_source": "c1"},
        },
    )
    assert created_view.status_code == 200

    project_save_path = tmp_path / "views-roundtrip.lumina"
    project = _project_payload(str(sample_csv_path))

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    saved_payload = json.loads(project_save_path.read_text(encoding="utf-8"))
    assert len(saved_payload["saved_views"]) == 1
    assert saved_payload["saved_views"][0]["name"] == "Test View"

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 200
    body = load_response.json()

    assert len(body["project"]["saved_views"]) == 1
    assert body["project"]["saved_views"][0]["name"] == "Test View"

    listed_views = client.get(f"/api/views/{body['dataset_id']}")
    assert listed_views.status_code == 200
    assert [view["name"] for view in listed_views.json()] == ["Test View"]


def test_project_save_load_preserves_excluded_columns(client, tmp_path, sample_csv_bytes):
    sample_csv_path = tmp_path / "sample.csv"
    sample_csv_path.write_bytes(sample_csv_bytes)

    dataset_id = _upload_csv(client, sample_csv_bytes, filename=sample_csv_path.name)
    update_config = client.post(
        f"/api/data/{dataset_id}/column-config",
        json={
            "columns": [
                {"name": "name", "excluded": True},
                {"name": "value", "dtype": "numeric"},
            ]
        },
    )
    assert update_config.status_code == 200

    project_save_path = tmp_path / "excluded-columns.lumina"
    project = _project_payload(str(sample_csv_path))
    project["column_config"] = []
    project["excluded_columns"] = []

    save_response = _save_project(client, str(project_save_path), project)
    assert save_response.status_code == 200

    saved_payload = json.loads(project_save_path.read_text(encoding="utf-8"))
    assert saved_payload["excluded_columns"] == ["name"]
    assert saved_payload["column_config"] == [
        {"name": "name", "excluded": True},
        {"name": "value", "dtype": "numeric"},
    ]

    load_response = _load_project(client, str(project_save_path))
    assert load_response.status_code == 200
    body = load_response.json()

    assert body["project"]["excluded_columns"] == ["name"]
    assert body["project"]["column_config"] == [
        {"name": "name", "excluded": True},
        {"name": "value", "dtype": "numeric"},
    ]
    assert body["column_count"] == 4
    assert [column["name"] for column in body["columns"]] == ["id", "value", "category", "date"]


def test_v1_project_file_loads_with_defaults(client, tmp_path):
    sample_csv_path = tmp_path / "legacy.csv"
    pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]}).to_csv(sample_csv_path, index=False)

    project_path = tmp_path / "legacy-v1.lumina"
    project_path.write_text(
        json.dumps(
            {
                "version": "1.0",
                "file_path": str(sample_csv_path),
                "file_name": sample_csv_path.name,
                "file_format": "csv",
                "sheet_name": None,
                "column_config": [],
                "charts": [],
                "active_chart_id": None,
                "regression": None,
                "cross_filter": None,
            }
        ),
        encoding="utf-8",
    )

    response = _load_project(client, str(project_path))
    assert response.status_code == 200

    body = response.json()
    assert body["project"]["version"] == "1.0"
    assert body["project"]["saved_views"] == []
    assert body["project"]["excluded_columns"] == []
    assert body["project"]["dashboard_panels"] == []
    assert body["column_count"] == 2


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

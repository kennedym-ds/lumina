"""Tests for KDE distribution overlays and comparison endpoint."""

import io

import pandas as pd
import pytest

from app.services.distribution import compute_kde


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_compute_kde_without_grouping_returns_single_trace():
    df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 4.0, 5.0]})

    traces = compute_kde(df, "value")

    assert len(traces) == 1
    trace = traces[0]
    assert trace["group"] == "all"
    assert len(trace["x"]) == 200
    assert len(trace["y"]) == 200
    assert all(isinstance(value, float) for value in trace["x"])
    assert all(isinstance(value, float) for value in trace["y"])


def test_compute_kde_with_grouping_returns_trace_per_group():
    df = pd.DataFrame(
        {
            "value": [1.0, 1.5, 2.0, 3.0, 3.5, 4.0],
            "category": ["A", "A", "A", "B", "B", "B"],
        }
    )

    traces = compute_kde(df, "value", group_by="category", n_points=50)

    assert {trace["group"] for trace in traces} == {"A", "B"}
    assert all(len(trace["x"]) == 50 for trace in traces)
    assert all(len(trace["y"]) == 50 for trace in traces)


def test_compute_kde_rejects_non_numeric_column():
    df = pd.DataFrame({"category": ["A", "B", "C"]})

    with pytest.raises(ValueError, match="not numeric"):
        compute_kde(df, "category")


def test_compute_kde_rejects_missing_column():
    df = pd.DataFrame({"value": [1.0, 2.0, 3.0]})

    with pytest.raises(ValueError, match="not found"):
        compute_kde(df, "missing")


def test_compute_kde_returns_empty_for_insufficient_points():
    df = pd.DataFrame({"value": [42.0]})

    assert compute_kde(df, "value") == []


def test_distribution_endpoint_returns_kde_traces(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/distribution",
        json={"column": "value", "group_by": "category", "n_points": 25},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["column"] == "value"
    assert body["group_by"] == "category"
    assert {trace["group"] for trace in body["traces"]} == {"A", "B", "C", "D"}
    assert all(len(trace["x"]) == 25 for trace in body["traces"])
    assert all(len(trace["y"]) == 25 for trace in body["traces"])


def test_distribution_endpoint_rejects_non_numeric_column(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/distribution",
        json={"column": "category"},
    )

    assert response.status_code == 400
    assert "not numeric" in response.json()["detail"].lower()
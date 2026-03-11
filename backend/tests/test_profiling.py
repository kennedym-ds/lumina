"""Tests for dataset profiling."""

import io

import pandas as pd

from app.services.profiling import compute_correlation, profile_dataset


def test_profile_numeric_columns():
    df = pd.DataFrame({"x": range(100), "y": [float(i * 0.5) for i in range(100)]})
    report = profile_dataset("test-id", df)
    assert report.row_count == 100
    assert report.column_count == 2
    assert len(report.columns) == 2

    x_profile = next(column for column in report.columns if column.name == "x")
    assert x_profile.dtype == "numeric"
    assert x_profile.missing_count == 0
    assert x_profile.mean is not None
    assert x_profile.histogram_bins is not None
    assert x_profile.histogram_counts is not None
    assert len(x_profile.histogram_counts) == 20


def test_profile_categorical_columns():
    df = pd.DataFrame({"species": ["A", "B", "A", "C", "B", "A"] * 5})
    report = profile_dataset("test-id", df)
    col = report.columns[0]
    assert col.dtype == "categorical"
    assert col.top_values is not None
    assert len(col.top_values) <= 10
    assert col.top_values[0]["value"] == "A"
    assert col.top_values[0]["count"] == 15


def test_profile_with_missing():
    df = pd.DataFrame({"a": [1, None, 3, None, 5]})
    report = profile_dataset("test-id", df)
    col = report.columns[0]
    assert col.missing_count == 2
    assert col.missing_pct == 40.0


def test_profile_memory():
    df = pd.DataFrame({"a": range(1000)})
    report = profile_dataset("test-id", df)
    assert report.total_memory_bytes > 0
    assert report.columns[0].memory_bytes > 0


def test_profile_duplicates():
    df = pd.DataFrame({"a": [1, 1, 2, 2, 3]})
    report = profile_dataset("test-id", df)
    assert report.duplicate_row_count == 2


def test_profile_skewness_kurtosis():
    df = pd.DataFrame({"x": [1, 2, 3, 4, 5, 100]})
    report = profile_dataset("test-id", df)
    col = report.columns[0]
    assert col.skewness is not None
    assert col.kurtosis is not None


def test_correlation_pearson():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5], "b": [2, 4, 6, 8, 10], "c": [5, 4, 3, 2, 1]})

    columns, matrix = compute_correlation(df, "pearson")

    assert columns == ["a", "b", "c"]
    assert len(matrix) == 3
    assert matrix[0][0] == 1.0
    assert matrix[0][1] == 1.0
    assert matrix[0][2] == -1.0


def test_correlation_spearman():
    df = pd.DataFrame({"x": [1, 2, 3, 4], "y": [10, 20, 30, 40]})

    _, matrix = compute_correlation(df, "spearman")

    assert matrix[0][1] == 1.0


def test_correlation_excludes_non_numeric():
    df = pd.DataFrame({"num": [1, 2, 3], "cat": ["a", "b", "c"]})

    columns, matrix = compute_correlation(df)

    assert columns == ["num"]
    assert len(matrix) == 1


def test_profile_endpoint(client):
    csv = "a,b,species\n1,10,cat\n2,20,dog\n3,30,cat\n4,40,bird\n"
    resp = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert resp.status_code == 200
    dataset_id = resp.json()["dataset_id"]

    resp = client.get(f"/api/eda/{dataset_id}/profile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["row_count"] == 4
    assert body["column_count"] == 3
    assert len(body["columns"]) == 3

    a_col = next(column for column in body["columns"] if column["name"] == "a")
    assert a_col["histogram_bins"] is not None

    species_col = next(column for column in body["columns"] if column["name"] == "species")
    assert species_col["top_values"] is not None


def test_correlation_endpoint(client):
    csv = "a,b,c\n1,2,5\n2,4,4\n3,6,3\n4,8,2\n5,10,1\n"
    resp = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert resp.status_code == 200
    dataset_id = resp.json()["dataset_id"]

    resp = client.post(f"/api/eda/{dataset_id}/correlation", json={"method": "pearson"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["method"] == "pearson"
    assert len(body["columns"]) == 3
    assert body["matrix"][0][0] == 1.0

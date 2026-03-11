"""Tests for row-level filters and their downstream effects."""

import io

import pandas as pd

from app.models.filters import FilterRule
from app.services.filter_engine import apply_filters


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_filter_eq():
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    rules = [FilterRule(column="a", operator="==", value=2)]

    result = apply_filters(df, rules)

    assert len(result) == 1
    assert result.iloc[0]["a"] == 2


def test_filter_gt():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5]})
    rules = [FilterRule(column="a", operator=">", value=3)]

    result = apply_filters(df, rules)

    assert len(result) == 2
    assert list(result["a"]) == [4, 5]


def test_filter_contains():
    df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
    rules = [FilterRule(column="name", operator="contains", value="li")]

    result = apply_filters(df, rules)

    assert len(result) == 2


def test_filter_is_null():
    df = pd.DataFrame({"a": [1, None, 3]})
    rules = [FilterRule(column="a", operator="is_null")]

    result = apply_filters(df, rules)

    assert len(result) == 1


def test_filter_not_null():
    df = pd.DataFrame({"a": [1, None, 3]})
    rules = [FilterRule(column="a", operator="not_null")]

    result = apply_filters(df, rules)

    assert len(result) == 2


def test_filter_multiple_and():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5], "b": ["x", "y", "x", "y", "x"]})
    rules = [
        FilterRule(column="a", operator=">", value=2),
        FilterRule(column="b", operator="==", value="x"),
    ]

    result = apply_filters(df, rules)

    assert len(result) == 2
    assert list(result["a"]) == [3, 5]


def test_filter_in_operator():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5]})
    rules = [FilterRule(column="a", operator="in", value=[2, 4])]

    result = apply_filters(df, rules)

    assert list(result["a"]) == [2, 4]


def test_filter_empty_rules():
    df = pd.DataFrame({"a": [1, 2, 3]})

    result = apply_filters(df, [])

    assert len(result) == 3


def test_filter_invalid_column_skipped():
    df = pd.DataFrame({"a": [1, 2, 3]})
    rules = [FilterRule(column="nonexistent", operator="==", value=1)]

    result = apply_filters(df, rules)

    assert len(result) == 3


def test_filter_endpoint_updates_rows_and_summary(client):
    csv = b"a,b\n1,x\n2,y\n3,x\n4,y\n5,x\n"
    dataset_id = _upload_csv(client, csv)

    response = client.post(
        f"/api/data/{dataset_id}/filters",
        json={
            "filters": [{"column": "a", "operator": ">", "value": 2}],
            "logic": "and",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["applied_count"] == 1
    assert body["matched_rows"] == 3
    assert body["total_rows"] == 5

    rows_response = client.get(f"/api/data/{dataset_id}/rows")
    assert rows_response.status_code == 200
    assert rows_response.json()["total"] == 3

    summary_response = client.get(f"/api/data/{dataset_id}/summary")
    assert summary_response.status_code == 200
    summary_body = summary_response.json()
    assert summary_body["row_count"] == 3
    summary_columns = {column["name"]: column for column in summary_body["columns"]}
    assert summary_columns["a"]["mean"] == 4.0

    clear_response = client.post(f"/api/data/{dataset_id}/filters", json={"filters": [], "logic": "and"})
    assert clear_response.status_code == 200
    assert clear_response.json()["matched_rows"] == 5

    rows_response = client.get(f"/api/data/{dataset_id}/rows")
    assert rows_response.status_code == 200
    assert rows_response.json()["total"] == 5


def test_filter_endpoint_applies_to_regression(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    filter_response = client.post(
        f"/api/data/{dataset_id}/filters",
        json={
            "filters": [{"column": "x1", "operator": ">", "value": 0}],
            "logic": "and",
        },
    )
    assert filter_response.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/regression",
        json={
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert 0 < body["n_observations"] < 120


def test_filter_endpoint_invalid_column(client):
    dataset_id = _upload_csv(client, b"a\n1\n2\n")

    response = client.post(
        f"/api/data/{dataset_id}/filters",
        json={"filters": [{"column": "nonexistent", "operator": "==", "value": 1}]},
    )

    assert response.status_code == 400

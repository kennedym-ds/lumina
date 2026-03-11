"""Tests for statistical inference endpoints."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.services.inference import cohens_d, cramers_v, eta_squared


def _upload_dataframe(client, dataframe: pd.DataFrame) -> str:
    buffer = io.BytesIO()
    dataframe.to_csv(buffer, index=False)
    response = client.post(
        "/api/data/upload",
        files={"file": ("inference.csv", io.BytesIO(buffer.getvalue()), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_independent_ttest_with_groups(client):
    dataframe = pd.DataFrame(
        {
            "score": [10, 12, 11, 13, 20, 22, 21, 23],
            "group": ["A", "A", "A", "A", "B", "B", "B", "B"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "independent",
            "column_a": "score",
            "group_column": "group",
            "group_a": "A",
            "group_b": "B",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["test_type"] == "independent"
    assert payload["n_a"] == 4
    assert payload["n_b"] == 4
    assert payload["mean_a"] == pytest.approx(11.5)
    assert payload["mean_b"] == pytest.approx(21.5)
    assert payload["ci_lower"] < payload["ci_upper"]
    assert payload["ci_level"] == pytest.approx(0.95)
    assert payload["effect_size"] == pytest.approx(-7.74596669)
    assert payload["effect_size_label"] == "Cohen's d"
    assert payload["p_value"] < 0.01


def test_cohens_d_for_separated_groups_is_large():
    group_a = pd.Series([1.0, 2.0, 3.0]).to_numpy()
    group_b = pd.Series([4.0, 5.0, 6.0]).to_numpy()

    result = cohens_d(group_a, group_b)

    assert abs(result) == pytest.approx(3.0)


def test_cohens_d_for_identical_groups_is_zero():
    group_a = pd.Series([2.0, 2.0, 2.0]).to_numpy()
    group_b = pd.Series([2.0, 2.0, 2.0]).to_numpy()

    result = cohens_d(group_a, group_b)

    assert result == pytest.approx(0.0)


def test_eta_squared_returns_ratio():
    assert eta_squared(18.0, 60.0) == pytest.approx(0.3)


def test_cramers_v_returns_expected_value():
    assert cramers_v(9.0, 100, 2) == pytest.approx(0.3)


def test_paired_ttest(client):
    dataframe = pd.DataFrame(
        {
            "pre": [100, 102, 98, 101, 99],
            "post": [103, 104, 100, 105, 101],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "paired",
            "column_a": "pre",
            "column_b": "post",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["test_type"] == "paired"
    assert payload["n_a"] == 5
    assert payload["n_b"] == 5
    assert payload["df"] == pytest.approx(4)
    assert payload["p_value"] < 0.01


def test_one_sample_ttest(client):
    dataframe = pd.DataFrame({"sample": [10, 11, 9, 12, 10]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "one_sample",
            "column_a": "sample",
            "mu": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["test_type"] == "one_sample"
    assert payload["mean_a"] == pytest.approx(10.4)
    assert payload["mean_b"] == pytest.approx(8.0)
    assert payload["n_a"] == 5
    assert payload["n_b"] is None
    assert payload["p_value"] < 0.05


def test_chi_square(client):
    dataframe = pd.DataFrame(
        {
            "smoker": ["yes"] * 12 + ["no"] * 12,
            "outcome": ["improved"] * 10 + ["not_improved"] * 2 + ["improved"] * 3 + ["not_improved"] * 9,
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/chi_square",
        json={"column_a": "smoker", "column_b": "outcome"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["df"] == 1
    assert payload["statistic"] > 0
    assert payload["p_value"] < 0.05
    assert payload["contingency_table"]["yes"]["improved"] == 10
    assert payload["expected_frequencies"]["no"]["not_improved"] == pytest.approx(5.5)


def test_one_way_anova(client):
    dataframe = pd.DataFrame(
        {
            "score": [5, 6, 7, 10, 11, 12, 15, 16, 17],
            "segment": ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/anova",
        json={"numeric_column": "score", "group_column": "segment"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["df_between"] == 2
    assert payload["df_within"] == 6
    assert payload["group_means"]["A"] == pytest.approx(6.0)
    assert payload["group_sizes"] == {"A": 3, "B": 3, "C": 3}
    assert payload["eta_squared"] == pytest.approx(0.96153846)
    assert payload["p_value"] < 0.01


def test_chi_square_response_includes_cramers_v(client):
    dataframe = pd.DataFrame(
        {
            "smoker": ["yes"] * 12 + ["no"] * 12,
            "outcome": ["improved"] * 10 + ["not_improved"] * 2 + ["improved"] * 3 + ["not_improved"] * 9,
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/chi_square",
        json={"column_a": "smoker", "column_b": "outcome"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["n_total"] == 24
    assert payload["cramers_v"] == pytest.approx(0.50174521)


def test_confidence_interval_endpoint_contains_sample_mean(client):
    dataframe = pd.DataFrame({"sample": [10, 11, 9, 12, 10]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/ci",
        json={"column": "sample", "confidence_level": 0.95},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["column"] == "sample"
    assert payload["n"] == 5
    assert payload["ci_lower"] < payload["mean"] < payload["ci_upper"]
    assert payload["std_error"] > 0


def test_confidence_interval_endpoint_supports_multiple_levels(client):
    dataframe = pd.DataFrame({"sample": [10, 11, 9, 12, 10]})
    dataset_id = _upload_dataframe(client, dataframe)

    widths: dict[float, float] = {}
    for level in (0.90, 0.95, 0.99):
        response = client.post(
            f"/api/inference/{dataset_id}/ci",
            json={"column": "sample", "confidence_level": level},
        )

        assert response.status_code == 200
        payload = response.json()
        widths[level] = payload["ci_upper"] - payload["ci_lower"]
        assert payload["confidence_level"] == pytest.approx(level)

    assert widths[0.90] < widths[0.95] < widths[0.99]


def test_ttest_missing_column_returns_400(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"score": [1, 2, 3], "group": ["A", "A", "B"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "independent",
            "column_a": "missing",
            "group_column": "group",
            "group_a": "A",
            "group_b": "B",
        },
    )

    assert response.status_code == 400
    assert "missing" in response.json()["detail"].lower()


def test_ttest_non_numeric_column_returns_400(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"category": ["A", "B", "A", "B"], "group": ["x", "x", "y", "y"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "independent",
            "column_a": "category",
            "group_column": "group",
            "group_a": "x",
            "group_b": "y",
        },
    )

    assert response.status_code == 400
    assert "numeric" in response.json()["detail"].lower()


def test_ttest_insufficient_group_data_returns_400(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"score": [1, 2, 3], "group": ["A", "A", "B"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/ttest",
        json={
            "test_type": "independent",
            "column_a": "score",
            "group_column": "group",
            "group_a": "A",
            "group_b": "B",
        },
    )

    assert response.status_code == 400
    assert "at least 2 observations" in response.json()["detail"].lower()


def test_chi_square_missing_column_returns_400(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"column_a": ["A", "B"], "column_b": ["X", "Y"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/chi_square",
        json={"column_a": "column_a", "column_b": "missing"},
    )

    assert response.status_code == 400
    assert "missing" in response.json()["detail"].lower()


def test_anova_non_numeric_column_returns_400(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"label": ["low", "mid", "high"], "segment": ["A", "B", "C"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/anova",
        json={"numeric_column": "label", "group_column": "segment"},
    )

    assert response.status_code == 400
    assert "numeric" in response.json()["detail"].lower()


def test_anova_requires_two_observations_per_group(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"score": [1, 2, 3], "segment": ["A", "A", "B"]}))

    response = client.post(
        f"/api/inference/{dataset_id}/anova",
        json={"numeric_column": "score", "group_column": "segment"},
    )

    assert response.status_code == 400
    assert "at least 2 observations" in response.json()["detail"].lower()

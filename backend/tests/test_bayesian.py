"""Tests for Bayesian inference services and endpoints."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.services.bayesian import bayesian_one_sample, bayesian_two_sample


def _upload_dataframe(client, dataframe: pd.DataFrame) -> str:
    buffer = io.BytesIO()
    dataframe.to_csv(buffer, index=False)
    response = client.post(
        "/api/data/upload",
        files={"file": ("bayesian.csv", io.BytesIO(buffer.getvalue()), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_bayesian_one_sample_posterior_mean_tracks_sample_mean():
    data = [10.0, 11.0, 9.0, 12.0, 10.0]

    result = bayesian_one_sample(data)

    assert result["posterior_mean"] == pytest.approx(10.4, rel=0.02)
    assert result["sample_mean"] == pytest.approx(10.4)
    assert result["n"] == 5


def test_bayesian_one_sample_interval_contains_sample_mean():
    data = [10.0, 11.0, 9.0, 12.0, 10.0]

    result = bayesian_one_sample(data, credible_level=0.95)

    assert result["ci_lower"] < result["sample_mean"] < result["ci_upper"]
    assert result["credible_level"] == pytest.approx(0.95)


def test_bayesian_one_sample_bayes_factor_favors_alternative_for_shifted_sample():
    data = [10.0, 11.0, 9.0, 12.0, 10.0]

    result = bayesian_one_sample(data)

    assert result["bayes_factor_10"] > 1.0


def test_bayesian_two_sample_difference_matches_group_gap():
    group_a = [10.0, 11.0, 12.0, 10.5, 11.5]
    group_b = [4.0, 5.0, 6.0, 5.5, 4.5]

    result = bayesian_two_sample(group_a, group_b)

    assert result["difference_mean"] == pytest.approx(6.0, rel=0.1)
    assert result["ci_lower"] < result["difference_mean"] < result["ci_upper"]


def test_bayesian_two_sample_probability_reflects_positive_gap():
    group_a = [10.0, 11.0, 12.0, 10.5, 11.5]
    group_b = [4.0, 5.0, 6.0, 5.5, 4.5]

    result = bayesian_two_sample(group_a, group_b)

    assert result["prob_greater_than_zero"] > 0.99


def test_bayesian_one_sample_endpoint_returns_expected_payload(client):
    dataframe = pd.DataFrame({"score": [10, 11, 9, 12, 10], "label": ["A", "A", "B", "B", "A"]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/bayesian/one_sample",
        json={"column": "score", "prior_mu": 0.0, "prior_sigma": 1000.0, "credible_level": 0.95},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["posterior_mean"] == pytest.approx(10.4, rel=0.02)
    assert payload["bayes_factor_10"] > 1.0
    assert payload["n"] == 5


def test_bayesian_one_sample_endpoint_rejects_non_numeric_columns(client):
    dataframe = pd.DataFrame({"label": ["A", "B", "C"], "group": ["x", "y", "z"]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/bayesian/one_sample",
        json={"column": "label", "credible_level": 0.95},
    )

    assert response.status_code == 400
    assert "numeric" in response.json()["detail"].lower()


def test_bayesian_two_sample_endpoint_returns_group_summaries(client):
    dataframe = pd.DataFrame(
        {
            "control": [4, 5, 6, 5, 4],
            "treatment": [10, 11, 12, 11, 10],
            "group": ["control", "control", "control", "treatment", "treatment"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/bayesian/two_sample",
        json={"column_a": "treatment", "column_b": "control", "credible_level": 0.95},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["difference_mean"] > 0
    assert payload["prob_greater_than_zero"] > 0.99
    assert payload["group_a"]["sample_mean"] > payload["group_b"]["sample_mean"]


def test_bayesian_two_sample_endpoint_rejects_missing_columns(client):
    dataframe = pd.DataFrame({"control": [4, 5, 6], "treatment": [10, 11, 12]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/bayesian/two_sample",
        json={"column_a": "treatment", "column_b": "missing", "credible_level": 0.95},
    )

    assert response.status_code == 400
    assert "missing" in response.json()["detail"].lower()

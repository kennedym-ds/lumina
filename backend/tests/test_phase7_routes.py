"""Integration tests for Phase 7 routes: RM-ANOVA, Factorial ANOVA, Stepwise, Bayesian Regression, Inference Export."""
import io

import numpy as np
import pandas as pd
import pytest

from app.session import DatasetSession, store
from app.services.export_service import export_inference_results


def _upload_dataframe(client, df: pd.DataFrame) -> str:
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    resp = client.post(
        "/api/data/upload",
        files={"file": ("phase7.csv", io.BytesIO(buf.getvalue()), "text/csv")},
    )
    assert resp.status_code == 200
    return resp.json()["dataset_id"]


@pytest.fixture()
def dataset_id(client):
    """Upload a small dataset and return its ID."""
    np.random.seed(42)
    n = 40
    # Build balanced RM data: 10 subjects × 4 conditions = 40 rows
    subjects = list(range(10)) * 4
    conditions = [c for c in ["A", "B", "C", "D"] for _ in range(10)]
    df = pd.DataFrame({
        "y": np.random.randn(n),
        "x1": np.random.randn(n),
        "x2": np.random.randn(n),
        "x3": np.random.randn(n),
        "group_a": np.random.choice(["a1", "a2"], n),
        "group_b": np.random.choice(["b1", "b2"], n),
        "subject": subjects,
        "condition": conditions,
        "score": np.random.randn(n),
    })
    return _upload_dataframe(client, df)


class TestRepeatedMeasuresAnovaRoute:
    def test_success(self, client, dataset_id):
        resp = client.post(f"/api/inference/{dataset_id}/repeated_measures_anova", json={
            "subject_column": "subject",
            "within_column": "condition",
            "dependent_column": "score",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "f_statistic" in data
        assert "p_value" in data
        assert data["n_subjects"] == 10
        assert data["n_conditions"] == 4

    def test_missing_column(self, client, dataset_id):
        resp = client.post(f"/api/inference/{dataset_id}/repeated_measures_anova", json={
            "subject_column": "nonexistent",
            "within_column": "condition",
            "dependent_column": "score",
        })
        assert resp.status_code == 400

    def test_dataset_not_found(self, client):
        resp = client.post("/api/inference/missing-id/repeated_measures_anova", json={
            "subject_column": "subject",
            "within_column": "condition",
            "dependent_column": "score",
        })
        assert resp.status_code == 404


class TestFactorialAnovaRoute:
    def test_two_way(self, client, dataset_id):
        resp = client.post(f"/api/inference/{dataset_id}/factorial_anova", json={
            "dependent_column": "y",
            "factors": ["group_a", "group_b"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "table" in data
        assert data["n_observations"] == 40

    def test_too_few_factors(self, client, dataset_id):
        resp = client.post(f"/api/inference/{dataset_id}/factorial_anova", json={
            "dependent_column": "y",
            "factors": ["group_a"],
        })
        assert resp.status_code == 422


class TestStepwiseRoute:
    def test_success(self, client, dataset_id):
        resp = client.post(f"/api/model/{dataset_id}/stepwise", json={
            "dependent": "y",
            "candidates": ["x1", "x2", "x3"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "selected_variables" in data
        assert "steps" in data
        assert data["n_observations"] == 40

    def test_bic(self, client, dataset_id):
        resp = client.post(f"/api/model/{dataset_id}/stepwise", json={
            "dependent": "y",
            "candidates": ["x1", "x2"],
            "criterion": "bic",
        })
        assert resp.status_code == 200
        assert resp.json()["criterion"] == "bic"

    def test_missing_column(self, client, dataset_id):
        resp = client.post(f"/api/model/{dataset_id}/stepwise", json={
            "dependent": "y",
            "candidates": ["nonexistent"],
        })
        assert resp.status_code == 400


class TestBayesianRegressionRoute:
    def test_success(self, client, dataset_id):
        resp = client.post(f"/api/model/{dataset_id}/bayesian-regression", json={
            "dependent": "y",
            "independents": ["x1", "x2"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["coefficients"]) == 3  # intercept + 2
        assert data["n_observations"] == 40
        assert "r_squared" in data

    def test_missing_column(self, client, dataset_id):
        resp = client.post(f"/api/model/{dataset_id}/bayesian-regression", json={
            "dependent": "y",
            "independents": ["nonexistent"],
        })
        assert resp.status_code == 400

    def test_dataset_not_found(self, client):
        resp = client.post("/api/model/missing-id/bayesian-regression", json={
            "dependent": "y",
            "independents": ["x1"],
        })
        assert resp.status_code == 404


class TestInferenceExportRoute:
    def test_markdown_export(self, client, dataset_id):
        # First run a test to populate results
        client.post(f"/api/inference/{dataset_id}/factorial_anova", json={
            "dependent_column": "y",
            "factors": ["group_a", "group_b"],
        })
        resp = client.get(f"/api/export/{dataset_id}/inference-report?fmt=markdown")
        assert resp.status_code == 200
        assert "text/markdown" in resp.headers.get("content-type", "")

    def test_csv_export(self, client, dataset_id):
        client.post(f"/api/inference/{dataset_id}/factorial_anova", json={
            "dependent_column": "y",
            "factors": ["group_a", "group_b"],
        })
        resp = client.get(f"/api/export/{dataset_id}/inference-report?fmt=csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_empty_export(self, client, dataset_id):
        # No inference results yet on a fresh upload
        resp = client.get(f"/api/export/{dataset_id}/inference-report")
        assert resp.status_code == 200


class TestExportServiceUnit:
    def test_export_with_results(self):
        results = [
            {"test_type": "ttest", "t_statistic": 2.5, "p_value": 0.01},
            {"test_type": "anova", "f_statistic": 5.3, "p_value": 0.005},
        ]
        markdown, csv_bytes = export_inference_results(results)
        assert "ttest" in markdown
        assert "anova" in markdown
        assert len(csv_bytes) > 0

    def test_export_empty(self):
        markdown, csv_bytes = export_inference_results([])
        assert "No results" in markdown
        assert csv_bytes == b""

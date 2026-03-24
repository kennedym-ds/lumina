"""Tests for statistical inference endpoints."""

from __future__ import annotations

import io

import pandas as pd
import pytest

import numpy as np

from app.session import store
from app.services.inference import cohens_d, cramers_v, eta_squared, run_repeated_measures_anova, run_factorial_anova


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


def test_tukey_hsd_returns_pairwise_adjusted_comparisons(client):
    dataframe = pd.DataFrame(
        {
            "score": [5, 6, 7, 10, 11, 12, 15, 16, 17],
            "segment": ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/tukey_hsd",
        json={"numeric_column": "score", "group_column": "segment", "alpha": 0.05},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["alpha"] == pytest.approx(0.05)
    assert payload["group_means"] == {"A": pytest.approx(6.0), "B": pytest.approx(11.0), "C": pytest.approx(16.0)}
    assert payload["group_sizes"] == {"A": 3, "B": 3, "C": 3}
    assert len(payload["comparisons"]) == 3
    comparison = next(item for item in payload["comparisons"] if item["group_a"] == "A" and item["group_b"] == "C")
    assert comparison["adjusted_p_value"] < 0.05
    assert comparison["reject_null"] is True

    session = store.get(dataset_id)
    assert session is not None
    assert session.inference_results[-1]["kind"] == "tukey_hsd"


def test_mann_whitney_u_returns_group_summary(client):
    dataframe = pd.DataFrame(
        {
            "score": [1, 2, 3, 4, 8, 9, 10, 11],
            "group": ["A", "A", "A", "A", "B", "B", "B", "B"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/mann_whitney",
        json={"numeric_column": "score", "group_column": "group", "alternative": "two-sided"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["group_a"] == "A"
    assert payload["group_b"] == "B"
    assert payload["n_a"] == 4
    assert payload["n_b"] == 4
    assert payload["median_a"] == pytest.approx(2.5)
    assert payload["median_b"] == pytest.approx(9.5)
    assert payload["p_value"] < 0.05


def test_mann_whitney_u_requires_exactly_two_groups(client):
    dataframe = pd.DataFrame(
        {
            "score": [1, 2, 3, 4, 8, 9],
            "group": ["A", "A", "B", "B", "C", "C"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/mann_whitney",
        json={"numeric_column": "score", "group_column": "group", "alternative": "two-sided"},
    )

    assert response.status_code == 400
    assert "exactly 2 groups" in response.json()["detail"].lower()


def test_wilcoxon_signed_rank_returns_paired_summary(client):
    dataframe = pd.DataFrame(
        {
            "pre": [10, 11, 12, 13, 14],
            "post": [9, 10, 12, 11, 13],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/wilcoxon",
        json={"column_a": "pre", "column_b": "post", "alternative": "two-sided"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["n_pairs"] == 5
    assert payload["median_difference"] == pytest.approx(1.0)
    assert payload["statistic"] >= 0
    assert payload["p_value"] >= 0


def test_kruskal_wallis_returns_group_medians(client):
    dataframe = pd.DataFrame(
        {
            "score": [5, 6, 7, 10, 11, 12, 15, 16, 17],
            "segment": ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
        }
    )
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/kruskal",
        json={"numeric_column": "score", "group_column": "segment"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["df"] == 2
    assert payload["group_sizes"] == {"A": 3, "B": 3, "C": 3}
    assert payload["group_medians"] == {"A": pytest.approx(6.0), "B": pytest.approx(11.0), "C": pytest.approx(16.0)}
    assert payload["p_value"] < 0.05


def test_combined_normality_returns_all_test_results(client):
    dataframe = pd.DataFrame({"sample": [10, 11, 9, 12, 10, 11, 9, 12]})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/normality",
        json={"column": "sample", "alpha": 0.05},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["column"] == "sample"
    assert payload["n"] == 8
    assert payload["alpha"] == pytest.approx(0.05)
    assert payload["shapiro"]["ran"] is True
    assert payload["shapiro"]["p_value"] is not None
    assert payload["anderson_darling"]["critical_values"]["5.0%"] > 0
    assert payload["lilliefors"]["p_value"] is not None


def test_combined_normality_skips_shapiro_for_large_samples(client):
    dataframe = pd.DataFrame({"sample": list(range(6001))})
    dataset_id = _upload_dataframe(client, dataframe)

    response = client.post(
        f"/api/inference/{dataset_id}/normality",
        json={"column": "sample", "alpha": 0.05},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["n"] == 6001
    assert payload["shapiro"]["ran"] is False
    assert "5000" in payload["shapiro"]["reason"]
    assert payload["anderson_darling"]["statistic"] >= 0
    assert payload["lilliefors"]["p_value"] is not None


def test_power_analysis_ttest_sample_size(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"placeholder": [1, 2, 3]}))

    response = client.post(
        f"/api/inference/{dataset_id}/power",
        json={
            "analysis_type": "ttest",
            "solve_for": "sample_size",
            "effect_size": 0.5,
            "alpha": 0.05,
            "power": 0.8,
            "ratio": 1.0,
            "alternative": "two-sided",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_type"] == "ttest"
    assert payload["solve_for"] == "sample_size"
    assert payload["sample_size_per_group"] == pytest.approx(63.7656, rel=1e-3)
    assert payload["total_sample_size"] == pytest.approx(127.5312, rel=1e-3)
    assert payload["power"] == pytest.approx(0.8)


def test_power_analysis_ttest_power(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"placeholder": [1, 2, 3]}))

    response = client.post(
        f"/api/inference/{dataset_id}/power",
        json={
            "analysis_type": "ttest",
            "solve_for": "power",
            "effect_size": 0.5,
            "alpha": 0.05,
            "sample_size_per_group": 64,
            "ratio": 1.0,
            "alternative": "two-sided",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_type"] == "ttest"
    assert payload["solve_for"] == "power"
    assert payload["sample_size_per_group"] == pytest.approx(64.0)
    assert payload["power"] == pytest.approx(0.8015, rel=1e-3)
    assert payload["total_sample_size"] == pytest.approx(128.0)


def test_power_analysis_anova_sample_size(client):
    dataset_id = _upload_dataframe(client, pd.DataFrame({"placeholder": [1, 2, 3]}))

    response = client.post(
        f"/api/inference/{dataset_id}/power",
        json={
            "analysis_type": "anova",
            "solve_for": "sample_size",
            "effect_size": 0.25,
            "alpha": 0.05,
            "power": 0.8,
            "k_groups": 3,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_type"] == "anova"
    assert payload["solve_for"] == "sample_size"
    assert payload["total_sample_size"] == pytest.approx(157.1898, rel=1e-3)
    assert payload["sample_size_per_group"] == pytest.approx(52.3966, rel=1e-3)
    assert payload["power"] == pytest.approx(0.8)


class TestRepeatedMeasuresAnova:
    def test_basic(self):
        """RM-ANOVA with 4 subjects × 3 conditions."""
        df = pd.DataFrame({
            "subject": [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4],
            "condition": ["A", "B", "C", "A", "B", "C", "A", "B", "C", "A", "B", "C"],
            "score": [5.0, 6.0, 7.0, 4.0, 5.0, 6.0, 6.0, 7.0, 8.0, 5.0, 6.0, 7.0],
        })
        result = run_repeated_measures_anova(df, "subject", "condition", "score")
        assert "f_statistic" in result
        assert "p_value" in result
        assert result["n_subjects"] == 4
        assert result["n_conditions"] == 3

    def test_missing_column(self):
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        with pytest.raises(ValueError, match="not found"):
            run_repeated_measures_anova(df, "subject", "condition", "score")


class TestFactorialAnova:
    def test_two_factors(self):
        """Two-way ANOVA with 2×2 design."""
        np.random.seed(42)
        n = 40
        df = pd.DataFrame({
            "y": np.random.randn(n),
            "A": np.random.choice(["a1", "a2"], n),
            "B": np.random.choice(["b1", "b2"], n),
        })
        result = run_factorial_anova(df, "y", ["A", "B"])
        assert "table" in result
        assert result["n_observations"] == n
        assert any(r["source"] for r in result["table"])

    def test_too_few_factors(self):
        df = pd.DataFrame({"y": [1, 2], "A": ["a", "b"]})
        with pytest.raises(ValueError, match="at least 2"):
            run_factorial_anova(df, "y", ["A"])

"""Tests for Bayesian linear regression."""
import numpy as np
import pandas as pd
import pytest

from app.services.bayesian import bayesian_linear_regression


class TestBayesianLinearRegression:
    def test_basic_fit(self):
        np.random.seed(42)
        n = 100
        x = np.random.randn(n)
        y = 2.0 + 3.0 * x + np.random.randn(n) * 0.5
        df = pd.DataFrame({"y": y, "x": x})

        result = bayesian_linear_regression(df, "y", ["x"])
        assert len(result["coefficients"]) == 2  # intercept + x
        assert result["n_observations"] == n
        assert result["r_squared"] > 0.5
        # Check intercept is near 2
        intercept = result["coefficients"][0]
        assert abs(intercept["posterior_mean"] - 2.0) < 1.0
        # Check slope is near 3
        slope = result["coefficients"][1]
        assert abs(slope["posterior_mean"] - 3.0) < 1.0

    def test_missing_column(self):
        df = pd.DataFrame({"y": [1, 2], "x": [3, 4]})
        with pytest.raises(ValueError, match="not found"):
            bayesian_linear_regression(df, "y", ["z"])

    def test_too_few_observations(self):
        df = pd.DataFrame({"y": [1.0], "x": [2.0]})
        with pytest.raises(ValueError, match="Not enough"):
            bayesian_linear_regression(df, "y", ["x"])

    def test_mean_imputation(self):
        df = pd.DataFrame({
            "y": [1.0, 2.0, 3.0, None, 5.0],
            "x": [1.0, None, 3.0, 4.0, 5.0],
        })
        result = bayesian_linear_regression(df, "y", ["x"], missing_strategy="mean_imputation")
        assert result["n_observations"] == 5

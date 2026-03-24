"""Tests for stepwise variable selection."""
import numpy as np
import pandas as pd
import pytest

from app.services.regression import run_stepwise_selection


class TestStepwiseSelection:
    def test_basic_forward(self):
        np.random.seed(42)
        n = 100
        x1 = np.random.randn(n)
        x2 = np.random.randn(n)
        x3 = np.random.randn(n)  # noise
        y = 1.0 + 2.0 * x1 + 3.0 * x2 + np.random.randn(n) * 0.5
        df = pd.DataFrame({"y": y, "x1": x1, "x2": x2, "x3": x3})

        result = run_stepwise_selection(df, "y", ["x1", "x2", "x3"])
        assert "x1" in result["selected_variables"]
        assert "x2" in result["selected_variables"]
        assert result["n_observations"] == n
        assert len(result["steps"]) >= 2

    def test_bic_criterion(self):
        np.random.seed(42)
        n = 100
        x1 = np.random.randn(n)
        y = 1.0 + 2.0 * x1 + np.random.randn(n) * 0.5
        df = pd.DataFrame({"y": y, "x1": x1})

        result = run_stepwise_selection(df, "y", ["x1"], criterion="bic")
        assert result["criterion"] == "bic"
        assert "x1" in result["selected_variables"]

    def test_missing_column(self):
        df = pd.DataFrame({"y": [1, 2], "x": [3, 4]})
        with pytest.raises(ValueError, match="not found"):
            run_stepwise_selection(df, "y", ["z"])

    def test_empty_after_dropna(self):
        df = pd.DataFrame({"y": [None, None], "x": [None, None]})
        with pytest.raises(ValueError, match="No complete"):
            run_stepwise_selection(df, "y", ["x"])

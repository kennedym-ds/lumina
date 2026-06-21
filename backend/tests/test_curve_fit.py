"""Tests for curve fitting endpoints."""

from __future__ import annotations

import io

import numpy as np
import pandas as pd


def _upload_curve_fit(client, x_data, y_data, filename: str = "cf.csv") -> str:
    """Upload a two-column CSV and return the dataset_id."""
    df = pd.DataFrame({"x": x_data, "y": y_data})
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    response = client.post(
        "/api/data/upload",
        files={"file": (filename, io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_models_endpoint_lists_all_models(client):
    """GET /api/curvefit/models returns a list of model descriptors."""
    response = client.get("/api/curvefit/models")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) >= 8

    names = [m["name"] for m in body]
    assert "linear" in names
    assert "exponential" in names
    assert "michaelis_menten" in names
    assert "logistic_4pl" in names

    # Each model entry has param_names
    for model in body:
        assert "name" in model
        assert "param_names" in model
        assert isinstance(model["param_names"], list)
        assert len(model["param_names"]) >= 1


def test_fit_linear_on_linear_data(client):
    """Fitting linear model on y=2x+3 data recovers R² ≈ 1 and correct params."""
    rng = np.random.default_rng(0)
    x = np.linspace(1, 10, 50)
    y = 2.0 * x + 3.0 + rng.normal(0, 0.01, 50)

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "linear"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["model_name"] == "linear"
    assert body["r_squared"] > 0.999
    assert body["n"] == 50
    assert "param_names" in body
    assert len(body["params"]) == len(body["param_names"])

    # a ≈ 2, b ≈ 3
    params = dict(zip(body["param_names"], body["params"]))
    assert abs(params["a"] - 2.0) < 0.1
    assert abs(params["b"] - 3.0) < 0.1

    # Check curve and data are present
    assert len(body["curve_x"]) > 0
    assert len(body["curve_y"]) == len(body["curve_x"])
    assert len(body["x_data"]) > 0
    assert len(body["y_data"]) == len(body["x_data"])

    # RMSE should be very small
    assert body["rmse"] < 0.1


def test_fit_exponential_on_exp_data(client):
    """Fitting exponential model on noisy exp data gives reasonable R²."""
    rng = np.random.default_rng(7)
    x = np.linspace(0.1, 3.0, 60)
    y = 2.0 * np.exp(0.8 * x) + 0.5 + rng.normal(0, 0.05, 60)

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "exponential"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["r_squared"] > 0.99


def test_fit_michaelis_menten_returns_two_params(client):
    """michaelis_menten model has exactly 2 parameters: Vmax and Km."""
    rng = np.random.default_rng(3)
    x = np.array([0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0])
    vmax, km = 10.0, 5.0
    y = vmax * x / (km + x) + rng.normal(0, 0.05, len(x))

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "michaelis_menten"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["param_names"] == ["Vmax", "Km"]
    assert len(body["params"]) == 2
    assert len(body["param_std_errors"]) == 2


def test_fit_too_few_points_returns_400(client):
    """Fewer data points than parameters triggers a 400 error."""
    # linear has 2 params, so we need >=3 points; give only 2
    x = [1.0, 2.0]
    y = [3.0, 5.0]

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "linear"},
    )

    assert response.status_code == 400


def test_fit_logarithmic_on_non_positive_x_returns_400(client):
    """Logarithmic model requires x > 0; negative x triggers 400."""
    x = [-1.0, 0.0, 1.0, 2.0, 3.0, 4.0]
    y = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "logarithmic"},
    )

    assert response.status_code == 400


def test_fit_unknown_model_returns_400(client):
    """An unknown model name returns a 400 error."""
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0]

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "nonexistent_model"},
    )

    assert response.status_code == 400


def test_fit_unknown_column_returns_400(client):
    """A column that isn't in the dataset returns a clean 400, not a 500."""
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0]

    dataset_id = _upload_curve_fit(client, x, y)
    response = client.post(
        f"/api/curvefit/{dataset_id}/fit",
        json={"x_column": "x", "y_column": "missing", "model_name": "linear"},
    )

    assert response.status_code == 400


def test_fit_missing_dataset_returns_404(client):
    """A dataset_id that doesn't exist returns 404."""
    response = client.post(
        "/api/curvefit/no-such-dataset/fit",
        json={"x_column": "x", "y_column": "y", "model_name": "linear"},
    )

    assert response.status_code == 404

"""Tests for multivariate (PCA + clustering) endpoints."""

from __future__ import annotations

import io

import numpy as np
import pandas as pd


def _upload_multivariate(client, n_rows: int = 100, n_cols: int = 4, seed: int = 0) -> tuple[str, list[str]]:
    """Upload a multi-column numeric CSV and return (dataset_id, column_names)."""
    rng = np.random.default_rng(seed)
    col_names = [f"x{i}" for i in range(n_cols)]
    data = {col: rng.normal(i, 1, size=n_rows) for i, col in enumerate(col_names)}
    df = pd.DataFrame(data)
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    response = client.post(
        "/api/data/upload",
        files={"file": ("mv.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"], col_names


def test_pca_returns_explained_variance(client):
    dataset_id, columns = _upload_multivariate(client, n_rows=80, n_cols=4)

    response = client.post(
        f"/api/multivariate/{dataset_id}/pca",
        json={"columns": columns},
    )

    assert response.status_code == 200
    body = response.json()

    evr = body["explained_variance_ratio"]
    assert len(evr) >= 1
    assert abs(sum(evr) - 1.0) < 1e-6, f"EVR should sum to 1.0, got {sum(evr)}"

    cumvar = body["cumulative_variance"]
    assert len(cumvar) == len(evr)
    assert cumvar[-1] > 0.99

    assert body["n_observations"] == 80
    assert body["feature_names"] == columns


def test_pca_loadings_per_feature(client):
    dataset_id, columns = _upload_multivariate(client, n_rows=60, n_cols=3)

    response = client.post(
        f"/api/multivariate/{dataset_id}/pca",
        json={"columns": columns, "n_components": 2},
    )

    assert response.status_code == 200
    body = response.json()
    loadings = body["loadings"]

    assert len(loadings) == len(columns)
    for row in loadings:
        assert row["feature"] in columns
        assert len(row["values"]) == 2  # n_components requested


def test_clustering_returns_correct_cluster_structure(client):
    dataset_id, columns = _upload_multivariate(client, n_rows=90, n_cols=3, seed=7)

    response = client.post(
        f"/api/multivariate/{dataset_id}/cluster",
        json={"columns": columns, "n_clusters": 3},
    )

    assert response.status_code == 200
    body = response.json()

    assert len(body["cluster_sizes"]) == 3
    assert sum(body["cluster_sizes"]) == 90

    labels = body["labels"]
    assert all(0 <= label < 3 for label in labels)
    assert len(labels) == len(body["x"]) == len(body["y"])

    assert body["inertia"] > 0
    assert body["silhouette"] is not None
    assert -1.0 <= body["silhouette"] <= 1.0
    assert body["n_observations"] == 90


def test_pca_too_few_columns_returns_400(client):
    dataset_id, columns = _upload_multivariate(client, n_rows=20, n_cols=4)

    response = client.post(
        f"/api/multivariate/{dataset_id}/pca",
        json={"columns": [columns[0]]},  # only 1 column
    )

    assert response.status_code == 400


def test_cluster_bad_n_clusters_returns_422(client):
    dataset_id, columns = _upload_multivariate(client, n_rows=50, n_cols=3)

    # n_clusters=1 violates the Pydantic ge=2 constraint → 422
    response = client.post(
        f"/api/multivariate/{dataset_id}/cluster",
        json={"columns": columns, "n_clusters": 1},
    )

    assert response.status_code == 422


def test_pca_missing_dataset_returns_404(client):
    response = client.post(
        "/api/multivariate/no-such-dataset/pca",
        json={"columns": ["a", "b"]},
    )

    assert response.status_code == 404

"""Multivariate analysis: PCA and KMeans clustering.

Implements Principal Component Analysis (PCA) with explained-variance reporting
and K-Means clustering with silhouette scoring, both built on standardized data.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

_MAX_ROWS = 2000
_RNG_SEED = 42


def _select_and_clean(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Select the requested columns, coerce to numeric, and drop NA rows."""
    subset = df[columns].apply(pd.to_numeric, errors="coerce").dropna()
    return subset


def compute_pca(
    df: pd.DataFrame,
    columns: list[str],
    n_components: int | None = None,
) -> dict[str, Any]:
    """Fit PCA on the selected numeric columns and return variance + scores.

    Parameters
    ----------
    df:
        The source DataFrame (may contain non-numeric columns — only ``columns``
        is used).
    columns:
        Names of numeric columns to include.
    n_components:
        Number of principal components to retain.  Defaults to
        ``min(len(columns), 10)``.

    Returns
    -------
    dict with keys:
        ``components``, ``feature_names``, ``explained_variance_ratio``,
        ``cumulative_variance``, ``loadings``, ``scores_pc1``, ``scores_pc2``,
        ``scores_pc3``, ``n_observations``.
    """

    if len(columns) < 2:
        raise ValueError("PCA requires at least 2 numeric columns.")

    subset = _select_and_clean(df, columns)
    n_rows = len(subset)
    if n_rows < 3:
        raise ValueError("PCA requires at least 3 rows after removing missing values.")

    if n_components is None:
        n_components = min(len(columns), 10)
    # PCA requires n_components <= min(n_samples, n_features); cap by both so a
    # small (wide) dataset returns a clean result instead of a sklearn error.
    n_components = max(1, min(n_components, len(columns), n_rows))

    scaler = StandardScaler()
    X = scaler.fit_transform(subset.to_numpy(dtype=float))

    pca = PCA(n_components=n_components)
    scores_full = pca.fit_transform(X)

    # Downsample rows to at most _MAX_ROWS for the score scatter.
    if n_rows > _MAX_ROWS:
        rng = np.random.default_rng(_RNG_SEED)
        idx = rng.choice(n_rows, size=_MAX_ROWS, replace=False)
        scores_sampled = scores_full[idx]
    else:
        scores_sampled = scores_full

    n_pc = pca.n_components_
    evr = pca.explained_variance_ratio_

    loadings = [
        {"feature": col, "values": [float(pca.components_[pc, i]) for pc in range(n_pc)]}
        for i, col in enumerate(columns)
    ]

    result: dict[str, Any] = {
        "components": n_pc,
        "feature_names": list(columns),
        "explained_variance_ratio": [float(v) for v in evr],
        "cumulative_variance": [float(v) for v in np.cumsum(evr)],
        "loadings": loadings,
        "scores_pc1": [float(v) for v in scores_sampled[:, 0]],
        "scores_pc2": [float(v) for v in scores_sampled[:, 1]] if n_pc >= 2 else [],
        "scores_pc3": [float(v) for v in scores_sampled[:, 2]] if n_pc >= 3 else [],
        "n_observations": n_rows,
    }
    return result


def compute_clustering(
    df: pd.DataFrame,
    columns: list[str],
    n_clusters: int,
) -> dict[str, Any]:
    """Fit KMeans clustering and return labels projected onto 2 PCs.

    Parameters
    ----------
    df:
        The source DataFrame.
    columns:
        Names of numeric columns to include.
    n_clusters:
        Number of clusters (must be in [2, 12]).

    Returns
    -------
    dict with keys:
        ``labels``, ``x``, ``y``, ``cluster_sizes``, ``inertia``,
        ``silhouette``, ``n_observations``.
    """

    if len(columns) < 2:
        raise ValueError("Clustering requires at least 2 numeric columns.")

    if not (2 <= n_clusters <= 12):
        raise ValueError("n_clusters must be between 2 and 12 (inclusive).")

    subset = _select_and_clean(df, columns)
    n_rows = len(subset)
    if n_rows < n_clusters:
        raise ValueError(
            f"Not enough rows ({n_rows}) for {n_clusters} clusters after removing missing values."
        )

    scaler = StandardScaler()
    X = scaler.fit_transform(subset.to_numpy(dtype=float))

    kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=_RNG_SEED)
    labels_full = kmeans.fit_predict(X)

    # 2-PC projection for the scatter plot.
    n_pcs = min(2, X.shape[1])
    pca2 = PCA(n_components=n_pcs)
    scores2 = pca2.fit_transform(X)

    # Downsample for the plot.
    if n_rows > _MAX_ROWS:
        rng = np.random.default_rng(_RNG_SEED)
        idx = rng.choice(n_rows, size=_MAX_ROWS, replace=False)
        labels_sampled = labels_full[idx]
        scores_sampled = scores2[idx]
    else:
        labels_sampled = labels_full
        scores_sampled = scores2

    cluster_sizes = [int((labels_full == k).sum()) for k in range(n_clusters)]

    # Silhouette is undefined for n_clusters < 2 or when all samples fall in one cluster.
    silhouette: float | None = None
    if n_clusters >= 2 and n_rows >= n_clusters + 1:
        try:
            silhouette = float(silhouette_score(X, labels_full))
        except Exception:
            silhouette = None

    return {
        "labels": [int(label) for label in labels_sampled],
        "x": [float(v) for v in scores_sampled[:, 0]],
        "y": [float(v) for v in scores_sampled[:, 1]] if n_pcs >= 2 else [0.0] * len(labels_sampled),
        "cluster_sizes": cluster_sizes,
        "inertia": float(kmeans.inertia_),
        "silhouette": silhouette,
        "n_observations": n_rows,
    }

"""Pydantic models for the multivariate (PCA + clustering) endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PCARequest(BaseModel):
    """Request for a PCA over a set of numeric columns."""

    columns: list[str]
    n_components: int | None = Field(default=None, ge=1)


class LoadingRow(BaseModel):
    """Per-feature PCA loadings across all retained components."""

    feature: str
    values: list[float]


class PCAResponse(BaseModel):
    """PCA results: variance decomposition, loadings, and sample scores."""

    components: int
    feature_names: list[str]
    explained_variance_ratio: list[float]
    cumulative_variance: list[float]
    loadings: list[LoadingRow]
    scores_pc1: list[float]
    scores_pc2: list[float]
    scores_pc3: list[float]
    n_observations: int


class ClusterRequest(BaseModel):
    """Request for KMeans clustering over a set of numeric columns."""

    columns: list[str]
    n_clusters: int = Field(default=3, ge=2, le=12)


class ClusterResponse(BaseModel):
    """KMeans clustering results with a 2-PC projection for plotting."""

    labels: list[int]
    x: list[float]
    y: list[float]
    cluster_sizes: list[int]
    inertia: float
    silhouette: float | None
    n_observations: int

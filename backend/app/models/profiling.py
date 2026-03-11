"""Pydantic models for dataset profiling."""

from __future__ import annotations

from pydantic import BaseModel


class ColumnProfile(BaseModel):
    """Detailed profile for a single column."""

    name: str
    dtype: str
    total_count: int
    missing_count: int
    missing_pct: float
    unique_count: int
    mean: float | None = None
    std: float | None = None
    min: float | None = None
    max: float | None = None
    median: float | None = None
    q1: float | None = None
    q3: float | None = None
    skewness: float | None = None
    kurtosis: float | None = None
    zeros_count: int | None = None
    histogram_bins: list[float] | None = None
    histogram_counts: list[int] | None = None
    top_values: list[dict[str, str | int | float]] | None = None
    memory_bytes: int = 0


class DatasetProfile(BaseModel):
    """Full dataset profiling report."""

    dataset_id: str
    row_count: int
    column_count: int
    total_memory_bytes: int
    duplicate_row_count: int
    columns: list[ColumnProfile]


class CorrelationRequest(BaseModel):
    """Request for correlation matrix computation."""

    method: str = "pearson"


class CorrelationResponse(BaseModel):
    """Correlation matrix response."""

    method: str
    columns: list[str]
    matrix: list[list[float | None]]

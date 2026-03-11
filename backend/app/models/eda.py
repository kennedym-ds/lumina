"""Pydantic request/response models for EDA chart endpoints."""

from pydantic import BaseModel, Field


class ChartRequest(BaseModel):
    """Chart generation request payload."""

    chart_type: str
    x: str | None = None
    y: str | None = None
    color: str | None = None
    facet: str | None = None
    nbins: int | None = None
    aggregation: str | None = None
    values: str | None = None


class ChartResponse(BaseModel):
    """Chart generation response payload."""

    chart_id: str
    chart_type: str
    plotly_figure: dict
    row_count: int
    webgl: bool
    warnings: list[str] = Field(default_factory=list)
    downsampled: bool = False
    displayed_row_count: int | None = None


class DownsampleRequest(BaseModel):
    """Request payload for chart-series downsampling."""

    x_column: str
    y_column: str
    threshold: int = Field(default=5000, ge=3)


class DownsampleResponse(BaseModel):
    """Response payload containing downsampled chart-series points."""

    x: list
    y: list
    original_count: int
    downsampled_count: int


class DistributionRequest(BaseModel):
    """Request payload for distribution comparison traces."""

    column: str
    group_by: str | None = None
    n_points: int = Field(default=200, ge=2)


class KDETrace(BaseModel):
    """A single density trace for one group."""

    group: str
    x: list[float]
    y: list[float]


class DistributionResponse(BaseModel):
    """Response payload for grouped density comparisons."""

    column: str
    group_by: str | None = None
    traces: list[KDETrace]

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


class ChartResponse(BaseModel):
    """Chart generation response payload."""

    chart_id: str
    chart_type: str
    plotly_figure: dict
    row_count: int
    webgl: bool


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

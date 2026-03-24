"""Pydantic models for project persistence and chart export."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChartState(BaseModel):
    """Serialized state of a single chart."""

    chart_id: str
    chart_type: str
    x: str | None = None
    y: str | None = None
    color: str | None = None
    facet: str | None = None
    nbins: int | None = None


class RegressionState(BaseModel):
    """Serialized regression configuration and optional fitted model artifacts."""

    model_type: str  # "ols" | "logistic" | "ridge" | "lasso" | "elastic_net" | "decision_tree" | "random_forest"
    dependent: str | None = None
    independents: list[str] = Field(default_factory=list)
    train_test_split: float = 1.0
    missing_strategy: str = "listwise"
    alpha: float = Field(default=1.0, gt=0)
    l1_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    polynomial_degree: int = Field(default=1, ge=1, le=5)
    max_depth: int | None = Field(default=None, ge=1)
    n_estimators: int = Field(default=100, ge=1)
    learning_rate: float = Field(default=0.1, gt=0)
    model_blob: str | None = None
    model_result: dict[str, Any] | None = None
    model_history: list[dict[str, Any]] | None = None


class CrossFilterState(BaseModel):
    """Serialized cross-filter selection state."""

    selected_indices: list[int] = Field(default_factory=list)
    selection_source: str | None = None


class DashboardPanelState(BaseModel):
    """Serialized dashboard panel layout metadata."""

    id: str
    chart_id: str
    x: int = Field(default=0, ge=0)
    y: int = Field(default=0, ge=0)
    w: int = Field(default=3, ge=1, le=6)
    h: int = Field(default=2, ge=1, le=4)


class ProjectSchema(BaseModel):
    """The .lumina project file schema."""

    version: str = "1.2"

    file_path: str
    file_name: str
    file_format: str
    sheet_name: str | None = None

    column_config: list[dict] = Field(default_factory=list)
    saved_views: list[dict] = Field(default_factory=list)
    excluded_columns: list[str] = Field(default_factory=list)

    charts: list[ChartState] = Field(default_factory=list)
    active_chart_id: str | None = None
    dashboard_panels: list[DashboardPanelState] = Field(default_factory=list)

    regression: RegressionState | None = None

    cross_filter: CrossFilterState | None = None


class SaveRequest(BaseModel):
    """Request body for project save."""

    file_path: str
    project: ProjectSchema


class LoadRequest(BaseModel):
    """Request body for project load."""

    file_path: str


class LoadResponse(BaseModel):
    """Response payload after loading a project and rebuilding session state."""

    dataset_id: str
    file_name: str
    file_format: str
    row_count: int
    column_count: int
    columns: list[dict]
    project: ProjectSchema


class ExportRequest(BaseModel):
    """Request body for chart export."""

    figure: dict
    format: str = "png"  # "png" | "svg"
    width: int = 1200
    height: int = 800
    scale: int = 2

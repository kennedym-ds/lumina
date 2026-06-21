"""Pydantic models for the curve fitting endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class ModelInfo(BaseModel):
    """Descriptor for a single curve-fitting model."""

    name: str
    param_names: list[str]


class CurveFitRequest(BaseModel):
    """Request body for fitting a named model to two numeric columns."""

    x_column: str
    y_column: str
    model_name: str


class CurveFitResponse(BaseModel):
    """Results of a curve fit: parameters, fit quality, and plot data."""

    model_name: str
    param_names: list[str]
    params: list[float]
    param_std_errors: list[float | None]
    r_squared: float
    rmse: float
    n: int
    x_data: list[float]
    y_data: list[float]
    curve_x: list[float]
    curve_y: list[float]

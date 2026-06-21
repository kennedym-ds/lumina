"""Pydantic models for the Design of Experiments (DOE) endpoint."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Factor(BaseModel):
    """A single experimental factor with its name and operating range."""

    name: str
    low: float
    high: float


class DesignRequest(BaseModel):
    """Request for generating a DOE design matrix."""

    factors: list[Factor]
    design_type: Literal["full_factorial", "fractional_factorial", "plackett_burman"]
    levels: int = Field(default=2, ge=2)
    fraction: int = Field(default=1, ge=1)  # exponent p in 2^(k-p)
    n_center: int = Field(default=0, ge=0)


class DesignResponse(BaseModel):
    """Generated DOE design matrix with metadata."""

    design_type: str
    factor_names: list[str]
    n_runs: int
    runs: list[dict[str, Any]]
    resolution: int | None
    generators: list[str] | None
    notes: list[str]

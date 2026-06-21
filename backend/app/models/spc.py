"""Pydantic models for the SPC (control chart + capability) endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ControlChartRequest(BaseModel):
    """Request for a control chart over one numeric column."""

    column: str
    # Control-chart constants are only defined through subgroup size 10.
    subgroup_size: int = Field(default=1, ge=1, le=10)


class ControlChartSeries(BaseModel):
    """One plotted series (e.g. Individuals, Moving Range) with its limits."""

    name: str
    points: list[float]
    center_line: float
    ucl: float
    lcl: float


class ControlChartViolation(BaseModel):
    """A point that violated one or more run rules on the primary series."""

    index: int
    point: float
    rules: list[int]


class ControlChartResponse(BaseModel):
    """Control chart payload: primary + secondary series and rule violations."""

    chart_kind: Literal["imr", "xbar_r", "xbar_s"]
    column: str
    subgroup_size: int
    primary: ControlChartSeries
    secondary: ControlChartSeries
    violations: list[ControlChartViolation]
    sigma: float


class CapabilityRequest(BaseModel):
    """Request for a process-capability analysis with specification limits."""

    column: str
    lsl: float | None = None
    usl: float | None = None
    target: float | None = None
    # Control-chart constants are only defined through subgroup size 10.
    subgroup_size: int = Field(default=1, ge=1, le=10)


class CapabilityHistogram(BaseModel):
    counts: list[int]
    bin_edges: list[float]


class CapabilityResponse(BaseModel):
    """Process-capability indices plus an out-of-spec estimate and histogram."""

    column: str
    n: int
    mean: float
    std_overall: float
    std_within: float
    lsl: float | None
    usl: float | None
    target: float | None
    cp: float | None
    cpk: float | None
    pp: float | None
    ppk: float | None
    ppm_below: float
    ppm_above: float
    ppm_total: float
    observed_out_of_spec: int
    histogram: CapabilityHistogram

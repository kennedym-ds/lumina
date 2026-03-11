"""Pydantic models for row-level filter rules."""

from typing import Any

from pydantic import BaseModel, Field


class FilterRule(BaseModel):
    """A single row-level filter rule."""

    column: str
    operator: str
    value: Any = None


class FilterRequest(BaseModel):
    """Request payload for setting active filters on a dataset."""

    filters: list[FilterRule] = Field(default_factory=list)
    logic: str = "and"


class FilterResponse(BaseModel):
    """Summary response after applying a filter set."""

    applied_count: int
    matched_rows: int
    total_rows: int

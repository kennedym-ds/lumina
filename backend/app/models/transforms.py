"""Pydantic models for column transform operations."""

from typing import Any
from pydantic import BaseModel, Field


class TransformRequest(BaseModel):
    """Request to create a computed column."""

    transform_type: str
    output_column: str
    source_column: str
    params: dict[str, Any] = Field(default_factory=dict)


class TransformResponse(BaseModel):
    """Response after creating a computed column."""

    output_column: str
    row_count: int
    null_count: int
    dtype: str
    preview: list


class TransformListResponse(BaseModel):
    """Available transform types."""

    transforms: list[dict[str, str]]

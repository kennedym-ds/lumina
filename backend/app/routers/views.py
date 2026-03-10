"""Favourite/saved views API routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.session import store

router = APIRouter(prefix="/api/views", tags=["views"])


class ViewSchema(BaseModel):
    """Saved view snapshot payload."""

    view_id: str
    name: str
    charts: list[dict[str, Any]]
    active_chart_id: str | None = None
    cross_filter: dict[str, Any] | None = None
    created_at: str


class CreateViewRequest(BaseModel):
    """Request payload for creating a saved view."""

    name: str = Field(min_length=1)
    charts: list[dict[str, Any]]
    active_chart_id: str | None = None
    cross_filter: dict[str, Any] | None = None


class RenameViewRequest(BaseModel):
    """Request payload for renaming a saved view."""

    name: str = Field(min_length=1)


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _find_view(session, view_id: str) -> tuple[int, dict[str, Any]]:
    for index, view in enumerate(session.saved_views):
        if view.get("view_id") == view_id:
            return index, view
    raise HTTPException(status_code=404, detail=f"View {view_id} not found")


@router.get("/{dataset_id}", response_model=list[ViewSchema])
async def list_views(dataset_id: str):
    """List all saved views for a dataset."""

    session = _get_session(dataset_id)
    return [ViewSchema.model_validate(view) for view in session.saved_views]


@router.post("/{dataset_id}", response_model=ViewSchema)
async def create_view(dataset_id: str, request: CreateViewRequest):
    """Create a saved view snapshot for the dataset."""

    session = _get_session(dataset_id)

    new_view = ViewSchema(
        view_id=str(uuid.uuid4()),
        name=request.name.strip(),
        charts=request.charts,
        active_chart_id=request.active_chart_id,
        cross_filter=request.cross_filter,
        created_at=datetime.now(UTC).isoformat(),
    )

    session.saved_views.append(new_view.model_dump())
    return new_view


@router.get("/{dataset_id}/{view_id}", response_model=ViewSchema)
async def get_view(dataset_id: str, view_id: str):
    """Get a saved view by ID."""

    session = _get_session(dataset_id)
    _, view = _find_view(session, view_id)
    return ViewSchema.model_validate(view)


@router.put("/{dataset_id}/{view_id}", response_model=ViewSchema)
async def rename_view(dataset_id: str, view_id: str, request: RenameViewRequest):
    """Rename an existing saved view."""

    session = _get_session(dataset_id)
    index, view = _find_view(session, view_id)
    updated_view = {**view, "name": request.name.strip()}
    session.saved_views[index] = updated_view
    return ViewSchema.model_validate(updated_view)


@router.delete("/{dataset_id}/{view_id}")
async def delete_view(dataset_id: str, view_id: str):
    """Delete a saved view by ID."""

    session = _get_session(dataset_id)
    index, _ = _find_view(session, view_id)
    session.saved_views.pop(index)
    return {"ok": True}

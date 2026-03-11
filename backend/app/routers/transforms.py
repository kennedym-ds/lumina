"""Computed column transform API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.transforms import TransformListResponse, TransformRequest, TransformResponse
from app.services.ingestion import infer_lumina_dtype
from app.services.transforms import (
    apply_transform_to_session,
    list_transform_types,
    preview_values,
    remove_computed_column,
)
from app.session import store

router = APIRouter(prefix="/api/transforms", tags=["transforms"])


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.get("/types", response_model=TransformListResponse)
def get_transform_types() -> TransformListResponse:
    """List available transform types."""

    return TransformListResponse(transforms=list_transform_types())


@router.post("/{dataset_id}/apply", response_model=TransformResponse)
def apply_transform(dataset_id: str, request: TransformRequest) -> TransformResponse:
    """Create a computed column for a dataset."""

    session = _get_session(dataset_id)

    try:
        series = apply_transform_to_session(session, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TransformResponse(
        output_column=request.output_column,
        row_count=int(len(series)),
        null_count=int(series.isna().sum()),
        dtype=infer_lumina_dtype(series),
        preview=preview_values(series),
    )


@router.delete("/{dataset_id}/column/{column_name}")
def delete_transform_column(dataset_id: str, column_name: str) -> dict[str, bool | str]:
    """Delete a computed column from the dataset."""

    session = _get_session(dataset_id)

    try:
        remove_computed_column(session, column_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"ok": True, "column_name": column_name}

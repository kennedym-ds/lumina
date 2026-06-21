"""Curve fitting API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.curve_fit import CurveFitRequest, CurveFitResponse, ModelInfo
from app.services.curve_fit import fit_curve, list_models
from app.services.error_translator import translate_error
from app.session import store

router = APIRouter(prefix="/api/curvefit", tags=["curvefit"])


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.get("/models", response_model=list[ModelInfo])
async def models():
    """List all available curve-fitting models and their parameter names."""
    return [ModelInfo(**entry) for entry in list_models()]


@router.post("/{dataset_id}/fit", response_model=CurveFitResponse)
async def fit(dataset_id: str, request: CurveFitRequest):
    """Fit a named nonlinear model to two numeric columns of the dataset."""
    session = _get_session(dataset_id)
    try:
        result = fit_curve(
            session.active_dataframe,
            request.x_column,
            request.y_column,
            request.model_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return CurveFitResponse(**result)

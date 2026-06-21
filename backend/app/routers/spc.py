"""SPC API routes — control charts and process capability."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.spc import (
    CapabilityRequest,
    CapabilityResponse,
    ControlChartRequest,
    ControlChartResponse,
)
from app.services.error_translator import translate_error
from app.services.spc import compute_capability, compute_control_chart
from app.session import store

router = APIRouter(prefix="/api/spc", tags=["spc"])


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.post("/{dataset_id}/control-chart", response_model=ControlChartResponse)
async def control_chart(dataset_id: str, request: ControlChartRequest):
    """Compute an I-MR or Xbar-R/S control chart for a numeric column."""

    session = _get_session(dataset_id)
    try:
        result = compute_control_chart(session.active_dataframe, request.column, request.subgroup_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return ControlChartResponse(**result)


@router.post("/{dataset_id}/capability", response_model=CapabilityResponse)
async def capability(dataset_id: str, request: CapabilityRequest):
    """Compute process-capability indices (Cp/Cpk/Pp/Ppk) against spec limits."""

    session = _get_session(dataset_id)
    try:
        result = compute_capability(
            session.active_dataframe,
            request.column,
            request.lsl,
            request.usl,
            request.target,
            request.subgroup_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return CapabilityResponse(**result)

"""DOE API routes — Design of Experiments design generation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.doe import DesignRequest, DesignResponse
from app.services.doe import generate_design
from app.services.error_translator import translate_error

router = APIRouter(prefix="/api/doe", tags=["doe"])


@router.post("/design", response_model=DesignResponse)
async def design(request: DesignRequest):
    """Generate a DOE design matrix from the supplied factor definitions."""

    factors = [{"name": f.name, "low": f.low, "high": f.high} for f in request.factors]
    try:
        result = generate_design(
            factors=factors,
            design_type=request.design_type,
            levels=request.levels,
            fraction=request.fraction,
            n_center=request.n_center,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return DesignResponse(**result)

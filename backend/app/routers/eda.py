"""EDA chart generation API routes."""

import uuid

from fastapi import APIRouter, HTTPException
import pandas as pd

from app.models.eda import ChartRequest, ChartResponse, DownsampleRequest, DownsampleResponse
from app.services.chart_builder import build_chart_figure
from app.services.downsampling import lttb_downsample
from app.session import store

router = APIRouter(prefix="/api/eda", tags=["eda"])


def _get_session(dataset_id: str):
    """Get a dataset session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.post("/{dataset_id}/chart", response_model=ChartResponse)
async def create_chart(dataset_id: str, request: ChartRequest):
    """Create a Plotly JSON figure for a dataset based on chart configuration."""

    session = _get_session(dataset_id)

    try:
        figure, row_count, webgl = build_chart_figure(session.dataframe, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ChartResponse(
        chart_id=str(uuid.uuid4()),
        chart_type=request.chart_type,
        plotly_figure=figure,
        row_count=row_count,
        webgl=webgl,
    )


@router.post("/{dataset_id}/downsample", response_model=DownsampleResponse)
async def downsample_chart(dataset_id: str, request: DownsampleRequest):
    """Downsample chart data for large time-series rendering."""

    session = _get_session(dataset_id)
    df = session.dataframe

    if request.x_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{request.x_column}' not found")
    if request.y_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{request.y_column}' not found")

    data = df[[request.x_column, request.y_column]].copy()
    data = data.dropna(subset=[request.x_column, request.y_column])

    if data.empty:
        return DownsampleResponse(x=[], y=[], original_count=0, downsampled_count=0)

    y_numeric = pd.to_numeric(data[request.y_column], errors="coerce")
    valid_mask = y_numeric.notna()
    data = data[valid_mask]
    y_numeric = y_numeric[valid_mask]

    if data.empty:
        raise HTTPException(status_code=400, detail=f"Column '{request.y_column}' must be numeric")

    x_values = data[request.x_column].tolist()
    y_values = y_numeric.astype(float).tolist()
    original_count = len(x_values)

    try:
        sampled_x, sampled_y = lttb_downsample(x_values, y_values, request.threshold)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DownsampleResponse(
        x=[_json_safe(item) for item in sampled_x],
        y=[_json_safe(item) for item in sampled_y],
        original_count=original_count,
        downsampled_count=len(sampled_x),
    )


def _json_safe(value):
    """Convert pandas/numpy scalar values to JSON-safe primitives."""

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except TypeError:
            pass

    if hasattr(value, "item"):
        try:
            return value.item()
        except (ValueError, TypeError):
            pass

    return value

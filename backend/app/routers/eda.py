"""EDA chart generation API routes."""

import uuid

from fastapi import APIRouter, HTTPException
import pandas as pd

from app.models.eda import (
    ChartRequest,
    ChartResponse,
    DistributionRequest,
    DistributionResponse,
    DownsampleRequest,
    DownsampleResponse,
)
from app.models.profiling import CorrelationRequest, CorrelationResponse, DatasetProfile
from app.services.chart_builder import build_chart_figure
from app.services.distribution import compute_kde
from app.services.downsampling import lttb_downsample
from app.services.profiling import compute_correlation, profile_dataset
from app.session import store

router = APIRouter(prefix="/api/eda", tags=["eda"])


def _get_session(dataset_id: str):
    """Get a dataset session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _remember_chart_config(session, request: ChartRequest) -> None:
    chart_config = request.model_dump(exclude_none=True)
    if chart_config in session.chart_configs:
        session.chart_configs = [item for item in session.chart_configs if item != chart_config]
    session.chart_configs.append(chart_config)
    session.chart_configs = session.chart_configs[-10:]


@router.post("/{dataset_id}/chart", response_model=ChartResponse)
async def create_chart(dataset_id: str, request: ChartRequest):
    """Create a Plotly JSON figure for a dataset based on chart configuration."""

    session = _get_session(dataset_id)

    try:
        figure, row_count, webgl, warnings, downsampled, displayed_count = build_chart_figure(
            session.active_dataframe, request
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _remember_chart_config(session, request)

    return ChartResponse(
        chart_id=str(uuid.uuid4()),
        chart_type=request.chart_type,
        plotly_figure=figure,
        row_count=row_count,
        webgl=webgl,
        warnings=warnings,
        downsampled=downsampled,
        displayed_row_count=displayed_count,
    )


@router.post("/{dataset_id}/downsample", response_model=DownsampleResponse)
async def downsample_chart(dataset_id: str, request: DownsampleRequest):
    """Downsample chart data for large time-series rendering."""

    session = _get_session(dataset_id)
    df = session.active_dataframe

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


@router.post("/{dataset_id}/distribution", response_model=DistributionResponse)
async def get_distribution(dataset_id: str, request: DistributionRequest):
    """Compute KDE distribution traces for a numeric column, optionally grouped."""

    session = _get_session(dataset_id)

    try:
        traces = compute_kde(
            session.active_dataframe,
            request.column,
            request.group_by,
            request.n_points,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DistributionResponse(column=request.column, group_by=request.group_by, traces=traces)


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


@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
async def get_profile(dataset_id: str):
    """Generate a comprehensive profiling report for the dataset."""

    session = _get_session(dataset_id)
    profile = profile_dataset(dataset_id, session.active_dataframe)
    session.profile_snapshot = profile.model_dump()
    return profile


@router.post("/{dataset_id}/correlation", response_model=CorrelationResponse)
async def get_correlation(dataset_id: str, request: CorrelationRequest):
    """Compute a correlation matrix for the dataset's numeric columns."""

    session = _get_session(dataset_id)

    try:
        columns, matrix = compute_correlation(session.active_dataframe, request.method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CorrelationResponse(method=request.method, columns=columns, matrix=matrix)

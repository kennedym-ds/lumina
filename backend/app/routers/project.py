"""Project persistence and export API routes."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from app.models.project import ExportRequest, LoadRequest, LoadResponse, SaveRequest
from app.services.export import export_figure
from app.services.ingestion import build_column_info, load_file
from app.services.project import load_project, save_project, validate_data_file
from app.session import DatasetSession, store

router = APIRouter(prefix="/api/project", tags=["project"])

_ALLOWED_EXPORT_FORMATS = {"png", "svg"}
_MAX_IMAGE_DIMENSION = 4000
_MAX_SCALE = 4


def _require_absolute_path(file_path: str, *, field_name: str) -> Path:
    path = Path(file_path)
    if not path.is_absolute():
        raise HTTPException(status_code=400, detail=f"{field_name} must be an absolute path")
    if any(part == ".." for part in path.parts):
        raise HTTPException(status_code=400, detail=f"{field_name} must not contain path traversal")
    return path


@router.post("/save")
async def save_project_route(request: SaveRequest):
    """Save serialized project state to disk."""

    target = _require_absolute_path(request.file_path, field_name="file_path")
    save_project(request.project, str(target))
    return {"status": "ok", "file_path": str(target)}


@router.post("/load", response_model=LoadResponse)
async def load_project_route(request: LoadRequest):
    """Load a project file, re-ingest its source data, and create a new session."""

    target = _require_absolute_path(request.file_path, field_name="file_path")

    try:
        project = load_project(str(target))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    _require_absolute_path(project.file_path, field_name="project.file_path")

    if not validate_data_file(project.file_path):
        return JSONResponse(
            status_code=404,
            content={
                "detail": f"Data file not found: {project.file_path}",
                "missing_file": project.file_path,
            },
        )

    data_file_path = Path(project.file_path)
    file_bytes = data_file_path.read_bytes()

    try:
        dataframe = load_file(file_bytes, str(data_file_path), sheet_name=project.sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    dataset_id = str(uuid.uuid4())
    session = DatasetSession(
        dataset_id=dataset_id,
        file_path=project.file_path,
        file_name=project.file_name,
        file_format=project.file_format,
        dataframe=dataframe,
        original_dtypes={str(c): str(dataframe[c].dtype) for c in dataframe.columns},
        column_config=project.column_config,
        sheet_name=project.sheet_name,
    )
    store.create(session)

    columns = [column.model_dump() for column in build_column_info(dataframe)]

    return LoadResponse(
        dataset_id=dataset_id,
        file_name=session.file_name,
        file_format=session.file_format,
        row_count=session.row_count,
        column_count=session.column_count,
        columns=columns,
        project=project,
    )


@router.post("/export")
async def export_route(request: ExportRequest):
    """Render a Plotly figure to PNG or SVG bytes."""

    export_format = request.format.lower()
    if export_format not in _ALLOWED_EXPORT_FORMATS:
        raise HTTPException(status_code=400, detail="format must be one of: png, svg")

    if request.width <= 0 or request.width > _MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=400, detail=f"width must be between 1 and {_MAX_IMAGE_DIMENSION}")

    if request.height <= 0 or request.height > _MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=400, detail=f"height must be between 1 and {_MAX_IMAGE_DIMENSION}")

    if request.scale <= 0 or request.scale > _MAX_SCALE:
        raise HTTPException(status_code=400, detail=f"scale must be between 1 and {_MAX_SCALE}")

    try:
        image_bytes = export_figure(
            request.figure,
            fmt=export_format,
            width=request.width,
            height=request.height,
            scale=request.scale,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    media_type = "image/png" if export_format == "png" else "image/svg+xml"
    return Response(content=image_bytes, media_type=media_type)

"""Dataset export API routes."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.export_service import export_dataframe_csv, export_dataframe_excel, export_inference_results, generate_summary_report
from app.services.profiling import profile_dataset
from app.session import DatasetSession, store

router = APIRouter(prefix="/api/export", tags=["export"])


def _get_session(dataset_id: str) -> DatasetSession:
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _base_file_name(session: DatasetSession) -> str:
    name = Path(session.file_name).stem.strip()
    return name or "dataset"


def _build_regression_summary(session: DatasetSession) -> dict | None:
    if not session.model_config_dict:
        return None

    summary = dict(session.model_config_dict)
    if session.model_history:
        latest = session.model_history[-1]
        for key in ("r_squared", "rmse", "mae", "aic", "bic", "accuracy", "f1", "n_observations"):
            if key in latest and latest[key] is not None:
                summary[key] = latest[key]
    return summary


@router.get("/{dataset_id}/csv")
async def export_csv(dataset_id: str):
    """Export the active filtered dataset as CSV."""

    session = _get_session(dataset_id)
    csv_bytes = export_dataframe_csv(session.active_dataframe)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{_base_file_name(session)}.csv"'},
    )


@router.get("/{dataset_id}/excel")
async def export_excel(dataset_id: str):
    """Export the active filtered dataset as Excel."""

    session = _get_session(dataset_id)
    excel_bytes = export_dataframe_excel(session.active_dataframe)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{_base_file_name(session)}.xlsx"'},
    )


@router.get("/{dataset_id}/report")
async def export_report(dataset_id: str):
    """Generate a Markdown analysis report from the current session state."""

    session = _get_session(dataset_id)
    profile_data = profile_dataset(dataset_id, session.active_dataframe).model_dump()
    session.profile_snapshot = profile_data

    report_md = generate_summary_report(
        profile_data=profile_data,
        chart_configs=list(session.chart_configs),
        inference_results=list(session.inference_results),
        regression_summary=_build_regression_summary(session),
    )
    return Response(
        content=report_md.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="lumina-report.md"'},
    )


@router.get("/{dataset_id}/inference-report")
def download_inference_report(dataset_id: str, fmt: Literal["markdown", "csv"] = "markdown"):
    """Download stored inference results as Markdown or CSV."""
    session = _get_session(dataset_id)
    results = list(session.inference_results)
    markdown, csv_bytes = export_inference_results(results)

    if fmt == "csv":
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{_base_file_name(session)}_inference.csv"'},
        )
    return Response(
        content=markdown.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{_base_file_name(session)}_inference.md"'},
    )
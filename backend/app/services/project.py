"""Project persistence helpers for .lumina files."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException

from app.models.project import ProjectSchema, RegressionState
from app.services.regression import deserialize_model, serialize_model

if TYPE_CHECKING:
    from app.session import DatasetSession


logger = logging.getLogger(__name__)


def _build_regression_state(project: ProjectSchema, session: "DatasetSession") -> RegressionState | None:
    existing_regression = project.regression.model_dump(exclude_none=True) if project.regression else {}
    regression_payload: dict[str, Any] = {
        **existing_regression,
        **session.model_config_dict,
    }

    model_blob = serialize_model(session)
    if model_blob is not None:
        regression_payload["model_blob"] = model_blob

    if session.model_result_payload is not None:
        regression_payload["model_result"] = dict(session.model_result_payload)

    if session.model_history:
        regression_payload["model_history"] = [dict(entry) for entry in session.model_history]

    return RegressionState(**regression_payload) if regression_payload else None


def apply_session_state_to_project(project: ProjectSchema, session: "DatasetSession") -> ProjectSchema:
    """Merge in-memory session state into a project payload before save."""

    return project.model_copy(
        update={
            "sheet_name": session.sheet_name or project.sheet_name,
            "column_config": session.column_config or project.column_config,
            "saved_views": session.saved_views or project.saved_views,
            "excluded_columns": sorted(session.excluded_columns) or project.excluded_columns,
            "regression": _build_regression_state(project, session),
        }
    )


def restore_project_state(session: "DatasetSession", project: ProjectSchema) -> None:
    """Restore persisted regression artifacts from a project payload onto a session."""

    regression = project.regression
    if regression is None:
        return

    session.model_config_dict = regression.model_dump(
        exclude_none=True,
        exclude={"model_blob", "model_result", "model_history"},
    )

    if regression.model_result is not None:
        session.model_result_payload = dict(regression.model_result)

    if regression.model_history:
        session.model_history = [dict(entry) for entry in regression.model_history]

    if regression.model_blob:
        try:
            deserialize_model(regression.model_blob, session)
        except HTTPException:
            logger.warning(
                "Could not restore model from project file — signature mismatch or corrupted blob. "
                "Model will need to be re-fit."
            )


def save_project(project: ProjectSchema, file_path: str) -> None:
    """Write a .lumina project JSON file atomically."""

    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    payload = json.dumps(project.model_dump(), indent=2, default=str)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def load_project(file_path: str) -> ProjectSchema:
    """Read and parse a .lumina project file from disk."""

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Project file not found: {file_path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    return ProjectSchema(**raw)


def validate_data_file(file_path: str) -> bool:
    """Check whether the referenced data file exists."""

    return Path(file_path).exists()

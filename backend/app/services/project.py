"""Project persistence helpers for .lumina files."""

from __future__ import annotations

import json
from pathlib import Path

from app.models.project import ProjectSchema


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

"""In-memory dataset session store.

Holds loaded DataFrames and metadata keyed by dataset UUID.
Single-session design — only one dataset active at startup,
supporting multiple datasets for future multi-tab work.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

import pandas as pd


@dataclass
class DatasetSession:
    """A loaded dataset with metadata and user configuration."""

    dataset_id: str
    file_path: str
    file_name: str
    file_format: str  # "csv" | "excel" | "parquet"
    dataframe: pd.DataFrame
    original_dtypes: dict[str, str] = field(default_factory=dict)
    column_config: list[dict[str, Any]] = field(default_factory=list)
    sheet_name: str | None = None
    model_result: Any = None
    model_config_dict: dict[str, Any] = field(default_factory=dict)
    model_predictions: dict[str, Any] = field(default_factory=dict)
    saved_views: list[dict[str, Any]] = field(default_factory=list)

    @property
    def row_count(self) -> int:
        return len(self.dataframe)

    @property
    def column_count(self) -> int:
        return len(self.dataframe.columns)


class SessionStore:
    """Thread-safe (GIL-protected) in-memory store for dataset sessions."""

    def __init__(self) -> None:
        self._sessions: dict[str, DatasetSession] = {}

    def create(self, session: DatasetSession) -> str:
        self._sessions[session.dataset_id] = session
        return session.dataset_id

    def get(self, dataset_id: str) -> DatasetSession | None:
        return self._sessions.get(dataset_id)

    def delete(self, dataset_id: str) -> bool:
        return self._sessions.pop(dataset_id, None) is not None

    def list_ids(self) -> list[str]:
        return list(self._sessions.keys())


# Global singleton
store = SessionStore()

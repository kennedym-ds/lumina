"""In-memory dataset session store.

Holds loaded DataFrames and metadata keyed by dataset UUID.
Single-session design — only one dataset active at startup,
supporting multiple datasets for future multi-tab work.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from app.models.filters import FilterRule


@dataclass
class DatasetSession:
    """A loaded dataset with metadata and user configuration."""

    dataset_id: str
    file_path: str
    file_name: str
    file_format: str  # "csv" | "tsv" | "excel" | "parquet" | "json" | "sqlite" | "feather" | "arrow"
    dataframe: pd.DataFrame
    original_dtypes: dict[str, str] = field(default_factory=dict)
    column_config: list[dict[str, Any]] = field(default_factory=list)
    excluded_columns: set[str] = field(default_factory=set)
    active_filters: list[FilterRule] = field(default_factory=list)
    sheet_name: str | None = None
    model_result: Any = None
    model_config_dict: dict[str, Any] = field(default_factory=dict)
    model_predictions: dict[str, Any] = field(default_factory=dict)
    model_history: list[dict[str, Any]] = field(default_factory=list)
    chart_configs: list[dict[str, Any]] = field(default_factory=list)
    dashboard_panels: list[dict[str, Any]] = field(default_factory=list)
    inference_results: list[dict[str, Any]] = field(default_factory=list)
    profile_snapshot: dict[str, Any] | None = None
    saved_views: list[dict[str, Any]] = field(default_factory=list)
    computed_columns: set[str] = field(default_factory=set)

    def clear_analysis_artifacts(self) -> None:
        """Reset derived analysis artifacts after a dataset mutation."""

        self.model_result = None
        self.model_config_dict = {}
        self.model_predictions = {}
        self.chart_configs = []
        self.dashboard_panels = []
        self.inference_results = []
        self.profile_snapshot = None

    @property
    def row_count(self) -> int:
        return len(self.dataframe)

    @property
    def column_count(self) -> int:
        return len(self.active_columns)

    @property
    def filtered_dataframe(self) -> pd.DataFrame:
        """DataFrame with excluded columns removed and row filters applied."""

        from app.services.filter_engine import apply_filters

        df = self.dataframe.loc[:, self.active_columns]
        if self.active_filters:
            df = apply_filters(df, self.active_filters)
        return df

    @property
    def active_dataframe(self) -> pd.DataFrame:
        """Backward-compatible alias for the current filtered active DataFrame."""

        return self.filtered_dataframe

    @property
    def filtered_row_count(self) -> int:
        """Row count after active filters are applied."""

        return len(self.filtered_dataframe)

    @property
    def active_columns(self) -> list[str]:
        """Column names excluding excluded columns."""

        return [str(column) for column in self.dataframe.columns if str(column) not in self.excluded_columns]


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

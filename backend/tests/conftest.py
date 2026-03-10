"""Shared test fixtures for backend tests."""

import io
import numpy as np
import pytest
from fastapi.testclient import TestClient
import pandas as pd

from app.main import create_app
from app.session import store


@pytest.fixture(autouse=True)
def clear_store():
    """Clear the session store before each test."""
    store._sessions.clear()
    yield
    store._sessions.clear()


@pytest.fixture
def client():
    """Create a test client without auth."""
    from app.config import settings
    settings.token = ""
    settings.debug = True
    app = create_app()
    return TestClient(app)


@pytest.fixture
def sample_csv_bytes() -> bytes:
    """Generate a small CSV file as bytes."""
    df = pd.DataFrame({
        "id": range(1, 101),
        "name": [f"item_{i}" for i in range(1, 101)],
        "value": [float(i) * 1.5 for i in range(1, 101)],
        "category": ["A", "B", "C", "D"] * 25,
        "date": pd.date_range("2024-01-01", periods=100, freq="D").astype(str),
    })
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


@pytest.fixture
def large_csv_bytes() -> bytes:
    """Generate a large CSV file (>10K rows) as bytes."""
    row_count = 12050
    df = pd.DataFrame({
        "id": range(1, row_count + 1),
        "value": [float(i % 1000) * 1.1 for i in range(1, row_count + 1)],
        "category": ["A", "B", "C", "D", "E"] * (row_count // 5),
    })
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


@pytest.fixture
def sample_excel_bytes() -> bytes:
    """Generate a multi-sheet Excel file as bytes."""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]}).to_excel(
            writer, sheet_name="Sheet1", index=False
        )
        pd.DataFrame({"c": [4, 5, 6], "d": [7.0, 8.0, 9.0]}).to_excel(
            writer, sheet_name="Sheet2", index=False
        )
    return buffer.getvalue()


@pytest.fixture
def sample_parquet_bytes() -> bytes:
    """Generate a Parquet file as bytes."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    table = pa.table({
        "int_col": [1, 2, 3, 4, 5],
        "float_col": [1.1, 2.2, 3.3, 4.4, 5.5],
        "str_col": ["a", "b", "c", "d", "e"],
    })
    buffer = io.BytesIO()
    pq.write_table(table, buffer)
    return buffer.getvalue()


@pytest.fixture
def regression_csv_bytes() -> bytes:
    """Generate numeric regression data for OLS tests."""

    rng = np.random.default_rng(42)
    size = 120
    x1 = rng.normal(0, 1, size)
    x2 = rng.normal(2, 1.5, size)
    noise = rng.normal(0, 0.2, size)
    y = 1.5 + 2.2 * x1 - 0.7 * x2 + noise

    df = pd.DataFrame({"y": y, "x1": x1, "x2": x2})
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


@pytest.fixture
def logistic_csv_bytes() -> bytes:
    """Generate binary-target data for logistic regression tests."""

    rng = np.random.default_rng(7)
    size = 160
    x1 = rng.normal(0, 1, size)
    x2 = rng.normal(0, 1, size)
    logits = -0.1 + 1.0 * x1 - 0.8 * x2
    probs = 1 / (1 + np.exp(-logits))
    y = rng.binomial(1, probs)

    df = pd.DataFrame({"target": y, "x1": x1, "x2": x2})
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


@pytest.fixture
def missing_csv_bytes() -> bytes:
    """Generate data with missing values for missing-value strategy tests."""

    df = pd.DataFrame(
        {
            "y": [10.0, 11.5, 12.1, 13.0, 14.2, 15.0, 16.3, 17.1],
            "x1": [1.0, 2.0, np.nan, 4.0, 5.0, np.nan, 7.0, 8.0],
            "x2": [2.5, np.nan, 3.1, 3.8, 4.2, 4.7, np.nan, 5.3],
        }
    )
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


@pytest.fixture
def collinear_csv_bytes() -> bytes:
    """Generate perfectly collinear predictors to trigger singular matrix handling."""

    col_a = np.arange(1, 41, dtype=float)
    col_b = 2.0 * col_a
    y = 5.0 + 1.5 * col_a

    df = pd.DataFrame({"y": y, "col_a": col_a, "col_b": col_b})
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()

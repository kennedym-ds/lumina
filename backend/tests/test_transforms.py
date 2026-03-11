"""Tests for computed column transforms and API routes."""

import io
import math

import numpy as np
import pandas as pd
import pytest

from app.models.transforms import TransformRequest
from app.services.transforms import apply_transform, list_transform_types


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("transforms.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_log_transform_supports_natural_and_base10() -> None:
    df = pd.DataFrame({"value": [1.0, math.e, 10.0, 100.0]})

    natural = apply_transform(
        df,
        TransformRequest(
            transform_type="log",
            output_column="value_log",
            source_column="value",
            params={"base": "e"},
        ),
    )
    base10 = apply_transform(
        df,
        TransformRequest(
            transform_type="log",
            output_column="value_log10",
            source_column="value",
            params={"base": 10},
        ),
    )

    np.testing.assert_allclose(natural.to_numpy(), np.array([0.0, 1.0, math.log(10.0), math.log(100.0)]))
    np.testing.assert_allclose(base10.to_numpy(), np.array([0.0, math.log10(math.e), 1.0, 2.0]))


def test_sqrt_transform_returns_nan_for_negative_values() -> None:
    df = pd.DataFrame({"value": [0.0, 4.0, 9.0, -1.0]})

    result = apply_transform(
        df,
        TransformRequest(
            transform_type="sqrt",
            output_column="value_sqrt",
            source_column="value",
        ),
    )

    np.testing.assert_allclose(result.iloc[:3].to_numpy(), np.array([0.0, 2.0, 3.0]))
    assert math.isnan(result.iloc[3])


def test_zscore_transform_centers_and_scales_values() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 4.0]})

    result = apply_transform(
        df,
        TransformRequest(
            transform_type="zscore",
            output_column="value_zscore",
            source_column="value",
        ),
    )

    assert pytest.approx(float(result.mean()), abs=1e-9) == 0.0
    assert pytest.approx(float(result.std(ddof=0)), abs=1e-9) == 1.0


def test_bin_transform_groups_numeric_ranges() -> None:
    df = pd.DataFrame({"value": [5, 15, 25]})

    result = apply_transform(
        df,
        TransformRequest(
            transform_type="bin",
            output_column="value_bin",
            source_column="value",
            params={
                "bins": [0, 10, 20, 30],
                "labels": ["low", "mid", "high"],
                "include_lowest": True,
            },
        ),
    )

    assert result.astype(object).tolist() == ["low", "mid", "high"]


def test_recode_transform_maps_values_and_defaults() -> None:
    df = pd.DataFrame({"segment": ["A", "B", "C"]})

    result = apply_transform(
        df,
        TransformRequest(
            transform_type="recode",
            output_column="segment_group",
            source_column="segment",
            params={"mapping": {"A": "Group 1", "B": "Group 1"}, "default": "Other"},
        ),
    )

    assert result.tolist() == ["Group 1", "Group 1", "Other"]


def test_date_part_transform_extracts_year_and_month() -> None:
    df = pd.DataFrame({"observed_at": pd.to_datetime(["2024-01-15", "2025-07-04"])})

    year_result = apply_transform(
        df,
        TransformRequest(
            transform_type="date_part",
            output_column="year",
            source_column="observed_at",
            params={"part": "year"},
        ),
    )
    month_result = apply_transform(
        df,
        TransformRequest(
            transform_type="date_part",
            output_column="month",
            source_column="observed_at",
            params={"part": "month"},
        ),
    )

    assert year_result.tolist() == [2024, 2025]
    assert month_result.tolist() == [1, 7]


def test_arithmetic_transform_supports_simple_literal_and_complex_expressions() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0, 3.0], "offset": [10.0, 20.0, 30.0], "scale": [2.0, 2.0, 4.0]})

    simple = apply_transform(
        df,
        TransformRequest(
            transform_type="arithmetic",
            output_column="simple_sum",
            source_column="value",
            params={"expression": "value + offset"},
        ),
    )
    with_literals = apply_transform(
        df,
        TransformRequest(
            transform_type="arithmetic",
            output_column="with_literals",
            source_column="value",
            params={"expression": "value * 2 + 5"},
        ),
    )
    complex_result = apply_transform(
        df,
        TransformRequest(
            transform_type="arithmetic",
            output_column="complex_result",
            source_column="value",
            params={"expression": "(value + offset) / scale"},
        ),
    )

    assert simple.tolist() == [11.0, 22.0, 33.0]
    assert with_literals.tolist() == [7.0, 9.0, 11.0]
    assert complex_result.tolist() == [5.5, 11.0, 8.25]


def test_arithmetic_transform_rejects_invalid_identifiers_and_injection() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0]})

    with pytest.raises(ValueError, match="Unknown column"):
        apply_transform(
            df,
            TransformRequest(
                transform_type="arithmetic",
                output_column="bad_column",
                source_column="value",
                params={"expression": "value + unknown_column"},
            ),
        )

    with pytest.raises(ValueError, match="Invalid character"):
        apply_transform(
            df,
            TransformRequest(
                transform_type="arithmetic",
                output_column="danger",
                source_column="value",
                params={"expression": "__import__('os')"},
            ),
        )


def test_duplicate_output_column_is_rejected() -> None:
    df = pd.DataFrame({"value": [1.0, 2.0]})

    with pytest.raises(ValueError, match="already exists"):
        apply_transform(
            df,
            TransformRequest(
                transform_type="sqrt",
                output_column="value",
                source_column="value",
            ),
        )


def test_transform_types_listing_returns_all_supported_transforms() -> None:
    transform_names = [item["type"] for item in list_transform_types()]

    assert transform_names == ["bin", "recode", "date_part", "log", "sqrt", "zscore", "arithmetic"]


def test_transform_endpoints_apply_remove_and_list_types(client) -> None:
    csv_bytes = b"value,offset,segment,observed_at\n1,10,A,2024-01-15\n2,20,B,2024-02-20\n3,30,C,2024-03-25\n"
    dataset_id = _upload_csv(client, csv_bytes)

    types_response = client.get("/api/transforms/types")
    assert types_response.status_code == 200
    assert len(types_response.json()["transforms"]) == 7

    apply_response = client.post(
        f"/api/transforms/{dataset_id}/apply",
        json={
            "transform_type": "arithmetic",
            "output_column": "value_plus_offset",
            "source_column": "value",
            "params": {"expression": "value + offset"},
        },
    )
    assert apply_response.status_code == 200
    body = apply_response.json()
    assert body["output_column"] == "value_plus_offset"
    assert body["row_count"] == 3
    assert body["null_count"] == 0
    assert body["dtype"] == "numeric"
    assert body["preview"] == [11.0, 22.0, 33.0]

    rows_response = client.get(f"/api/data/{dataset_id}/rows")
    assert rows_response.status_code == 200
    rows_body = rows_response.json()
    assert "value_plus_offset" in rows_body["columns"]
    transform_column_index = rows_body["columns"].index("value_plus_offset")
    assert [row[transform_column_index] for row in rows_body["data"]] == [11.0, 22.0, 33.0]

    delete_response = client.delete(f"/api/transforms/{dataset_id}/column/value_plus_offset")
    assert delete_response.status_code == 200
    assert delete_response.json()["ok"] is True

    rows_response = client.get(f"/api/data/{dataset_id}/rows")
    assert rows_response.status_code == 200
    assert "value_plus_offset" not in rows_response.json()["columns"]


def test_transform_endpoint_rejects_duplicate_column_name(client) -> None:
    dataset_id = _upload_csv(client, b"value\n1\n2\n")

    response = client.post(
        f"/api/transforms/{dataset_id}/apply",
        json={
            "transform_type": "sqrt",
            "output_column": "value",
            "source_column": "value",
            "params": {},
        },
    )

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

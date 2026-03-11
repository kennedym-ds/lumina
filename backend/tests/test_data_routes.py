"""Tests for data ingestion and management endpoints."""

import io
import json
import sqlite3

import pandas as pd
import pyarrow.feather as feather
import pytest


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def _sqlite_bytes() -> bytes:
    dataframe = pd.DataFrame(
        {
            "id": [1, 2, 3],
            "label": ["alpha", "beta", "gamma"],
        }
    )

    with sqlite3.connect(":memory:") as connection:
        dataframe.to_sql("records", connection, index=False)
        return connection.serialize()


def _feather_bytes() -> bytes:
    dataframe = pd.DataFrame(
        {
            "id": [1, 2, 3],
            "score": [1.5, 2.5, 3.5],
        }
    )
    buffer = io.BytesIO()
    feather.write_feather(dataframe, buffer)
    return buffer.getvalue()


class TestUpload:
    """Tests for POST /api/data/upload."""

    def test_upload_csv(self, client, sample_csv_bytes):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["file_name"] == "test.csv"
        assert data["file_format"] == "csv"
        assert data["row_count"] == 100
        assert data["column_count"] == 5
        assert len(data["columns"]) == 5
        # Verify column types
        col_map = {c["name"]: c for c in data["columns"]}
        assert col_map["id"]["dtype"] == "numeric"
        assert col_map["value"]["dtype"] == "numeric"

    def test_upload_excel(self, client, sample_excel_bytes):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.xlsx", io.BytesIO(sample_excel_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "excel"
        assert data["sheets"] is not None
        assert "Sheet1" in data["sheets"]
        assert "Sheet2" in data["sheets"]

    def test_upload_excel_specific_sheet(self, client, sample_excel_bytes):
        response = client.post(
            "/api/data/upload?sheet=Sheet2",
            files={"file": ("test.xlsx", io.BytesIO(sample_excel_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["column_count"] == 2
        col_names = [c["name"] for c in data["columns"]]
        assert "c" in col_names
        assert "d" in col_names

    def test_upload_parquet(self, client, sample_parquet_bytes):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.parquet", io.BytesIO(sample_parquet_bytes), "application/octet-stream")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "parquet"
        assert data["row_count"] == 5
        col_map = {c["name"]: c for c in data["columns"]}
        assert col_map["int_col"]["dtype"] == "numeric"
        assert col_map["float_col"]["dtype"] == "numeric"

    def test_upload_json_records(self, client):
        payload = json.dumps(
            [
                {"id": 1, "name": "alpha", "value": 10.5},
                {"id": 2, "name": "beta", "value": 11.0},
            ]
        ).encode("utf-8")

        response = client.post(
            "/api/data/upload",
            files={"file": ("records.json", io.BytesIO(payload), "application/json")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "json"
        assert data["row_count"] == 2
        assert {column["name"] for column in data["columns"]} == {"id", "name", "value"}

    def test_upload_json_column_oriented(self, client):
        payload = json.dumps(
            {
                "id": [1, 2, 3],
                "category": ["A", "B", "A"],
            }
        ).encode("utf-8")

        response = client.post(
            "/api/data/upload",
            files={"file": ("columns.json", io.BytesIO(payload), "application/json")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "json"
        assert data["row_count"] == 3
        assert data["column_count"] == 2

    def test_upload_tsv(self, client):
        payload = b"id\tcategory\tvalue\n1\tA\t10\n2\tB\t20\n"

        response = client.post(
            "/api/data/upload",
            files={"file": ("test.tsv", io.BytesIO(payload), "text/tab-separated-values")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "tsv"
        assert data["row_count"] == 2
        assert {column["name"] for column in data["columns"]} == {"id", "category", "value"}

    def test_upload_sqlite(self, client):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.sqlite", io.BytesIO(_sqlite_bytes()), "application/octet-stream")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "sqlite"
        assert data["row_count"] == 3
        assert {column["name"] for column in data["columns"]} == {"id", "label"}

    def test_upload_feather(self, client):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.feather", io.BytesIO(_feather_bytes()), "application/octet-stream")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_format"] == "feather"
        assert data["row_count"] == 3
        assert {column["name"] for column in data["columns"]} == {"id", "score"}

    def test_upload_unsupported_type(self, client):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.xml", io.BytesIO(b"<root />"), "application/xml")},
        )
        assert response.status_code == 400


class TestPreview:
    """Tests for GET /api/data/{id}/preview."""

    def test_preview(self, client, sample_csv_bytes):
        # Upload first
        upload = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        dataset_id = upload.json()["dataset_id"]

        response = client.get(f"/api/data/{dataset_id}/preview?rows=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 10
        assert data["total_rows"] == 100
        assert len(data["columns"]) == 5

    def test_preview_not_found(self, client):
        response = client.get("/api/data/nonexistent/preview")
        assert response.status_code == 404


class TestRows:
    """Tests for GET /api/data/{id}/rows."""

    def test_paginated_rows(self, client, sample_csv_bytes):
        upload = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        dataset_id = upload.json()["dataset_id"]

        # First page
        response = client.get(f"/api/data/{dataset_id}/rows?offset=0&limit=25")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 25
        assert data["total"] == 100
        assert data["offset"] == 0

        # Second page
        response = client.get(f"/api/data/{dataset_id}/rows?offset=25&limit=25")
        data = response.json()
        assert len(data["data"]) == 25
        assert data["offset"] == 25

    def test_sorted_rows(self, client, sample_csv_bytes):
        upload = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        dataset_id = upload.json()["dataset_id"]

        response = client.get(f"/api/data/{dataset_id}/rows?sort_by=value&sort_desc=true&limit=5")
        data = response.json()
        values = [row[2] for row in data["data"]]  # value is 3rd column
        assert values == sorted(values, reverse=True)


class TestSummary:
    """Tests for GET /api/data/{id}/summary."""

    def test_summary(self, client, sample_csv_bytes):
        upload = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        dataset_id = upload.json()["dataset_id"]

        response = client.get(f"/api/data/{dataset_id}/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 100
        assert data["column_count"] == 5

        col_map = {c["name"]: c for c in data["columns"]}
        assert col_map["value"]["mean"] is not None
        assert col_map["value"]["std"] is not None
        assert col_map["value"]["missing_count"] == 0


class TestColumnConfig:
    """Tests for POST /api/data/{id}/column-config."""

    def test_update_column_type(self, client, sample_csv_bytes):
        upload = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        dataset_id = upload.json()["dataset_id"]

        response = client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "category", "dtype": "categorical"}]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

    def test_column_exclusion_hides_from_rows(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        response = client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}]},
        )
        assert response.status_code == 200
        returned_columns = [column["name"] for column in response.json()["columns"]]
        assert "name" not in returned_columns

        rows = client.get(f"/api/data/{dataset_id}/rows")
        assert rows.status_code == 200
        assert "name" not in rows.json()["columns"]

    def test_column_exclusion_hides_from_preview(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}]},
        )

        preview = client.get(f"/api/data/{dataset_id}/preview")
        assert preview.status_code == 200
        assert "name" not in preview.json()["columns"]

    def test_column_exclusion_hides_from_summary(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}]},
        )

        summary = client.get(f"/api/data/{dataset_id}/summary")
        assert summary.status_code == 200
        body = summary.json()
        column_names = [column["name"] for column in body["columns"]]
        assert "name" not in column_names
        assert body["column_count"] == 4

    def test_column_reinclude(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}]},
        )
        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": False}]},
        )

        rows = client.get(f"/api/data/{dataset_id}/rows")
        assert rows.status_code == 200
        assert "name" in rows.json()["columns"]

    def test_multiple_column_exclusions_persist_across_updates(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}]},
        )
        client.post(
            f"/api/data/{dataset_id}/column-config",
            json={"columns": [{"name": "name", "excluded": True}, {"name": "value", "excluded": True}]},
        )

        rows = client.get(f"/api/data/{dataset_id}/rows")
        assert rows.status_code == 200
        assert rows.json()["columns"] == ["id", "category", "date"]


class TestColumnCasting:
    """Tests for POST /api/data/{id}/cast-column."""

    def test_cast_column_to_numeric(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        response = client.post(
            f"/api/data/{dataset_id}/cast-column",
            json={"column": "category", "target_dtype": "numeric"},
        )

        assert response.status_code == 200
        col_map = {column["name"]: column for column in response.json()["columns"]}
        assert col_map["category"]["dtype"] == "numeric"

    def test_cast_column_to_categorical(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        response = client.post(
            f"/api/data/{dataset_id}/cast-column",
            json={"column": "name", "target_dtype": "categorical"},
        )

        assert response.status_code == 200
        col_map = {column["name"]: column for column in response.json()["columns"]}
        assert col_map["name"]["dtype"] == "categorical"

    def test_cast_column_to_datetime(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        response = client.post(
            f"/api/data/{dataset_id}/cast-column",
            json={"column": "name", "target_dtype": "datetime"},
        )

        assert response.status_code == 200
        col_map = {column["name"]: column for column in response.json()["columns"]}
        assert col_map["name"]["dtype"] == "datetime"


class TestSampling:
    """Tests for POST /api/data/{id}/sample."""

    def test_sample_endpoint_returns_n_rows(self, client, sample_csv_bytes):
        dataset_id = _upload_csv(client, sample_csv_bytes)

        response = client.post(f"/api/data/{dataset_id}/sample?n=7&method=head")

        assert response.status_code == 200
        payload = response.json()
        assert payload["row_count"] == 7
        assert payload["total_rows"] == 100
        assert len(payload["data"]) == 7

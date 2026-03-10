"""Tests for data ingestion and management endpoints."""

import io
import pytest


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

    def test_upload_unsupported_type(self, client):
        response = client.post(
            "/api/data/upload",
            files={"file": ("test.json", io.BytesIO(b"{}"), "application/json")},
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

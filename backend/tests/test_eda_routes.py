"""Tests for EDA chart endpoints."""

import io


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_histogram_basic(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "histogram", "x": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chart_type"] == "histogram"
    assert data["plotly_figure"]["data"][0]["type"] == "histogram"
    assert len(data["plotly_figure"]["data"][0]["x"]) > 0


def test_scatter_basic(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plotly_figure"]["data"][0]["type"] == "scatter"
    assert data["plotly_figure"]["data"][0]["mode"] == "markers"


def test_scatter_webgl(client, large_csv_bytes):
    dataset_id = _upload_csv(client, large_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["webgl"] is True
    assert data["plotly_figure"]["data"][0]["type"] == "scattergl"


def test_box_basic(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "box", "y": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plotly_figure"]["data"][0]["type"] == "box"


def test_bar_basic(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "bar", "x": "category", "y": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plotly_figure"]["data"][0]["type"] == "bar"


def test_line_basic(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "line", "x": "id", "y": "value"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plotly_figure"]["data"][0]["type"] == "scatter"
    assert data["plotly_figure"]["data"][0]["mode"] == "lines"


def test_chart_with_color(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value", "color": "category"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["plotly_figure"]["data"]) > 1


def test_chart_missing_dataset(client, sample_csv_bytes):
    _upload_csv(client, sample_csv_bytes)

    response = client.post(
        "/api/eda/nonexistent/chart",
        json={"chart_type": "histogram", "x": "value"},
    )
    assert response.status_code == 404


def test_chart_invalid_type(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "bubble", "x": "id", "y": "value"},
    )
    assert response.status_code == 400


def test_chart_missing_required_col(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id"},
    )
    assert response.status_code == 400
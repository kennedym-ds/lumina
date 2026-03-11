"""Tests for EDA chart endpoints."""

import io

import pandas as pd
import pytest


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


def test_scatter_traces_include_customdata(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value"},
    )
    assert response.status_code == 200

    traces = response.json()["plotly_figure"]["data"]
    assert len(traces) >= 1
    for trace in traces:
        assert "customdata" in trace
        assert isinstance(trace["customdata"], list)
        assert len(trace["customdata"]) == len(trace["x"])


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


def test_line_traces_include_customdata(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "line", "x": "id", "y": "value"},
    )
    assert response.status_code == 200

    traces = response.json()["plotly_figure"]["data"]
    assert len(traces) >= 1
    for trace in traces:
        assert "customdata" in trace
        assert isinstance(trace["customdata"], list)
        assert len(trace["customdata"]) == len(trace["x"])


def test_chart_with_color(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value", "color": "category"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["plotly_figure"]["data"]) > 1


def _assert_faceted_figure(plotly_figure: dict) -> None:
    assert len(plotly_figure["data"]) >= 4
    assert "xaxis" in plotly_figure["layout"]
    assert "yaxis" in plotly_figure["layout"]
    assert len(plotly_figure["layout"]["annotations"]) >= 4
    assert {annotation["text"] for annotation in plotly_figure["layout"]["annotations"]} == {
        "<b>A</b>",
        "<b>B</b>",
        "<b>C</b>",
        "<b>D</b>",
    }
    assert {trace["xaxis"] for trace in plotly_figure["data"]} == {"x", "x2", "x3", "x4"}
    assert {trace["yaxis"] for trace in plotly_figure["data"]} == {"y", "y2", "y3", "y4"}


def test_scatter_with_facet(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value", "facet": "category"},
    )
    assert response.status_code == 200

    data = response.json()
    _assert_faceted_figure(data["plotly_figure"])
    assert data["plotly_figure"]["data"][0]["type"] == "scatter"
    assert data["plotly_figure"]["data"][0]["mode"] == "markers"
    assert data["warnings"] == []


def test_histogram_with_facet(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "histogram", "x": "value", "facet": "category"},
    )
    assert response.status_code == 200

    data = response.json()
    _assert_faceted_figure(data["plotly_figure"])
    assert data["plotly_figure"]["data"][0]["type"] == "histogram"
    assert data["warnings"] == []


def test_histogram_traces_do_not_include_customdata(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "histogram", "x": "value"},
    )
    assert response.status_code == 200

    traces = response.json()["plotly_figure"]["data"]
    assert len(traces) >= 1
    for trace in traces:
        assert "customdata" not in trace


@pytest.mark.parametrize(
    ("payload", "expected_trace_type", "expected_mode"),
    [
        ({"chart_type": "box", "y": "value", "facet": "category"}, "box", None),
        ({"chart_type": "bar", "x": "category", "y": "value", "facet": "category"}, "bar", None),
        ({"chart_type": "line", "x": "id", "y": "value", "facet": "category"}, "scatter", "lines"),
    ],
)
def test_chart_types_with_facet(client, sample_csv_bytes, payload, expected_trace_type, expected_mode):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(f"/api/eda/{dataset_id}/chart", json=payload)
    assert response.status_code == 200

    data = response.json()
    _assert_faceted_figure(data["plotly_figure"])
    assert data["plotly_figure"]["data"][0]["type"] == expected_trace_type
    if expected_mode is not None:
        assert data["plotly_figure"]["data"][0]["mode"] == expected_mode
    assert data["warnings"] == []


def test_facet_with_color(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "id", "y": "value", "color": "category", "facet": "category"},
    )
    assert response.status_code == 200

    data = response.json()
    _assert_faceted_figure(data["plotly_figure"])
    assert len(data["plotly_figure"]["data"]) > 0
    assert data["warnings"] == []


def test_facet_cap_warning(client):
    """Facet columns with more than 12 unique values should cap and warn."""

    df = pd.DataFrame(
        {
            "x": range(100),
            "y": range(100),
            "group": [f"g{i}" for i in range(100)],
        }
    )
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)

    dataset_id = _upload_csv(client, buffer.getvalue())
    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "x", "y": "y", "facet": "group"},
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["plotly_figure"]["layout"]["annotations"]) == 12
    assert len(data["warnings"]) > 0
    assert "12" in data["warnings"][0]


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


def test_excluded_column_not_in_chart(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    config_response = client.post(
        f"/api/data/{dataset_id}/column-config",
        json={"columns": [{"name": "value", "excluded": True}]},
    )
    assert config_response.status_code == 200

    response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "histogram", "x": "value"},
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
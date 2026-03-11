"""Tests for LTTB downsampling service and endpoint."""

import io
import math

import pandas as pd

from app.models.eda import ChartRequest
from app.services.chart_builder import DOWNSAMPLE_THRESHOLD, build_chart_figure
from app.services.downsampling import lttb_downsample



def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]



def test_lttb_below_threshold():
    x = list(range(100))
    y = [float(index * 2) for index in x]

    downsampled_x, downsampled_y = lttb_downsample(x, y, threshold=200)

    assert downsampled_x == x
    assert downsampled_y == y



def test_lttb_above_threshold():
    x = list(range(10_000))
    y = [math.sin(index / 100.0) for index in x]

    downsampled_x, downsampled_y = lttb_downsample(x, y, threshold=500)

    assert len(downsampled_x) == len(downsampled_y)
    assert len(downsampled_x) <= 500
    assert len(downsampled_x) > 100



def test_lttb_preserves_endpoints():
    x = list(range(10_000))
    y = [index * 0.5 for index in x]

    downsampled_x, downsampled_y = lttb_downsample(x, y, threshold=500)

    assert downsampled_x[0] == x[0]
    assert downsampled_y[0] == y[0]
    assert downsampled_x[-1] == x[-1]
    assert downsampled_y[-1] == y[-1]



def test_downsample_endpoint(client, large_csv_bytes):
    dataset_id = _upload_csv(client, large_csv_bytes)

    response = client.post(
        f"/api/eda/{dataset_id}/downsample",
        json={"x_column": "id", "y_column": "value", "threshold": 500},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["original_count"] == 12050
    assert payload["downsampled_count"] <= 500
    assert len(payload["x"]) == payload["downsampled_count"]
    assert len(payload["y"]) == payload["downsampled_count"]


def test_scatter_auto_downsample():
    """Scatter charts with many points are automatically downsampled."""

    n = 15_000
    df = pd.DataFrame({"x": range(n), "y": [float(i * 0.1) for i in range(n)]})
    req = ChartRequest(chart_type="scatter", x="x", y="y")

    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(df, req)

    assert downsampled is True
    assert displayed is not None
    assert displayed <= DOWNSAMPLE_THRESHOLD + 100
    assert row_count == n
    assert any("Downsampled" in warning for warning in warnings)

    total_trace_points = sum(len(trace.get("x", [])) for trace in figure["data"])
    assert total_trace_points < n


def test_downsampled_scatter_traces_drop_customdata():
    """Downsampled scatter traces remove customdata because sampled row IDs are not preserved."""

    n = 15_000
    df = pd.DataFrame({"x": range(n), "y": [float(i * 0.1) for i in range(n)]})
    req = ChartRequest(chart_type="scatter", x="x", y="y")

    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(df, req)

    assert row_count == n
    assert downsampled is True
    assert displayed is not None
    for trace in figure["data"]:
        assert "customdata" not in trace


def test_scatter_no_downsample_small():
    """Small scatter charts are NOT downsampled."""

    df = pd.DataFrame({"x": range(100), "y": range(100)})
    req = ChartRequest(chart_type="scatter", x="x", y="y")

    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(df, req)

    assert downsampled is False
    assert displayed is None


def test_histogram_never_downsampled():
    """Histograms are never downsampled even with many rows."""

    n = 15_000
    df = pd.DataFrame({"x": range(n)})
    req = ChartRequest(chart_type="histogram", x="x")

    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(df, req)

    assert downsampled is False


def test_line_auto_downsample():
    """Line charts with many points are automatically downsampled."""

    n = 15_000
    df = pd.DataFrame({"x": range(n), "y": [float(i) for i in range(n)]})
    req = ChartRequest(chart_type="line", x="x", y="y")

    figure, row_count, webgl, warnings, downsampled, displayed = build_chart_figure(df, req)

    assert downsampled is True
    assert displayed is not None
    assert displayed <= DOWNSAMPLE_THRESHOLD + 100


def test_downsample_endpoint_with_chart(client):
    """Integration: scatter chart via API with large dataset returns downsampled flag."""

    n = 15_000
    csv_data = "x,y\n" + "\n".join(f"{i},{math.sin(i / 100.0)}" for i in range(n))
    response = client.post(
        "/api/data/upload",
        files={"file": ("big.csv", io.BytesIO(csv_data.encode()), "text/csv")},
    )
    assert response.status_code == 200

    dataset_id = response.json()["dataset_id"]
    chart_response = client.post(
        f"/api/eda/{dataset_id}/chart",
        json={"chart_type": "scatter", "x": "x", "y": "y"},
    )
    assert chart_response.status_code == 200

    body = chart_response.json()
    assert body["downsampled"] is True
    assert body["displayed_row_count"] is not None
    assert body["row_count"] == n

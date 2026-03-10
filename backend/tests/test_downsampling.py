"""Tests for LTTB downsampling service and endpoint."""

import io
import math

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

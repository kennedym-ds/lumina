"""Tests for SPC control-chart and process-capability endpoints."""

from __future__ import annotations

import io

import numpy as np
import pandas as pd


def _upload_numeric(client, values, column: str = "x") -> str:
    df = pd.DataFrame({column: values})
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    response = client.post(
        "/api/data/upload",
        files={"file": ("spc.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def test_control_chart_imr_basic(client):
    rng = np.random.default_rng(0)
    values = rng.normal(100, 5, size=40)
    dataset_id = _upload_numeric(client, values)

    response = client.post(f"/api/spc/{dataset_id}/control-chart", json={"column": "x", "subgroup_size": 1})

    assert response.status_code == 200
    body = response.json()
    assert body["chart_kind"] == "imr"
    assert body["primary"]["name"] == "Individuals"
    assert body["secondary"]["name"] == "Moving Range"
    assert len(body["primary"]["points"]) == 40
    p = body["primary"]
    assert p["lcl"] < p["center_line"] < p["ucl"]


def test_control_chart_flags_out_of_control_point(client):
    values = [10.0] * 30
    values[15] = 1000.0  # gross outlier — must trip Rule 1
    dataset_id = _upload_numeric(client, values)

    response = client.post(f"/api/spc/{dataset_id}/control-chart", json={"column": "x"})

    assert response.status_code == 200
    violations = response.json()["violations"]
    assert any(v["index"] == 15 and 1 in v["rules"] for v in violations)


def test_control_chart_xbar_r(client):
    rng = np.random.default_rng(1)
    values = rng.normal(50, 2, size=50)
    dataset_id = _upload_numeric(client, values)

    response = client.post(f"/api/spc/{dataset_id}/control-chart", json={"column": "x", "subgroup_size": 5})

    assert response.status_code == 200
    body = response.json()
    assert body["chart_kind"] == "xbar_r"
    assert body["subgroup_size"] == 5
    assert body["secondary"]["name"] == "Subgroup Range"
    assert len(body["primary"]["points"]) == 10


def test_capability_indices(client):
    rng = np.random.default_rng(2)
    values = rng.normal(100, 2, size=200)
    dataset_id = _upload_numeric(client, values)

    response = client.post(
        f"/api/spc/{dataset_id}/capability",
        json={"column": "x", "lsl": 90, "usl": 110, "target": 100},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cp"] is not None and body["cp"] > 0
    assert body["cpk"] is not None
    assert body["pp"] is not None and body["ppk"] is not None
    assert body["ppm_total"] >= 0
    assert len(body["histogram"]["counts"]) >= 1


def test_capability_one_sided_spec(client):
    rng = np.random.default_rng(3)
    values = rng.normal(100, 2, size=100)
    dataset_id = _upload_numeric(client, values)

    response = client.post(f"/api/spc/{dataset_id}/capability", json={"column": "x", "usl": 110})

    assert response.status_code == 200
    body = response.json()
    assert body["cp"] is None  # one-sided -> no potential index
    assert body["cpk"] is not None


def test_capability_requires_spec_limit(client):
    dataset_id = _upload_numeric(client, [1.0, 2.0, 3.0, 4.0, 5.0])

    response = client.post(f"/api/spc/{dataset_id}/capability", json={"column": "x"})

    assert response.status_code == 400


def test_capability_within_sigma_uses_subgroups(client):
    """For subgrouped data, within-sigma is the subgroup-range estimate, not the
    individuals moving-range one — so it reflects within-group spread only and is far
    smaller than the overall sigma when between-group variation dominates."""
    # 6 tight subgroups of size 5 with large drift between groups.
    values = [100.0 + 20.0 * i + d for i in range(6) for d in (-2.0, -1.0, 0.0, 1.0, 2.0)]
    dataset_id = _upload_numeric(client, values)

    response = client.post(
        f"/api/spc/{dataset_id}/capability",
        json={"column": "x", "lsl": 80, "usl": 220, "subgroup_size": 5},
    )

    assert response.status_code == 200
    body = response.json()
    # Subgroup range = 4 over d2(5)=2.326 -> ~1.72, regardless of the between-group drift.
    assert 1.0 < body["std_within"] < 3.0
    # Overall spans ~100 units, so within (short-term) sigma must be much smaller.
    assert body["std_within"] < body["std_overall"]


def test_capability_within_sigma_uses_c4_for_large_subgroups(client):
    """For subgroup_size >= 9 the X-bar/S method must unbias the mean subgroup std
    with c4, not d2. Using d2 (~3.1 at n=10) instead of c4 (~0.97) would shrink the
    estimate by ~3x and grossly inflate Cp/Cpk."""
    # 4 tight subgroups of size 10; within-group sample std is exactly ~1.491.
    offsets = [-2.0, -2.0, -1.0, -1.0, 0.0, 0.0, 1.0, 1.0, 2.0, 2.0]
    values = [100.0 + 30.0 * i + d for i in range(4) for d in offsets]
    dataset_id = _upload_numeric(client, values)

    response = client.post(
        f"/api/spc/{dataset_id}/capability",
        json={"column": "x", "lsl": 50, "usl": 250, "subgroup_size": 10},
    )

    assert response.status_code == 200
    body = response.json()
    # s_bar / c4(10) ~= 1.491 / 0.973 ~= 1.53; the d2 bug would give ~0.48.
    assert 1.3 < body["std_within"] < 1.8


def test_subgroup_size_capped_at_10(client):
    """subgroup_size above 10 is rejected — chart constants are only defined to 10."""
    dataset_id = _upload_numeric(client, list(range(50)))

    response = client.post(
        f"/api/spc/{dataset_id}/control-chart", json={"column": "x", "subgroup_size": 11}
    )

    assert response.status_code == 422

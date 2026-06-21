"""Tests for Design of Experiments (DOE) endpoint."""

from __future__ import annotations


def test_full_factorial_2level_run_count(client):
    """2-level full factorial with k factors produces 2^k runs."""
    factors = [
        {"name": "A", "low": 0.0, "high": 1.0},
        {"name": "B", "low": -1.0, "high": 1.0},
        {"name": "C", "low": 10.0, "high": 20.0},
    ]
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "full_factorial"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_runs"] == 8  # 2^3
    assert len(body["runs"]) == 8
    assert body["factor_names"] == ["A", "B", "C"]
    assert body["design_type"] == "full_factorial"


def test_full_factorial_3level_run_count(client):
    """3-level full factorial with k=2 factors produces 3^2=9 runs."""
    factors = [
        {"name": "X", "low": 0.0, "high": 10.0},
        {"name": "Y", "low": 5.0, "high": 15.0},
    ]
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "full_factorial", "levels": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_runs"] == 9  # 3^2
    # check mid-point at level index 1
    middle_x = 5.0
    mid_vals = [run["X"] for run in body["runs"] if abs(run["X"] - middle_x) < 1e-9]
    assert len(mid_vals) == 3  # appears in 3 runs (one per Y level)


def test_fractional_factorial_halves_runs(client):
    """2^(4-1) fractional factorial has 8 runs instead of 16."""
    factors = [
        {"name": "A", "low": 0.0, "high": 1.0},
        {"name": "B", "low": 0.0, "high": 1.0},
        {"name": "C", "low": 0.0, "high": 1.0},
        {"name": "D", "low": 0.0, "high": 1.0},
    ]
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "fractional_factorial", "fraction": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_runs"] == 8  # 2^(4-1) = 8
    assert len(body["runs"]) == 8
    # generators and resolution must be reported
    assert isinstance(body["generators"], list)
    assert len(body["generators"]) >= 1
    assert isinstance(body["resolution"], int)
    assert body["resolution"] >= 1


def test_plackett_burman_run_count_multiple_of_4(client):
    """Plackett-Burman run count is the next multiple of 4 >= n_factors + 1."""
    factors = [
        {"name": f"F{i}", "low": float(i), "high": float(i + 10)}
        for i in range(7)
    ]
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "plackett_burman"},
    )
    assert response.status_code == 200
    body = response.json()
    n = body["n_runs"]
    # must be a multiple of 4
    assert n % 4 == 0
    # must accommodate 7 factors (need at least 8 runs = 7+1 columns)
    assert n >= 8


def test_center_points_added(client):
    """Adding n_center center points appends those rows at factor midpoints."""
    factors = [
        {"name": "A", "low": 0.0, "high": 10.0},
        {"name": "B", "low": -2.0, "high": 2.0},
    ]
    n_center = 3
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "full_factorial", "n_center": n_center},
    )
    assert response.status_code == 200
    body = response.json()
    # 2^2 = 4 factorial + 3 center = 7
    assert body["n_runs"] == 7
    # last 3 runs should be at midpoints
    mid_a, mid_b = 5.0, 0.0
    for run in body["runs"][-n_center:]:
        assert abs(run["A"] - mid_a) < 1e-9
        assert abs(run["B"] - mid_b) < 1e-9


def test_too_few_factors_returns_400(client):
    """Fewer than 2 factors is invalid and returns HTTP 400."""
    response = client.post(
        "/api/doe/design",
        json={"factors": [{"name": "A", "low": 0.0, "high": 1.0}], "design_type": "full_factorial"},
    )
    assert response.status_code == 400


def test_low_gte_high_returns_400(client):
    """Factor with low >= high is invalid and returns HTTP 400."""
    factors = [
        {"name": "A", "low": 5.0, "high": 5.0},
        {"name": "B", "low": 0.0, "high": 1.0},
    ]
    response = client.post(
        "/api/doe/design",
        json={"factors": factors, "design_type": "full_factorial"},
    )
    assert response.status_code == 400

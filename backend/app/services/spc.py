"""Statistical process control (SPC): control charts and process capability.

Implements the most-used SPC tools — Individuals/Moving-Range (I-MR) and
Xbar-R/Xbar-S control charts with Nelson run-rule detection, plus normal
process-capability indices (Cp/Cpk/Pp/Ppk) — on top of a numeric column.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

# Control-chart constants by subgroup size n (Montgomery, Statistical Quality
# Control). d2 also drives the within-subgroup sigma estimate used for capability.
_CONSTANTS: dict[int, dict[str, float]] = {
    2: {"d2": 1.128, "A2": 1.880, "D3": 0.0, "D4": 3.267, "A3": 2.659, "B3": 0.0, "B4": 3.267},
    3: {"d2": 1.693, "A2": 1.023, "D3": 0.0, "D4": 2.574, "A3": 1.954, "B3": 0.0, "B4": 2.568},
    4: {"d2": 2.059, "A2": 0.729, "D3": 0.0, "D4": 2.282, "A3": 1.628, "B3": 0.0, "B4": 2.266},
    5: {"d2": 2.326, "A2": 0.577, "D3": 0.0, "D4": 2.114, "A3": 1.427, "B3": 0.0, "B4": 2.089},
    6: {"d2": 2.534, "A2": 0.483, "D3": 0.0, "D4": 2.004, "A3": 1.287, "B3": 0.030, "B4": 1.970},
    7: {"d2": 2.704, "A2": 0.419, "D3": 0.076, "D4": 1.924, "A3": 1.182, "B3": 0.118, "B4": 1.882},
    8: {"d2": 2.847, "A2": 0.373, "D3": 0.136, "D4": 1.864, "A3": 1.099, "B3": 0.185, "B4": 1.815},
    9: {"d2": 2.970, "A2": 0.337, "D3": 0.184, "D4": 1.816, "A3": 1.032, "B3": 0.239, "B4": 1.761},
    10: {"d2": 3.078, "A2": 0.308, "D3": 0.223, "D4": 1.777, "A3": 0.975, "B3": 0.284, "B4": 1.716},
}


def _constants(n: int) -> dict[str, float]:
    if n < 2:
        n = 2
    return _CONSTANTS[min(n, 10)]


def _clean_numeric(df: pd.DataFrame, column: str) -> np.ndarray:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    series = pd.to_numeric(df[column], errors="coerce").dropna()
    values = series.to_numpy(dtype=float)
    if values.size < 2:
        raise ValueError("Need at least 2 numeric observations for an SPC analysis")
    return values


def _nelson_rules(points: np.ndarray, center: float, sigma: float) -> list[dict[str, Any]]:
    """Detect a practical subset of Nelson/Western-Electric run rules.

    Rule 1: a point beyond 3 sigma.
    Rule 2: nine points in a row on the same side of the center line.
    Rule 3: six points in a row steadily increasing or decreasing.
    """

    violations: dict[int, set[int]] = {}

    def flag(index: int, rule: int) -> None:
        violations.setdefault(index, set()).add(rule)

    if sigma > 0:
        upper = center + 3 * sigma
        lower = center - 3 * sigma
        for i, value in enumerate(points):
            if value > upper or value < lower:
                flag(i, 1)

    # Rule 2 — 9 consecutive on one side of the center line.
    run_side = 0
    run_len = 0
    for i, value in enumerate(points):
        side = 1 if value > center else (-1 if value < center else 0)
        if side != 0 and side == run_side:
            run_len += 1
        else:
            run_side, run_len = side, 1 if side != 0 else 0
        if run_len >= 9:
            for j in range(i - 8, i + 1):
                flag(j, 2)

    # Rule 3 — 6 consecutive strictly increasing or decreasing.
    inc = dec = 1
    for i in range(1, len(points)):
        inc = inc + 1 if points[i] > points[i - 1] else 1
        dec = dec + 1 if points[i] < points[i - 1] else 1
        if inc >= 6:
            for j in range(i - 5, i + 1):
                flag(j, 3)
        if dec >= 6:
            for j in range(i - 5, i + 1):
                flag(j, 3)

    return [
        {"index": index, "point": float(points[index]), "rules": sorted(rules)}
        for index, rules in sorted(violations.items())
    ]


def _series(name: str, points: np.ndarray, center: float, ucl: float, lcl: float) -> dict[str, Any]:
    return {
        "name": name,
        "points": [float(value) for value in points],
        "center_line": float(center),
        "ucl": float(ucl),
        "lcl": float(lcl),
    }


def compute_control_chart(df: pd.DataFrame, column: str, subgroup_size: int = 1) -> dict[str, Any]:
    """Compute an I-MR (subgroup_size<=1) or Xbar-R/S (subgroup_size>=2) chart."""

    values = _clean_numeric(df, column)
    subgroup_size = max(1, int(subgroup_size))

    if subgroup_size <= 1:
        moving_range = np.abs(np.diff(values))
        mr_bar = float(moving_range.mean()) if moving_range.size else 0.0
        sigma = mr_bar / _constants(2)["d2"] if mr_bar > 0 else 0.0
        mean = float(values.mean())

        primary = _series("Individuals", values, mean, mean + 3 * sigma, mean - 3 * sigma)
        mr_ucl = _constants(2)["D4"] * mr_bar
        secondary = _series("Moving Range", moving_range, mr_bar, mr_ucl, 0.0)
        violations = _nelson_rules(values, mean, sigma)
        return {
            "chart_kind": "imr",
            "column": column,
            "subgroup_size": 1,
            "primary": primary,
            "secondary": secondary,
            "violations": violations,
            "sigma": float(sigma),
        }

    n_groups = values.size // subgroup_size
    if n_groups < 2:
        raise ValueError("Not enough data for the requested subgroup size")

    groups = values[: n_groups * subgroup_size].reshape(n_groups, subgroup_size)
    means = groups.mean(axis=1)
    constants = _constants(subgroup_size)
    xbar_bar = float(means.mean())

    use_std = subgroup_size >= 9
    if use_std:
        spreads = groups.std(axis=1, ddof=1)
        spread_bar = float(spreads.mean())
        sigma = spread_bar / (constants["d2"]) if spread_bar > 0 else 0.0
        xbar_ucl = xbar_bar + constants["A3"] * spread_bar
        xbar_lcl = xbar_bar - constants["A3"] * spread_bar
        spread_ucl = constants["B4"] * spread_bar
        spread_lcl = constants["B3"] * spread_bar
        spread_name = "Subgroup Std Dev"
    else:
        spreads = groups.max(axis=1) - groups.min(axis=1)
        spread_bar = float(spreads.mean())
        sigma = spread_bar / constants["d2"] if spread_bar > 0 else 0.0
        xbar_ucl = xbar_bar + constants["A2"] * spread_bar
        xbar_lcl = xbar_bar - constants["A2"] * spread_bar
        spread_ucl = constants["D4"] * spread_bar
        spread_lcl = constants["D3"] * spread_bar
        spread_name = "Subgroup Range"

    primary = _series("Subgroup Mean", means, xbar_bar, xbar_ucl, xbar_lcl)
    secondary = _series(spread_name, spreads, spread_bar, spread_ucl, spread_lcl)
    # Run-rule detection on the subgroup means uses the standard error of the mean.
    mean_sigma = sigma / np.sqrt(subgroup_size) if sigma > 0 else 0.0
    violations = _nelson_rules(means, xbar_bar, mean_sigma)
    return {
        "chart_kind": "xbar_s" if use_std else "xbar_r",
        "column": column,
        "subgroup_size": subgroup_size,
        "primary": primary,
        "secondary": secondary,
        "violations": violations,
        "sigma": float(sigma),
    }


def _capability_pair(mean: float, sigma: float, lsl: float | None, usl: float | None) -> tuple[float | None, float | None]:
    """Return (potential index, performance index) for a given sigma estimate."""

    if sigma <= 0:
        return None, None

    if lsl is not None and usl is not None:
        cp = (usl - lsl) / (6 * sigma)
        cpk = min((usl - mean) / (3 * sigma), (mean - lsl) / (3 * sigma))
        return cp, cpk
    if usl is not None:
        return None, (usl - mean) / (3 * sigma)
    if lsl is not None:
        return None, (mean - lsl) / (3 * sigma)
    return None, None


def compute_capability(
    df: pd.DataFrame,
    column: str,
    lsl: float | None = None,
    usl: float | None = None,
    target: float | None = None,
    subgroup_size: int = 1,
) -> dict[str, Any]:
    """Compute normal process-capability indices and an out-of-spec estimate."""

    if lsl is None and usl is None:
        raise ValueError("Provide at least one specification limit (LSL or USL)")
    if lsl is not None and usl is not None and lsl >= usl:
        raise ValueError("LSL must be less than USL")

    values = _clean_numeric(df, column)
    mean = float(values.mean())
    sigma_overall = float(values.std(ddof=1))

    # Within (short-term) sigma from the average moving range, matching the I-MR chart.
    moving_range = np.abs(np.diff(values))
    mr_bar = float(moving_range.mean()) if moving_range.size else 0.0
    sigma_within = mr_bar / _constants(2)["d2"] if mr_bar > 0 else sigma_overall

    cp, cpk = _capability_pair(mean, sigma_within, lsl, usl)
    pp, ppk = _capability_pair(mean, sigma_overall, lsl, usl)

    # Out-of-spec estimate under the fitted normal, plus the empirical count.
    ppm_below = ppm_above = 0.0
    observed_out = 0
    if sigma_overall > 0:
        if lsl is not None:
            ppm_below = float(stats.norm.cdf(lsl, loc=mean, scale=sigma_overall)) * 1_000_000
            observed_out += int((values < lsl).sum())
        if usl is not None:
            ppm_above = float(stats.norm.sf(usl, loc=mean, scale=sigma_overall)) * 1_000_000
            observed_out += int((values > usl).sum())

    counts, bin_edges = np.histogram(values, bins="auto")
    return {
        "column": column,
        "n": int(values.size),
        "mean": mean,
        "std_overall": sigma_overall,
        "std_within": float(sigma_within),
        "lsl": lsl,
        "usl": usl,
        "target": target,
        "cp": cp,
        "cpk": cpk,
        "pp": pp,
        "ppk": ppk,
        "ppm_below": ppm_below,
        "ppm_above": ppm_above,
        "ppm_total": ppm_below + ppm_above,
        "observed_out_of_spec": observed_out,
        "histogram": {
            "counts": [int(value) for value in counts],
            "bin_edges": [float(edge) for edge in bin_edges],
        },
    }

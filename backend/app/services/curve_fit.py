"""Nonlinear curve fitting using scipy.optimize.curve_fit.

Provides a registry of named models (linear, quadratic, exponential, etc.)
and a ``fit_curve`` function that fits a named model to x/y column data from
a DataFrame and returns the fitted parameters, goodness-of-fit metrics, and
smooth fitted-curve points for plotting.
"""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit

_MAX_SCATTER_ROWS = 2000
_RNG_SEED = 42
_N_CURVE_POINTS = 100


# ---------------------------------------------------------------------------
# Model functions
# ---------------------------------------------------------------------------


def _linear(x, a, b):
    return a * x + b


def _quadratic(x, a, b, c):
    return a * x**2 + b * x + c


def _exponential(x, a, b, c):
    return a * np.exp(b * x) + c


def _logarithmic(x, a, b):
    return a * np.log(x) + b


def _power(x, a, b):
    return a * np.power(np.abs(x), b)


def _logistic_4pl(x, a, b, c, d):
    return d + (a - d) / (1.0 + (x / c) ** b)


def _michaelis_menten(x, Vmax, Km):
    return Vmax * x / (Km + x)


def _gaussian(x, a, b, c):
    return a * np.exp(-((x - b) ** 2) / (2.0 * c**2))


# ---------------------------------------------------------------------------
# Initial-guess helpers
# ---------------------------------------------------------------------------


def _p0_linear(x: np.ndarray, y: np.ndarray) -> list[float]:
    """Slope and intercept via simple linear regression."""
    xm, ym = float(np.mean(x)), float(np.mean(y))
    denom = float(np.sum((x - xm) ** 2))
    a = float(np.sum((x - xm) * (y - ym))) / denom if denom != 0 else 1.0
    b = ym - a * xm
    return [a, b]


def _p0_quadratic(x: np.ndarray, y: np.ndarray) -> list[float]:
    coeffs = np.polyfit(x, y, 2)
    return [float(c) for c in coeffs]


def _p0_exponential(x: np.ndarray, y: np.ndarray) -> list[float]:
    a = float(np.max(np.abs(y)))
    if a == 0:
        a = 1.0
    b = 0.1
    c = float(np.min(y))
    return [a, b, c]


def _p0_logarithmic(x: np.ndarray, y: np.ndarray) -> list[float]:
    # a*ln(x_range) ~ y_range
    log_x = np.log(x)
    xm, ym = float(np.mean(log_x)), float(np.mean(y))
    denom = float(np.sum((log_x - xm) ** 2))
    a = float(np.sum((log_x - xm) * (y - ym))) / denom if denom != 0 else 1.0
    b = ym - a * xm
    return [a, b]


def _p0_power(x: np.ndarray, y: np.ndarray) -> list[float]:
    return [float(np.mean(y)), 1.0]


def _p0_logistic_4pl(x: np.ndarray, y: np.ndarray) -> list[float]:
    a = float(np.max(y))
    d = float(np.min(y))
    c = float(np.median(x))
    if c == 0:
        c = 1.0
    b = 1.0
    return [a, b, c, d]


def _p0_michaelis_menten(x: np.ndarray, y: np.ndarray) -> list[float]:
    Vmax = float(np.max(y)) * 1.1
    Km = float(np.median(x))
    if Km == 0:
        Km = 1.0
    return [Vmax, Km]


def _p0_gaussian(x: np.ndarray, y: np.ndarray) -> list[float]:
    a = float(np.max(y))
    b = float(x[np.argmax(y)])
    c = float((np.max(x) - np.min(x)) / 4.0)
    if c == 0:
        c = 1.0
    return [a, b, c]


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

_ModelEntry = dict[str, Any]

_MODELS: dict[str, _ModelEntry] = {
    "linear": {
        "fn": _linear,
        "param_names": ["a", "b"],
        "p0": _p0_linear,
        "requires_positive_x": False,
    },
    "quadratic": {
        "fn": _quadratic,
        "param_names": ["a", "b", "c"],
        "p0": _p0_quadratic,
        "requires_positive_x": False,
    },
    "exponential": {
        "fn": _exponential,
        "param_names": ["a", "b", "c"],
        "p0": _p0_exponential,
        "requires_positive_x": False,
    },
    "logarithmic": {
        "fn": _logarithmic,
        "param_names": ["a", "b"],
        "p0": _p0_logarithmic,
        "requires_positive_x": True,
    },
    "power": {
        "fn": _power,
        "param_names": ["a", "b"],
        "p0": _p0_power,
        "requires_positive_x": True,
    },
    "logistic_4pl": {
        "fn": _logistic_4pl,
        "param_names": ["a", "b", "c", "d"],
        "p0": _p0_logistic_4pl,
        "requires_positive_x": False,
    },
    "michaelis_menten": {
        "fn": _michaelis_menten,
        "param_names": ["Vmax", "Km"],
        "p0": _p0_michaelis_menten,
        "requires_positive_x": False,
    },
    "gaussian": {
        "fn": _gaussian,
        "param_names": ["a", "b", "c"],
        "p0": _p0_gaussian,
        "requires_positive_x": False,
    },
}


def list_models() -> list[dict[str, Any]]:
    """Return all available model names and their parameter names."""
    return [{"name": name, "param_names": entry["param_names"]} for name, entry in _MODELS.items()]


# ---------------------------------------------------------------------------
# Core fitting function
# ---------------------------------------------------------------------------


def fit_curve(
    df: pd.DataFrame,
    x_column: str,
    y_column: str,
    model_name: str,
) -> dict[str, Any]:
    """Fit a named nonlinear model to x/y columns from a DataFrame.

    Parameters
    ----------
    df:
        Source DataFrame.
    x_column:
        Name of the predictor column.
    y_column:
        Name of the response column.
    model_name:
        Key from the model registry (e.g. ``"linear"``, ``"exponential"``).

    Returns
    -------
    dict with keys:
        ``model_name``, ``param_names``, ``params``, ``param_std_errors``,
        ``r_squared``, ``rmse``, ``n``, ``x_data``, ``y_data``,
        ``curve_x``, ``curve_y``.

    Raises
    ------
    ValueError:
        On unknown model, too few data points, x≤0 for log/power models, or
        when scipy fails to converge.
    """
    if model_name not in _MODELS:
        raise ValueError(
            f"Unknown model '{model_name}'. Available: {', '.join(_MODELS.keys())}"
        )

    model = _MODELS[model_name]
    fn: Callable = model["fn"]
    param_names: list[str] = model["param_names"]
    n_params = len(param_names)

    # --- select, coerce, clean ---
    subset = df[[x_column, y_column]].apply(pd.to_numeric, errors="coerce").dropna()
    subset = subset.sort_values(x_column)

    x_arr = subset[x_column].to_numpy(dtype=float)
    y_arr = subset[y_column].to_numpy(dtype=float)
    n = len(x_arr)

    if n <= n_params:
        raise ValueError(
            f"Need at least {n_params + 1} data points to fit '{model_name}' "
            f"(has {n_params} parameters), but got {n}."
        )

    if model["requires_positive_x"] and float(np.min(x_arr)) <= 0.0:
        raise ValueError(
            f"Model '{model_name}' requires all x values to be positive (x > 0). "
            f"Found x ≤ 0 in the data."
        )

    # --- fit ---
    p0 = model["p0"](x_arr, y_arr)
    try:
        popt, pcov = curve_fit(fn, x_arr, y_arr, p0=p0, maxfev=10000)
    except (RuntimeError, Exception) as exc:
        raise ValueError(f"Could not fit '{model_name}': {exc}") from exc

    # --- parameter standard errors ---
    diag = np.diag(pcov)
    param_std_errors: list[float | None] = [
        float(math.sqrt(v)) if np.isfinite(v) and v >= 0 else None for v in diag
    ]

    # --- goodness of fit ---
    y_pred = fn(x_arr, *popt)
    ss_res = float(np.sum((y_arr - y_pred) ** 2))
    ss_tot = float(np.sum((y_arr - np.mean(y_arr)) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot != 0 else 0.0
    rmse = float(math.sqrt(ss_res / n))

    # --- smooth fitted curve ---
    x_min, x_max = float(np.min(x_arr)), float(np.max(x_arr))
    curve_x = np.linspace(x_min, x_max, _N_CURVE_POINTS)
    curve_y = fn(curve_x, *popt)

    # --- downsample scatter if needed ---
    if n > _MAX_SCATTER_ROWS:
        rng = np.random.default_rng(_RNG_SEED)
        idx = rng.choice(n, size=_MAX_SCATTER_ROWS, replace=False)
        x_scatter = x_arr[idx]
        y_scatter = y_arr[idx]
    else:
        x_scatter = x_arr
        y_scatter = y_arr

    return {
        "model_name": model_name,
        "param_names": param_names,
        "params": [float(p) for p in popt],
        "param_std_errors": param_std_errors,
        "r_squared": float(r_squared),
        "rmse": float(rmse),
        "n": n,
        "x_data": [float(v) for v in x_scatter],
        "y_data": [float(v) for v in y_scatter],
        "curve_x": [float(v) for v in curve_x],
        "curve_y": [float(v) for v in curve_y],
    }

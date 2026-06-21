"""Design of Experiments (DOE) service.

Generates experimental design matrices from user-defined factors using only
the standard library (itertools) and numpy. No additional dependencies required.

Supported designs:
    full_factorial      — all combinations at 2+ levels (2^k or L^k)
    fractional_factorial — 2-level half/quarter/etc. fraction (2^(k-p))
    plackett_burman     — screening design; run count is next multiple of 4 ≥ k+1
"""

from __future__ import annotations

import itertools
from typing import Any

import numpy as np

_MAX_FACTORS = 10
_MAX_RUNS = 512

# Known Plackett-Burman generator rows for run sizes 4, 8, 12.
# Each row is the first row; subsequent rows are cyclic shifts.
# The last column is always +1 (identity).
_PB_GENERATORS: dict[int, list[int]] = {
    4: [1, -1, 1],                               # n=4, 3 factors max
    8: [1, 1, -1, 1, 1, 1, -1],                  # n=8, 7 factors max
    12: [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1],  # n=12, 11 factors max
}


def _validate_factors(factors: list[dict[str, Any]]) -> None:
    """Raise ValueError for invalid factor definitions."""
    if len(factors) < 2:
        raise ValueError("At least 2 factors are required to generate a design.")
    if len(factors) > _MAX_FACTORS:
        raise ValueError(f"A maximum of {_MAX_FACTORS} factors is supported.")
    for f in factors:
        if f["low"] >= f["high"]:
            raise ValueError(f"Factor '{f['name']}': low must be strictly less than high.")


def _coded_to_natural(coded: float, low: float, high: float) -> float:
    """Map coded value in [-1, +1] to natural units [low, high]."""
    return low + (coded + 1.0) / 2.0 * (high - low)


def full_factorial(factors: list[dict[str, Any]], levels: int = 2) -> dict[str, Any]:
    """Generate a full factorial design with *levels* levels per factor.

    For 2 levels: low and high values are used.
    For >2 levels: evenly spaced values between low and high (inclusive).

    Returns a dict compatible with DesignResponse.
    """
    factor_names = [f["name"] for f in factors]
    k = len(factors)

    if levels ** k > _MAX_RUNS:
        raise ValueError(
            f"Full factorial {levels}^{k} = {levels ** k} runs exceeds the {_MAX_RUNS}-run limit."
        )

    # Build level values for each factor
    level_values: list[list[float]] = []
    for f in factors:
        vals = np.linspace(f["low"], f["high"], levels).tolist()
        level_values.append(vals)

    runs = []
    for combo in itertools.product(*level_values):
        run = {factor_names[i]: combo[i] for i in range(k)}
        runs.append(run)

    return {
        "design_type": "full_factorial",
        "factor_names": factor_names,
        "n_runs": len(runs),
        "runs": runs,
        "resolution": None,
        "generators": None,
        "notes": [f"{levels}-level full factorial: {levels}^{k} = {len(runs)} runs"],
    }


def fractional_factorial(factors: list[dict[str, Any]], fraction: int = 1) -> dict[str, Any]:
    """Generate a 2-level fractional factorial design (2^(k-p)).

    Parameters
    ----------
    factors:
        List of factor dicts with name/low/high.
    fraction:
        The exponent p in 2^(k-p). Must satisfy p < k and 2^(k-p) >= 4.

    The base factors are the first (k-p) factors.
    The remaining p factors are aliased to products of base-factor columns
    following standard generator conventions (highest-order interactions first).

    Returns resolution as the minimum word length in the defining relation
    (computed from the generators).
    """
    k = len(factors)
    p = fraction

    if p >= k:
        raise ValueError(f"Fraction exponent p={p} must be less than k={k}.")

    k_base = k - p
    n_runs = 2 ** k_base

    if n_runs < 4:
        raise ValueError(
            f"2^({k}-{p}) = {n_runs} runs is too small. Choose a smaller fraction."
        )

    if n_runs > _MAX_RUNS:
        raise ValueError(f"Design would require {n_runs} runs (limit: {_MAX_RUNS}).")

    factor_names = [f["name"] for f in factors]
    base_names = factor_names[:k_base]

    # Build the full factorial on the base factors in coded ±1 space
    coded_levels = [-1.0, 1.0]
    base_matrix: list[list[float]] = []
    for combo in itertools.product(coded_levels, repeat=k_base):
        base_matrix.append(list(combo))

    # Define generators for added (aliased) factors.
    # Use standard generators: products of all base columns, removing trivial ones
    # Start with the highest-order interaction and work down.
    # We pre-compute interaction columns ordered by word length (descending).
    def _product_col(matrix: list[list[float]], indices: list[int]) -> list[float]:
        col = []
        for row in matrix:
            val = 1.0
            for idx in indices:
                val *= row[idx]
            col.append(val)
        return col

    # Enumerate all interaction columns from highest order down
    interaction_pool: list[tuple[tuple[int, ...], list[float]]] = []
    for r in range(k_base, 0, -1):
        for combo in itertools.combinations(range(k_base), r):
            col = _product_col(base_matrix, list(combo))
            interaction_pool.append((combo, col))

    # Remove the main-effect columns (word-length-1) since they're already in base
    interaction_pool = [(combo, col) for combo, col in interaction_pool if len(combo) > 1]

    # Pick the first p interactions as generators for the added factors
    if len(interaction_pool) < p:
        raise ValueError(
            f"Not enough interactions to alias {p} added factors. "
            "Reduce the fraction or add more base factors."
        )

    generators: list[str] = []
    added_cols: list[list[float]] = []
    gen_indices: list[tuple[int, ...]] = []
    for i in range(p):
        combo, col = interaction_pool[i]
        # Generator string, e.g. "D = ABC"
        gen_label = "".join(factor_names[j] for j in combo)
        generators.append(f"{factor_names[k_base + i]} = {gen_label}")
        added_cols.append(col)
        gen_indices.append(combo)

    # Build the full design matrix
    runs = []
    for row_idx, base_row in enumerate(base_matrix):
        run: dict[str, float] = {}
        for j, name in enumerate(base_names):
            run[name] = _coded_to_natural(base_row[j], factors[j]["low"], factors[j]["high"])
        for j, col in enumerate(added_cols):
            fac_idx = k_base + j
            run[factor_names[fac_idx]] = _coded_to_natural(
                col[row_idx], factors[fac_idx]["low"], factors[fac_idx]["high"]
            )
        runs.append(run)

    # Compute resolution: minimum word length in the defining relation.
    # The defining relation words are formed by multiplying each generator by the
    # aliased factor (word = generator_indices + [k_base + i] mapped to coded columns).
    # Word length = number of factors in the word.
    word_lengths: list[int] = []
    for i, combo in enumerate(gen_indices):
        # Word length = len(combo) + 1 (the added factor itself)
        word_lengths.append(len(combo) + 1)
    # Also check products of generator words (for designs with p >= 2)
    if p >= 2:
        for i, j in itertools.combinations(range(p), 2):
            word_lengths.append(len(gen_indices[i]) + len(gen_indices[j]) + 2)

    resolution = min(word_lengths) if word_lengths else k_base + 1

    return {
        "design_type": "fractional_factorial",
        "factor_names": factor_names,
        "n_runs": len(runs),
        "runs": runs,
        "resolution": resolution,
        "generators": generators,
        "notes": [
            f"2^({k}-{p}) fractional factorial: {len(runs)} runs",
            f"Resolution {resolution}",
        ],
    }


def plackett_burman(factors: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate a Plackett-Burman screening design.

    Supported sizes: n=4 (up to 3 factors), n=8 (up to 7 factors),
    n=12 (up to 11 factors). For k > 11 this falls back to raising an error.

    Returns runs with factor values mapped from coded ±1 to natural low/high.
    """
    k = len(factors)
    factor_names = [f["name"] for f in factors]

    # Determine next supported run size
    supported_sizes = sorted(_PB_GENERATORS.keys())  # [4, 8, 12]
    n = None
    for size in supported_sizes:
        if size > k:  # need at least k+1 columns (k factors + identity)
            n = size
            break

    if n is None:
        raise ValueError(
            f"Plackett-Burman designs are supported for up to {max(supported_sizes) - 1} factors. "
            f"Got {k}. Consider using a full or fractional factorial."
        )

    gen_row = _PB_GENERATORS[n]
    assert len(gen_row) == n - 1  # sanity: n-1 columns in gen row

    # Build the n × (n-1) design matrix via cyclic shifts
    matrix: list[list[int]] = []
    for shift in range(n - 1):
        matrix.append([gen_row[(i + shift) % (n - 1)] for i in range(n - 1)])
    # Last row is all -1
    matrix.append([-1] * (n - 1))

    # Take the first k columns (one per factor) and map to natural units
    notes = [f"Plackett-Burman: {n} runs (next multiple of 4 > {k} factors)"]
    if n > k + 1:
        notes.append(f"Design uses {n} runs; {n - k - 1} dummy column(s) not shown.")

    runs = []
    for row in matrix:
        run: dict[str, float] = {}
        for j in range(k):
            coded = float(row[j])
            run[factor_names[j]] = _coded_to_natural(coded, factors[j]["low"], factors[j]["high"])
        runs.append(run)

    return {
        "design_type": "plackett_burman",
        "factor_names": factor_names,
        "n_runs": n,
        "runs": runs,
        "resolution": 3,  # All PB designs are Resolution III
        "generators": None,
        "notes": notes,
    }


def add_center_points(design: dict[str, Any], factors: list[dict[str, Any]], n_center: int) -> dict[str, Any]:
    """Append n_center center-point runs to the design.

    Center points are placed at the midpoint of each factor's [low, high] range.
    """
    if n_center <= 0:
        return design

    factor_names = [f["name"] for f in factors]
    center_run = {f["name"]: (f["low"] + f["high"]) / 2.0 for f in factors}

    augmented_runs = list(design["runs"]) + [dict(center_run) for _ in range(n_center)]

    return {
        **design,
        "n_runs": len(augmented_runs),
        "runs": augmented_runs,
        "notes": list(design.get("notes", [])) + [f"{n_center} center point(s) added."],
    }


def generate_design(
    factors: list[dict[str, Any]],
    design_type: str,
    levels: int = 2,
    fraction: int = 1,
    n_center: int = 0,
) -> dict[str, Any]:
    """Dispatcher: validate inputs and route to the appropriate design function.

    Parameters
    ----------
    factors:
        List of dicts with keys ``name``, ``low``, ``high``.
    design_type:
        One of ``"full_factorial"``, ``"fractional_factorial"``, ``"plackett_burman"``.
    levels:
        Number of levels for full factorial (default 2).
    fraction:
        Exponent p in 2^(k-p) for fractional factorial (default 1 = half fraction).
    n_center:
        Number of center-point runs to append (default 0).

    Returns
    -------
    dict matching the DesignResponse schema.
    """
    _validate_factors(factors)

    if design_type == "full_factorial":
        result = full_factorial(factors, levels=levels)
    elif design_type == "fractional_factorial":
        result = fractional_factorial(factors, fraction=fraction)
    elif design_type == "plackett_burman":
        result = plackett_burman(factors)
    else:
        raise ValueError(
            f"Unknown design_type '{design_type}'. "
            "Choose from: full_factorial, fractional_factorial, plackett_burman."
        )

    if n_center > 0:
        result = add_center_points(result, factors, n_center)

    return result

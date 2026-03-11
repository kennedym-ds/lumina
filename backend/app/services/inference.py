"""Statistical inference services built on SciPy."""

from __future__ import annotations

from typing import Any

import pandas as pd
import numpy as np
from scipy import stats

from app.models.inference import AnovaRequest, CIRequest, ChiSquareRequest, TTestRequest

_ALLOWED_ALTERNATIVES = {"two-sided", "less", "greater"}


def _as_float(value: Any) -> float:
    return float(value)


def _ensure_columns_exist(df: pd.DataFrame, columns: list[str]) -> None:
    missing_columns = [column for column in columns if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Column(s) not found: {', '.join(missing_columns)}")


def _coerce_numeric(series: pd.Series, column_name: str) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() == 0:
        raise ValueError(f"Column '{column_name}' must be numeric")
    return numeric.astype(float)


def _validate_alternative(alternative: str) -> None:
    if alternative not in _ALLOWED_ALTERNATIVES:
        raise ValueError("alternative must be one of: two-sided, less, greater")


def _welch_df(sample_a: pd.Series, sample_b: pd.Series) -> float:
    variance_a = float(sample_a.var(ddof=1))
    variance_b = float(sample_b.var(ddof=1))
    n_a = len(sample_a)
    n_b = len(sample_b)
    numerator = (variance_a / n_a + variance_b / n_b) ** 2
    denominator = ((variance_a / n_a) ** 2) / (n_a - 1) + ((variance_b / n_b) ** 2) / (n_b - 1)
    if denominator == 0:
        return float(n_a + n_b - 2)
    return numerator / denominator


def _extract_ttest_values(result: Any, fallback_df: float) -> tuple[float, float, float]:
    statistic = _as_float(getattr(result, "statistic"))
    p_value = _as_float(getattr(result, "pvalue"))
    df_value = _as_float(getattr(result, "df", fallback_df))
    return statistic, p_value, df_value


def cohens_d(group_a: np.ndarray, group_b: np.ndarray) -> float:
    """Compute Cohen's d for two groups."""

    n1, n2 = len(group_a), len(group_b)
    if n1 < 2 or n2 < 2:
        return 0.0

    var1, var2 = group_a.var(ddof=1), group_b.var(ddof=1)
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    if pooled_std == 0 or np.isnan(pooled_std):
        return 0.0
    return float((group_a.mean() - group_b.mean()) / pooled_std)


def eta_squared(ss_between: float, ss_total: float) -> float:
    """Compute eta-squared effect size for ANOVA."""

    if ss_total == 0:
        return 0.0
    return float(ss_between / ss_total)


def cramers_v(chi2: float, n: int, min_dim: int) -> float:
    """Compute Cramér's V from chi-square statistic."""

    if n == 0 or min_dim <= 1:
        return 0.0
    return float(np.sqrt(chi2 / (n * (min_dim - 1))))


def compute_ci(values: np.ndarray, confidence_level: float = 0.95) -> tuple[float, float, float]:
    """Compute a t-based confidence interval for a mean."""

    from scipy.stats import t

    n = len(values)
    if n < 2:
        raise ValueError("Confidence intervals require at least 2 observations")

    mean = float(values.mean())
    se = float(values.std(ddof=1) / np.sqrt(n))
    if se == 0:
        return mean, mean, 0.0

    ci = t.interval(confidence_level, df=n - 1, loc=mean, scale=se)
    return float(ci[0]), float(ci[1]), se


def _paired_cohens_d(values: np.ndarray) -> float:
    if len(values) < 2:
        return 0.0

    std = float(values.std(ddof=1))
    if std == 0 or np.isnan(std):
        return 0.0
    return float(values.mean() / std)


def _one_sample_cohens_d(values: np.ndarray, mu: float) -> float:
    if len(values) < 2:
        return 0.0

    std = float(values.std(ddof=1))
    if std == 0 or np.isnan(std):
        return 0.0
    return float((values.mean() - mu) / std)


def _independent_mean_difference_ci(
    sample_a: pd.Series,
    sample_b: pd.Series,
    confidence_level: float = 0.95,
) -> tuple[float, float]:
    from scipy.stats import t

    mean_difference = _as_float(sample_a.mean() - sample_b.mean())
    variance_a = float(sample_a.var(ddof=1))
    variance_b = float(sample_b.var(ddof=1))
    standard_error = float(np.sqrt(variance_a / len(sample_a) + variance_b / len(sample_b)))
    if standard_error == 0 or np.isnan(standard_error):
        return mean_difference, mean_difference

    df_value = _welch_df(sample_a, sample_b)
    ci = t.interval(confidence_level, df=df_value, loc=mean_difference, scale=standard_error)
    return float(ci[0]), float(ci[1])


def run_ttest(df: pd.DataFrame, request: TTestRequest) -> dict[str, Any]:
    """Run an independent, paired, or one-sample t-test."""

    _validate_alternative(request.alternative)

    if request.test_type == "independent":
        _ensure_columns_exist(df, [request.column_a])

        if request.group_column:
            _ensure_columns_exist(df, [request.group_column])
            if not request.group_a or not request.group_b:
                raise ValueError("group_a and group_b are required for independent t-tests")

            working = pd.DataFrame(
                {
                    "value": _coerce_numeric(df[request.column_a], request.column_a),
                    "group": df[request.group_column],
                }
            ).dropna(subset=["value", "group"])
            labeled = working.assign(group_label=working["group"].map(str))
            sample_a = labeled.loc[labeled["group_label"] == request.group_a, "value"]
            sample_b = labeled.loc[labeled["group_label"] == request.group_b, "value"]
        else:
            if not request.column_b:
                raise ValueError("column_b is required when group_column is not provided")

            _ensure_columns_exist(df, [request.column_b])
            sample_a = _coerce_numeric(df[request.column_a], request.column_a).dropna()
            sample_b = _coerce_numeric(df[request.column_b], request.column_b).dropna()

        if len(sample_a) < 2 or len(sample_b) < 2:
            raise ValueError("Independent t-tests require at least 2 observations in each group")

        result = stats.ttest_ind(sample_a, sample_b, equal_var=False, alternative=request.alternative)
        statistic, p_value, df_value = _extract_ttest_values(result, _welch_df(sample_a, sample_b))
        ci_lower, ci_upper = _independent_mean_difference_ci(sample_a, sample_b)
        effect_size = cohens_d(sample_a.to_numpy(dtype=float), sample_b.to_numpy(dtype=float))
        return {
            "test_type": request.test_type,
            "statistic": statistic,
            "p_value": p_value,
            "df": df_value,
            "mean_a": _as_float(sample_a.mean()),
            "mean_b": _as_float(sample_b.mean()),
            "n_a": int(len(sample_a)),
            "n_b": int(len(sample_b)),
            "alternative": request.alternative,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "ci_level": 0.95,
            "effect_size": effect_size,
            "effect_size_label": "Cohen's d",
        }

    if request.test_type == "paired":
        if not request.column_b:
            raise ValueError("column_b is required for paired t-tests")

        _ensure_columns_exist(df, [request.column_a, request.column_b])
        working = pd.DataFrame(
            {
                "sample_a": _coerce_numeric(df[request.column_a], request.column_a),
                "sample_b": _coerce_numeric(df[request.column_b], request.column_b),
            }
        ).dropna()

        if len(working) < 2:
            raise ValueError("Paired t-tests require at least 2 paired observations")

        result = stats.ttest_rel(working["sample_a"], working["sample_b"], alternative=request.alternative)
        pair_count = int(len(working))
        statistic, p_value, df_value = _extract_ttest_values(result, pair_count - 1)
        differences = (working["sample_a"] - working["sample_b"]).to_numpy(dtype=float)
        ci_lower, ci_upper, _ = compute_ci(differences)
        return {
            "test_type": request.test_type,
            "statistic": statistic,
            "p_value": p_value,
            "df": df_value,
            "mean_a": _as_float(working["sample_a"].mean()),
            "mean_b": _as_float(working["sample_b"].mean()),
            "n_a": pair_count,
            "n_b": pair_count,
            "alternative": request.alternative,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "ci_level": 0.95,
            "effect_size": _paired_cohens_d(differences),
            "effect_size_label": "Cohen's d",
        }

    _ensure_columns_exist(df, [request.column_a])
    sample = _coerce_numeric(df[request.column_a], request.column_a).dropna()
    if len(sample) < 2:
        raise ValueError("One-sample t-tests require at least 2 observations")

    result = stats.ttest_1samp(sample, popmean=request.mu, alternative=request.alternative)
    statistic, p_value, df_value = _extract_ttest_values(result, len(sample) - 1)
    centered = sample.to_numpy(dtype=float) - request.mu
    ci_lower, ci_upper, _ = compute_ci(centered)
    return {
        "test_type": request.test_type,
        "statistic": statistic,
        "p_value": p_value,
        "df": df_value,
        "mean_a": _as_float(sample.mean()),
        "mean_b": _as_float(request.mu),
        "n_a": int(len(sample)),
        "n_b": None,
        "alternative": request.alternative,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "ci_level": 0.95,
        "effect_size": _one_sample_cohens_d(sample.to_numpy(dtype=float), request.mu),
        "effect_size_label": "Cohen's d",
    }


def run_chi_square(df: pd.DataFrame, request: ChiSquareRequest) -> dict[str, Any]:
    """Run a chi-square test of independence."""

    _ensure_columns_exist(df, [request.column_a, request.column_b])

    working = df[[request.column_a, request.column_b]].dropna()
    if working.empty:
        raise ValueError("Chi-square tests require at least one non-null observation")

    contingency = pd.crosstab(working[request.column_a].map(str), working[request.column_b].map(str))
    contingency = contingency.sort_index().sort_index(axis=1)

    if contingency.shape[0] < 2 or contingency.shape[1] < 2:
        raise ValueError("Chi-square tests require at least 2 categories in each column")

    chi_square_result: Any = stats.chi2_contingency(contingency)
    statistic = _as_float(chi_square_result[0])
    p_value = _as_float(chi_square_result[1])
    degrees_of_freedom = int(chi_square_result[2])
    expected = np.asarray(chi_square_result[3], dtype=float)
    expected_df = pd.DataFrame(expected, index=list(contingency.index), columns=list(contingency.columns))
    n_total = int(contingency.to_numpy().sum())

    return {
        "statistic": statistic,
        "p_value": p_value,
        "df": degrees_of_freedom,
        "contingency_table": {
            str(index): {str(column): int(_as_float(contingency.loc[index, column])) for column in contingency.columns}
            for index in contingency.index
        },
        "expected_frequencies": {
            str(index): {str(column): _as_float(expected_df.loc[index, column]) for column in expected_df.columns}
            for index in expected_df.index
        },
        "cramers_v": cramers_v(statistic, n_total, min(contingency.shape)),
        "n_total": n_total,
    }


def run_anova(df: pd.DataFrame, request: AnovaRequest) -> dict[str, Any]:
    """Run a one-way ANOVA test."""

    _ensure_columns_exist(df, [request.numeric_column, request.group_column])

    working = pd.DataFrame(
        {
            "value": _coerce_numeric(df[request.numeric_column], request.numeric_column),
            "group": df[request.group_column],
        }
    ).dropna(subset=["value", "group"])

    if working.empty:
        raise ValueError("One-way ANOVA requires at least one non-null observation")

    labeled = working.assign(group_label=working["group"].map(str))
    grouped_values: dict[str, pd.Series] = {}
    for group_name, group_df in labeled.groupby("group_label", sort=True):
        values = group_df["value"].astype(float)
        if len(values) < 2:
            raise ValueError("One-way ANOVA requires at least 2 observations per group")
        grouped_values[str(group_name)] = values

    if len(grouped_values) < 2:
        raise ValueError("One-way ANOVA requires at least two groups")

    statistic, p_value = stats.f_oneway(*grouped_values.values())
    total_observations = sum(len(values) for values in grouped_values.values())
    group_count = len(grouped_values)
    grand_mean = _as_float(working["value"].mean())
    ss_between = sum(len(values) * (_as_float(values.mean()) - grand_mean) ** 2 for values in grouped_values.values())
    ss_total = sum((_as_float(value) - grand_mean) ** 2 for value in working["value"])

    return {
        "statistic": _as_float(statistic),
        "p_value": _as_float(p_value),
        "df_between": group_count - 1,
        "df_within": total_observations - group_count,
        "group_means": {group: _as_float(values.mean()) for group, values in grouped_values.items()},
        "group_sizes": {group: int(len(values)) for group, values in grouped_values.items()},
        "eta_squared": eta_squared(ss_between, ss_total),
    }


def run_ci(df: pd.DataFrame, request: CIRequest) -> dict[str, Any]:
    """Compute a confidence interval for a numeric column mean."""

    _ensure_columns_exist(df, [request.column])
    sample = _coerce_numeric(df[request.column], request.column).dropna()
    if len(sample) < 2:
        raise ValueError("Confidence intervals require at least 2 observations")

    ci_lower, ci_upper, std_error = compute_ci(sample.to_numpy(dtype=float), request.confidence_level)
    return {
        "column": request.column,
        "mean": _as_float(sample.mean()),
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "confidence_level": request.confidence_level,
        "n": int(len(sample)),
        "std_error": std_error,
    }

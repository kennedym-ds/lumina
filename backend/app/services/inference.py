"""Statistical inference services built on SciPy and statsmodels."""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.formula.api import ols as smf_ols
from statsmodels.stats.anova import AnovaRM, anova_lm
from statsmodels.stats.diagnostic import lilliefors
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.power import FTestAnovaPower, TTestIndPower

from app.models.inference import (
    AnovaRequest,
    CIRequest,
    ChiSquareRequest,
    KruskalRequest,
    MannWhitneyRequest,
    NormalityRequest,
    PowerAnalysisRequest,
    TTestRequest,
    TukeyHSDRequest,
    WilcoxonRequest,
)

_ALLOWED_ALTERNATIVES = {"two-sided", "less", "greater"}
_SAFE_COL_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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


def _prepare_grouped_numeric_dataframe(df: pd.DataFrame, numeric_column: str, group_column: str) -> pd.DataFrame:
    _ensure_columns_exist(df, [numeric_column, group_column])

    working = pd.DataFrame(
        {
            "value": _coerce_numeric(df[numeric_column], numeric_column),
            "group": df[group_column],
        }
    ).dropna(subset=["value", "group"])

    if working.empty:
        raise ValueError("At least one non-null observation is required")

    return working.assign(group_label=working["group"].map(str))


def _build_grouped_series(
    working: pd.DataFrame,
    *,
    minimum_groups: int,
    minimum_group_size: int,
    error_prefix: str,
) -> dict[str, pd.Series]:
    grouped_values: dict[str, pd.Series] = {}
    for group_name, group_df in working.groupby("group_label", sort=True):
        values = group_df["value"].astype(float)
        if len(values) < minimum_group_size:
            raise ValueError(f"{error_prefix} requires at least {minimum_group_size} observations per group")
        grouped_values[str(group_name)] = values

    if len(grouped_values) < minimum_groups:
        raise ValueError(f"{error_prefix} requires at least {minimum_groups} groups")

    return grouped_values


def _resolve_two_group_samples(
    working: pd.DataFrame,
    *,
    group_a: str | None,
    group_b: str | None,
    error_prefix: str,
) -> tuple[str, pd.Series, str, pd.Series]:
    available_groups = sorted({str(value) for value in working["group_label"]})

    if group_a is not None or group_b is not None:
        if not group_a or not group_b:
            raise ValueError(f"{error_prefix} requires both group_a and group_b when specifying group labels")
        if group_a == group_b:
            raise ValueError("group_a and group_b must be different")

        missing = [group for group in (group_a, group_b) if group not in available_groups]
        if missing:
            raise ValueError(f"Group label(s) not found: {', '.join(missing)}")

        label_a = group_a
        label_b = group_b
    else:
        if len(available_groups) != 2:
            raise ValueError(f"{error_prefix} requires exactly 2 groups when group labels are not specified")
        label_a, label_b = available_groups

    sample_a = working.loc[working["group_label"] == label_a, "value"].astype(float)
    sample_b = working.loc[working["group_label"] == label_b, "value"].astype(float)
    return label_a, sample_a, label_b, sample_b


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


def run_tukey_hsd(df: pd.DataFrame, request: TukeyHSDRequest) -> dict[str, Any]:
    """Run Tukey HSD pairwise comparisons for a numeric column by group."""

    working = _prepare_grouped_numeric_dataframe(df, request.numeric_column, request.group_column)
    grouped_values = _build_grouped_series(
        working,
        minimum_groups=2,
        minimum_group_size=2,
        error_prefix="Tukey HSD",
    )

    result = pairwise_tukeyhsd(
        endog=working["value"].to_numpy(dtype=float),
        groups=working["group_label"].to_numpy(dtype=str),
        alpha=request.alpha,
    )

    comparisons = []
    for row in result._results_table.data[1:]:
        comparisons.append(
            {
                "group_a": str(row[0]),
                "group_b": str(row[1]),
                "mean_difference": _as_float(row[2]),
                "adjusted_p_value": _as_float(row[3]),
                "ci_lower": _as_float(row[4]),
                "ci_upper": _as_float(row[5]),
                "reject_null": bool(row[6]),
            }
        )

    return {
        "alpha": request.alpha,
        "group_means": {group: _as_float(values.mean()) for group, values in grouped_values.items()},
        "group_sizes": {group: int(len(values)) for group, values in grouped_values.items()},
        "comparisons": comparisons,
    }


def run_mann_whitney(df: pd.DataFrame, request: MannWhitneyRequest) -> dict[str, Any]:
    """Run a Mann-Whitney U test for two independent groups."""

    _validate_alternative(request.alternative)
    working = _prepare_grouped_numeric_dataframe(df, request.numeric_column, request.group_column)
    label_a, sample_a, label_b, sample_b = _resolve_two_group_samples(
        working,
        group_a=request.group_a,
        group_b=request.group_b,
        error_prefix="Mann-Whitney U",
    )

    if len(sample_a) < 2 or len(sample_b) < 2:
        raise ValueError("Mann-Whitney U requires at least 2 observations in each group")

    result = stats.mannwhitneyu(sample_a, sample_b, alternative=request.alternative)
    return {
        "statistic": _as_float(result.statistic),
        "p_value": _as_float(result.pvalue),
        "group_a": label_a,
        "group_b": label_b,
        "median_a": _as_float(sample_a.median()),
        "median_b": _as_float(sample_b.median()),
        "n_a": int(len(sample_a)),
        "n_b": int(len(sample_b)),
        "alternative": request.alternative,
    }


def run_wilcoxon(df: pd.DataFrame, request: WilcoxonRequest) -> dict[str, Any]:
    """Run a Wilcoxon signed-rank test for paired samples."""

    _validate_alternative(request.alternative)
    _ensure_columns_exist(df, [request.column_a, request.column_b])

    working = pd.DataFrame(
        {
            "sample_a": _coerce_numeric(df[request.column_a], request.column_a),
            "sample_b": _coerce_numeric(df[request.column_b], request.column_b),
        }
    ).dropna()

    if len(working) < 2:
        raise ValueError("Wilcoxon signed-rank requires at least 2 paired observations")

    differences = (working["sample_a"] - working["sample_b"]).to_numpy(dtype=float)
    if np.allclose(differences, 0.0):
        raise ValueError("Wilcoxon signed-rank requires at least one non-zero paired difference")

    result = stats.wilcoxon(
        working["sample_a"],
        working["sample_b"],
        alternative=request.alternative,
        zero_method="wilcox",
    )
    return {
        "statistic": _as_float(result.statistic),
        "p_value": _as_float(result.pvalue),
        "n_pairs": int(len(working)),
        "median_difference": _as_float(np.median(differences)),
        "alternative": request.alternative,
    }


def run_kruskal(df: pd.DataFrame, request: KruskalRequest) -> dict[str, Any]:
    """Run a Kruskal-Wallis test across two or more groups."""

    working = _prepare_grouped_numeric_dataframe(df, request.numeric_column, request.group_column)
    grouped_values = _build_grouped_series(
        working,
        minimum_groups=2,
        minimum_group_size=2,
        error_prefix="Kruskal-Wallis",
    )

    result = stats.kruskal(*grouped_values.values())
    return {
        "statistic": _as_float(result.statistic),
        "p_value": _as_float(result.pvalue),
        "df": len(grouped_values) - 1,
        "group_medians": {group: _as_float(values.median()) for group, values in grouped_values.items()},
        "group_sizes": {group: int(len(values)) for group, values in grouped_values.items()},
    }


def run_normality(df: pd.DataFrame, request: NormalityRequest) -> dict[str, Any]:
    """Run combined Shapiro-Wilk, Anderson-Darling, and Lilliefors normality checks."""

    _ensure_columns_exist(df, [request.column])
    sample = _coerce_numeric(df[request.column], request.column).dropna()
    if len(sample) < 3:
        raise ValueError("Normality tests require at least 3 observations")

    values = sample.to_numpy(dtype=float)
    if len(values) <= 5000:
        shapiro_result = stats.shapiro(values)
        shapiro_payload = {
            "statistic": _as_float(shapiro_result.statistic),
            "p_value": _as_float(shapiro_result.pvalue),
            "reject_null": _as_float(shapiro_result.pvalue) < request.alpha,
            "ran": True,
            "reason": None,
        }
    else:
        shapiro_payload = {
            "statistic": None,
            "p_value": None,
            "reject_null": None,
            "ran": False,
            "reason": "Shapiro-Wilk is only run for n <= 5000 observations.",
        }

    anderson_result = stats.anderson(values, dist="norm")
    significance_levels = [float(level) for level in anderson_result.significance_level]
    critical_values = [float(value) for value in anderson_result.critical_values]
    critical_value_at_five = next(
        (value for level, value in zip(significance_levels, critical_values, strict=False) if np.isclose(level, 5.0)),
        None,
    )
    if critical_value_at_five is None:
        raise ValueError("Anderson-Darling did not return a 5% critical value")

    lilliefors_statistic, lilliefors_p_value = lilliefors(values, dist="norm")

    return {
        "column": request.column,
        "n": int(len(sample)),
        "alpha": request.alpha,
        "shapiro": shapiro_payload,
        "anderson_darling": {
            "statistic": _as_float(anderson_result.statistic),
            "critical_values": {
                f"{level:.1f}%": _as_float(value)
                for level, value in zip(significance_levels, critical_values, strict=False)
            },
            "reject_null": _as_float(anderson_result.statistic) > critical_value_at_five,
            "significance_level": 0.05,
        },
        "lilliefors": {
            "statistic": _as_float(lilliefors_statistic),
            "p_value": _as_float(lilliefors_p_value),
            "reject_null": _as_float(lilliefors_p_value) < request.alpha,
            "ran": True,
            "reason": None,
        },
    }


def run_power_analysis(request: PowerAnalysisRequest) -> dict[str, Any]:
    """Solve for sample size or achieved power for t-tests and one-way ANOVA."""

    if request.analysis_type == "ttest":
        analyzer = TTestIndPower()

        if request.solve_for == "sample_size":
            if request.power is None:
                raise ValueError("power is required when solve_for='sample_size'")

            sample_size_per_group = float(
                analyzer.solve_power(
                    effect_size=request.effect_size,
                    alpha=request.alpha,
                    power=request.power,
                    ratio=request.ratio,
                    alternative=request.alternative,
                )
            )
            power = float(request.power)
        else:
            if request.sample_size_per_group is None:
                raise ValueError("sample_size_per_group is required when solve_for='power'")

            sample_size_per_group = float(request.sample_size_per_group)
            power = float(
                analyzer.power(
                    effect_size=request.effect_size,
                    nobs1=sample_size_per_group,
                    alpha=request.alpha,
                    ratio=request.ratio,
                    alternative=request.alternative,
                )
            )

        return {
            "analysis_type": request.analysis_type,
            "solve_for": request.solve_for,
            "effect_size": request.effect_size,
            "alpha": request.alpha,
            "power": power,
            "sample_size_per_group": sample_size_per_group,
            "total_sample_size": float(sample_size_per_group * (1.0 + request.ratio)),
            "ratio": request.ratio,
            "k_groups": None,
            "alternative": request.alternative,
        }

    analyzer = FTestAnovaPower()
    if request.solve_for == "sample_size":
        if request.power is None:
            raise ValueError("power is required when solve_for='sample_size'")

        total_sample_size = float(
            analyzer.solve_power(
                effect_size=request.effect_size,
                alpha=request.alpha,
                power=request.power,
                k_groups=request.k_groups,
            )
        )
        power = float(request.power)
    else:
        if request.sample_size_per_group is None:
            raise ValueError("sample_size_per_group is required when solve_for='power'")

        total_sample_size = float(request.sample_size_per_group * request.k_groups)
        power = float(
            analyzer.power(
                effect_size=request.effect_size,
                nobs=total_sample_size,
                alpha=request.alpha,
                k_groups=request.k_groups,
            )
        )

    return {
        "analysis_type": request.analysis_type,
        "solve_for": request.solve_for,
        "effect_size": request.effect_size,
        "alpha": request.alpha,
        "power": power,
        "sample_size_per_group": float(total_sample_size / request.k_groups),
        "total_sample_size": total_sample_size,
        "ratio": None,
        "k_groups": request.k_groups,
        "alternative": None,
    }


def run_repeated_measures_anova(
    df: pd.DataFrame,
    subject_column: str,
    within_column: str,
    dependent_column: str,
) -> dict:
    """Run repeated-measures ANOVA via statsmodels AnovaRM."""
    required = [subject_column, within_column, dependent_column]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {missing}")

    sub = df[required].dropna()
    if sub.empty:
        raise ValueError("No complete cases after dropping missing values.")

    n_subjects = sub[subject_column].nunique()
    if n_subjects < 2:
        raise ValueError("RM-ANOVA requires at least 2 subjects.")
    n_conditions = sub[within_column].nunique()
    if n_conditions < 2:
        raise ValueError("Within-subject factor must have at least 2 levels.")

    aovrm = AnovaRM(sub, depvar=dependent_column, subject=subject_column, within=[within_column])
    result = aovrm.fit()
    table = result.anova_table

    f_val = float(table["F Value"].iloc[0])
    p_val = float(table["Pr > F"].iloc[0])
    df_num = float(table["Num DF"].iloc[0])
    df_den = float(table["Den DF"].iloc[0])

    return {
        "f_statistic": f_val,
        "p_value": p_val,
        "df_num": df_num,
        "df_den": df_den,
        "n_subjects": n_subjects,
        "n_conditions": n_conditions,
        "reject_null": p_val < 0.05,
    }


def run_factorial_anova(
    df: pd.DataFrame,
    dependent_column: str,
    factors: list[str],
) -> dict:
    """Run factorial (Type II) ANOVA via statsmodels anova_lm."""
    if len(factors) < 2:
        raise ValueError("Factorial ANOVA requires at least 2 factors.")
    if len(factors) > 4:
        raise ValueError("Maximum 4 factors supported.")

    all_cols = [dependent_column] + factors
    missing = [c for c in all_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {missing}")

    sub = df[all_cols].dropna()
    if sub.empty:
        raise ValueError("No complete cases after dropping missing values.")

    for col in all_cols:
        if not _SAFE_COL_NAME.match(col):
            raise ValueError(
                f"Column name '{col}' contains characters incompatible with formula syntax. "
                "Rename the column to use only letters, digits, and underscores."
            )

    # Build formula with all main effects and interactions
    factor_terms = " * ".join(f"C({f})" for f in factors)
    formula = f"{dependent_column} ~ {factor_terms}"

    model = smf_ols(formula, data=sub).fit()
    table = anova_lm(model, typ=2)

    rows = []
    for source, row in table.iterrows():
        if source == "Residual":
            continue
        rows.append({
            "source": str(source),
            "sum_sq": float(row["sum_sq"]),
            "df": float(row["df"]),
            "f_statistic": float(row["F"]),
            "p_value": float(row["PR(>F)"]),
        })

    reject_any = any(r["p_value"] < 0.05 for r in rows)

    return {
        "table": rows,
        "n_observations": len(sub),
        "reject_any": reject_any,
    }

"""Pydantic request and response models for statistical inference endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TTestType = Literal["independent", "paired", "one_sample"]
AlternativeHypothesis = Literal["two-sided", "less", "greater"]
PowerAnalysisType = Literal["ttest", "anova"]
PowerSolveFor = Literal["sample_size", "power"]


class TTestRequest(BaseModel):
    """Payload for t-test requests."""

    test_type: TTestType
    column_a: str
    column_b: str | None = None
    group_column: str | None = None
    group_a: str | None = None
    group_b: str | None = None
    mu: float = 0.0
    alternative: AlternativeHypothesis = "two-sided"


class TTestResponse(BaseModel):
    """Response payload for t-test results."""

    test_type: TTestType
    statistic: float
    p_value: float
    df: float
    mean_a: float
    mean_b: float | None = None
    n_a: int
    n_b: int | None = None
    alternative: AlternativeHypothesis
    ci_lower: float | None = None
    ci_upper: float | None = None
    ci_level: float = 0.95
    effect_size: float | None = None
    effect_size_label: str = "Cohen's d"


class ChiSquareRequest(BaseModel):
    """Payload for chi-square independence tests."""

    column_a: str
    column_b: str


class ChiSquareResponse(BaseModel):
    """Response payload for chi-square independence tests."""

    statistic: float
    p_value: float
    df: int
    contingency_table: dict[str, dict[str, int]] = Field(default_factory=dict)
    expected_frequencies: dict[str, dict[str, float]] = Field(default_factory=dict)
    cramers_v: float | None = None
    n_total: int | None = None


class AnovaRequest(BaseModel):
    """Payload for one-way ANOVA tests."""

    numeric_column: str
    group_column: str


class AnovaResponse(BaseModel):
    """Response payload for one-way ANOVA tests."""

    statistic: float
    p_value: float
    df_between: int
    df_within: int
    group_means: dict[str, float] = Field(default_factory=dict)
    group_sizes: dict[str, int] = Field(default_factory=dict)
    eta_squared: float | None = None


class CIRequest(BaseModel):
    """Payload for confidence interval requests."""

    column: str
    confidence_level: float = Field(default=0.95, gt=0.0, lt=1.0)


class CIResponse(BaseModel):
    """Response payload for mean confidence interval results."""

    column: str
    mean: float
    ci_lower: float
    ci_upper: float
    confidence_level: float
    n: int
    std_error: float


class TukeyHSDRequest(BaseModel):
    """Payload for Tukey HSD pairwise comparisons."""

    numeric_column: str
    group_column: str
    alpha: float = Field(default=0.05, gt=0.0, lt=1.0)


class TukeyHSDComparison(BaseModel):
    """A single Tukey HSD pairwise comparison result."""

    group_a: str
    group_b: str
    mean_difference: float
    adjusted_p_value: float
    ci_lower: float
    ci_upper: float
    reject_null: bool


class TukeyHSDResponse(BaseModel):
    """Response payload for Tukey HSD results."""

    alpha: float
    group_means: dict[str, float] = Field(default_factory=dict)
    group_sizes: dict[str, int] = Field(default_factory=dict)
    comparisons: list[TukeyHSDComparison] = Field(default_factory=list)


class MannWhitneyRequest(BaseModel):
    """Payload for Mann-Whitney U tests."""

    numeric_column: str
    group_column: str
    group_a: str | None = None
    group_b: str | None = None
    alternative: AlternativeHypothesis = "two-sided"


class MannWhitneyResponse(BaseModel):
    """Response payload for Mann-Whitney U results."""

    statistic: float
    p_value: float
    group_a: str
    group_b: str
    median_a: float
    median_b: float
    n_a: int
    n_b: int
    alternative: AlternativeHypothesis


class WilcoxonRequest(BaseModel):
    """Payload for Wilcoxon signed-rank tests."""

    column_a: str
    column_b: str
    alternative: AlternativeHypothesis = "two-sided"


class WilcoxonResponse(BaseModel):
    """Response payload for Wilcoxon signed-rank results."""

    statistic: float
    p_value: float
    n_pairs: int
    median_difference: float
    alternative: AlternativeHypothesis


class KruskalRequest(BaseModel):
    """Payload for Kruskal-Wallis tests."""

    numeric_column: str
    group_column: str


class KruskalResponse(BaseModel):
    """Response payload for Kruskal-Wallis results."""

    statistic: float
    p_value: float
    df: int
    group_medians: dict[str, float] = Field(default_factory=dict)
    group_sizes: dict[str, int] = Field(default_factory=dict)


class NormalityRequest(BaseModel):
    """Payload for combined normality testing."""

    column: str
    alpha: float = Field(default=0.05, gt=0.0, lt=1.0)


class NormalityTestResult(BaseModel):
    """Summary for a normality test that reports a p-value."""

    statistic: float | None = None
    p_value: float | None = None
    reject_null: bool | None = None
    ran: bool = True
    reason: str | None = None


class AndersonDarlingResult(BaseModel):
    """Summary for an Anderson-Darling normality test."""

    statistic: float
    critical_values: dict[str, float] = Field(default_factory=dict)
    reject_null: bool
    significance_level: float = 0.05


class NormalityResponse(BaseModel):
    """Response payload for combined normality tests."""

    column: str
    n: int
    alpha: float
    shapiro: NormalityTestResult
    anderson_darling: AndersonDarlingResult
    lilliefors: NormalityTestResult


class BayesianOneSampleRequest(BaseModel):
    """Payload for Bayesian one-sample estimation."""

    column: str
    prior_mu: float = 0.0
    prior_sigma: float = Field(default=1e6, gt=0.0)
    credible_level: float = Field(default=0.95, gt=0.0, lt=1.0)


class BayesianOneSampleResponse(BaseModel):
    """Posterior summary for Bayesian one-sample estimation."""

    posterior_mean: float
    posterior_std: float
    ci_lower: float
    ci_upper: float
    credible_level: float
    bayes_factor_10: float
    n: int
    sample_mean: float
    sample_std: float


class BayesianTwoSampleRequest(BaseModel):
    """Payload for Bayesian two-sample estimation."""

    column_a: str
    column_b: str
    credible_level: float = Field(default=0.95, gt=0.0, lt=1.0)


class BayesianTwoSampleResponse(BaseModel):
    """Posterior summary for Bayesian two-sample estimation."""

    difference_mean: float
    difference_std: float
    ci_lower: float
    ci_upper: float
    credible_level: float
    prob_greater_than_zero: float
    group_a: BayesianOneSampleResponse
    group_b: BayesianOneSampleResponse


class PowerAnalysisRequest(BaseModel):
    """Payload for prospective power analysis."""

    analysis_type: PowerAnalysisType
    solve_for: PowerSolveFor
    effect_size: float = Field(gt=0.0)
    alpha: float = Field(default=0.05, gt=0.0, lt=1.0)
    power: float | None = Field(default=None, gt=0.0, lt=1.0)
    sample_size_per_group: float | None = Field(default=None, gt=0.0)
    ratio: float = Field(default=1.0, gt=0.0)
    k_groups: int = Field(default=2, ge=2)
    alternative: AlternativeHypothesis = "two-sided"


class PowerAnalysisResponse(BaseModel):
    """Response payload for power analysis results."""

    analysis_type: PowerAnalysisType
    solve_for: PowerSolveFor
    effect_size: float
    alpha: float
    power: float
    sample_size_per_group: float
    total_sample_size: float
    ratio: float | None = None
    k_groups: int | None = None
    alternative: AlternativeHypothesis | None = None


class RepeatedMeasuresAnovaRequest(BaseModel):
    """Repeated-measures ANOVA request."""
    subject_column: str
    within_column: str
    dependent_column: str


class RepeatedMeasuresAnovaResponse(BaseModel):
    """Repeated-measures ANOVA result."""
    f_statistic: float
    p_value: float
    df_num: float
    df_den: float
    n_subjects: int
    n_conditions: int
    reject_null: bool


class FactorialAnovaRequest(BaseModel):
    """Factorial (two-way+) ANOVA request using Type II SS."""
    dependent_column: str
    factors: list[str] = Field(min_length=2, max_length=4)


class FactorialAnovaFactor(BaseModel):
    """One row from the factorial ANOVA table."""
    source: str
    sum_sq: float
    df: float
    f_statistic: float
    p_value: float


class FactorialAnovaResponse(BaseModel):
    """Factorial ANOVA result table."""
    table: list[FactorialAnovaFactor]
    n_observations: int
    reject_any: bool

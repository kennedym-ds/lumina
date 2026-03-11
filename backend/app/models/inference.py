"""Pydantic request and response models for statistical inference endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TTestType = Literal["independent", "paired", "one_sample"]
AlternativeHypothesis = Literal["two-sided", "less", "greater"]


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

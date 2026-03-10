"""Pydantic request/response models for regression endpoints."""

from pydantic import BaseModel, Field


class RegressionRequest(BaseModel):
    """Regression fit request payload."""

    model_type: str  # "ols" | "logistic"
    dependent: str
    independents: list[str]
    train_test_split: float = 1.0
    missing_strategy: str = "listwise"  # "listwise" | "mean_imputation"


class MissingCheckRequest(BaseModel):
    """Payload for missing-value checks before regression."""

    dependent: str
    independents: list[str]


class CoefficientRow(BaseModel):
    """One coefficient row from a fitted regression model."""

    variable: str
    coefficient: float
    std_error: float
    t_stat: float | None = None
    z_stat: float | None = None
    p_value: float
    ci_lower: float
    ci_upper: float


class RegressionResponse(BaseModel):
    """Response for a fitted regression model."""

    model_id: str
    model_type: str
    dependent: str
    independents: list[str]
    coefficients: list[CoefficientRow]
    r_squared: float | None = None
    adj_r_squared: float | None = None
    f_statistic: float | None = None
    f_pvalue: float | None = None
    aic: float | None = None
    bic: float | None = None
    n_observations: int
    n_train: int | None = None
    n_test: int | None = None
    warnings: list[str] = Field(default_factory=list)


class DiagnosticsResponse(BaseModel):
    """OLS diagnostic plot payload."""

    residuals_vs_fitted: dict
    qq_plot: dict


class ConfusionMatrixResponse(BaseModel):
    """Logistic confusion matrix response payload."""

    matrix: list[list[int]]
    labels: list[str]
    accuracy: float
    precision: float
    recall: float
    f1: float
    heatmap_figure: dict


class RocResponse(BaseModel):
    """Logistic ROC payload."""

    fpr: list[float]
    tpr: list[float]
    auc: float
    roc_figure: dict


class MissingValueReport(BaseModel):
    """Missing-value summary for selected regression columns."""

    has_missing: bool
    columns_with_missing: list[dict]
    total_rows_affected: int
    recommendation: str

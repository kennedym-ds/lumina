"""Pydantic request/response models for regression endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class RegressionRequest(BaseModel):
    """Regression fit request payload."""

    model_type: str  # "ols" | "logistic" | "ridge" | "lasso" | "elastic_net" | "decision_tree" | "random_forest"
    dependent: str
    independents: list[str]
    interaction_terms: list[list[str]] | None = None
    train_test_split: float = 1.0
    missing_strategy: str = "listwise"  # "listwise" | "mean_imputation"
    alpha: float = Field(default=1.0, gt=0)
    l1_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    polynomial_degree: int = Field(default=1, ge=1, le=5)
    max_depth: int | None = Field(default=None, ge=1)
    n_estimators: int = Field(default=100, ge=1)
    learning_rate: float = Field(default=0.1, gt=0)


class MissingCheckRequest(BaseModel):
    """Payload for missing-value checks before regression."""

    dependent: str
    independents: list[str]


class CoefficientRow(BaseModel):
    """One coefficient row from a fitted regression model."""

    variable: str
    coefficient: float
    std_error: float | None = None
    t_stat: float | None = None
    z_stat: float | None = None
    p_value: float | None = None
    ci_lower: float | None = None
    ci_upper: float | None = None


class FeatureImportanceRow(BaseModel):
    """One feature-importance row for tree-based models."""

    feature: str
    importance: float


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
    rmse: float | None = None
    mae: float | None = None
    accuracy: float | None = None
    f1: float | None = None
    feature_importances: list[FeatureImportanceRow] | None = None
    n_observations: int
    n_train: int | None = None
    n_test: int | None = None
    warnings: list[str] = Field(default_factory=list)


class VIFEntry(BaseModel):
    """One variance inflation factor entry."""

    feature: str
    vif: float
    is_high: bool


class VIFResponse(BaseModel):
    """Response payload for variance inflation factor diagnostics."""

    entries: list[VIFEntry] = Field(default_factory=list)
    n_observations: int


class ModelComparisonEntry(BaseModel):
    """One fitted-model summary for side-by-side comparison."""

    model_id: str
    model_type: str
    r_squared: float | None = None
    rmse: float | None = None
    mae: float | None = None
    aic: float | None = None
    bic: float | None = None
    accuracy: float | None = None
    f1: float | None = None
    n_observations: int


class ModelComparisonResponse(BaseModel):
    """Response payload for model comparison history."""

    models: list[ModelComparisonEntry] = Field(default_factory=list)


class DiagnosticsResponse(BaseModel):
    """OLS diagnostic plot payload."""

    residuals_vs_fitted: dict
    qq_plot: dict


class PredictionRequest(BaseModel):
    """Payload for single-observation model prediction."""

    values: dict[str, float | int | str]


class PredictionResponse(BaseModel):
    """Predicted value, optional interval, and optional class probabilities."""

    predicted_value: float
    prediction_interval: tuple[float, float] | None = None
    probabilities: dict[str, float] | None = None


class ExtendedDiagnosticsResponse(BaseModel):
    """Feature importance, coefficient path, and partial dependence payloads."""

    feature_importances: list[dict[str, Any]] | None = None
    coefficient_path: dict[str, Any] | None = None
    partial_dependence: list[dict[str, Any]] | None = None


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


class CrossValidationRequest(BaseModel):
    """Cross-validation request payload."""

    model_type: str
    dependent: str
    independents: list[str]
    k: int = Field(default=5, ge=2, le=20)
    scoring: str = "r2"
    missing_strategy: str = "listwise"
    alpha: float = Field(default=1.0, gt=0)
    l1_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    polynomial_degree: int = Field(default=1, ge=1, le=5)
    max_depth: int | None = Field(default=None, ge=1)
    n_estimators: int = Field(default=100, ge=1)
    learning_rate: float = Field(default=0.1, gt=0)


class CrossValidationResponse(BaseModel):
    """Cross-validation results."""

    model_type: str
    k: int
    scoring: str
    fold_scores: list[float]
    mean_score: float
    std_score: float
    warnings: list[str] = Field(default_factory=list)


class DataValidationWarning(BaseModel):
    """A single data validation warning."""

    column: str
    warning_type: str
    message: str
    severity: str = "warning"


class DataValidationRequest(BaseModel):
    """Payload for pre-fit data quality validation."""

    dependent: str
    independents: list[str]
    model_type: str = "ols"


class DataValidationResponse(BaseModel):
    """Pre-fit data validation report."""

    warnings: list[DataValidationWarning] = Field(default_factory=list)
    can_proceed: bool = True


class StepwiseSelectionRequest(BaseModel):
    """Forward stepwise variable selection payload."""
    dependent: str
    candidates: list[str]
    criterion: str = "aic"  # "aic" | "bic"
    max_steps: int = Field(default=50, ge=1, le=200)


class StepwiseStep(BaseModel):
    """One step in stepwise selection."""
    step: int
    variable_added: str
    criterion_value: float


class StepwiseSelectionResponse(BaseModel):
    """Stepwise variable selection result."""
    selected_variables: list[str]
    steps: list[StepwiseStep]
    final_criterion: float
    criterion: str
    n_observations: int


class BayesianRegressionRequest(BaseModel):
    """Bayesian linear regression with conjugate normal-inverse-gamma prior."""
    dependent: str
    independents: list[str]
    prior_mu: float = 0.0
    prior_kappa: float = 0.001
    prior_alpha: float = 1.0
    prior_beta: float = 1.0
    credible_level: float = Field(default=0.95, gt=0, lt=1)
    missing_strategy: str = "listwise"


class BayesianCoefficientRow(BaseModel):
    """One coefficient from Bayesian regression posterior."""
    variable: str
    posterior_mean: float
    posterior_std: float
    ci_lower: float
    ci_upper: float


class BayesianRegressionResponse(BaseModel):
    """Bayesian linear regression posterior summary."""
    coefficients: list[BayesianCoefficientRow]
    sigma_squared_mean: float
    sigma_squared_std: float
    r_squared: float
    n_observations: int
    credible_level: float

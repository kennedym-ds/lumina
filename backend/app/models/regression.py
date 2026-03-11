"""Pydantic request/response models for regression endpoints."""

from pydantic import BaseModel, Field


class RegressionRequest(BaseModel):
    """Regression fit request payload."""

    model_type: str  # "ols" | "logistic" | "ridge" | "lasso" | "elastic_net" | "decision_tree" | "random_forest"
    dependent: str
    independents: list[str]
    train_test_split: float = 1.0
    missing_strategy: str = "listwise"  # "listwise" | "mean_imputation"
    alpha: float = Field(default=1.0, gt=0)
    l1_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    polynomial_degree: int = Field(default=1, ge=1, le=5)
    max_depth: int | None = Field(default=None, ge=1)
    n_estimators: int = Field(default=100, ge=1)


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
    feature_importances: list[FeatureImportanceRow] | None = None
    n_observations: int
    n_train: int | None = None
    n_test: int | None = None
    warnings: list[str] = Field(default_factory=list)


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

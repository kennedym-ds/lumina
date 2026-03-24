"""Regression model API routes."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sklearn.metrics import accuracy_score, f1_score

from app.models.regression import (
    BayesianCoefficientRow,
    BayesianRegressionRequest,
    BayesianRegressionResponse,
    ConfusionMatrixResponse,
    CrossValidationRequest,
    CrossValidationResponse,
    DataValidationRequest,
    DataValidationResponse,
    DiagnosticsResponse,
    ExtendedDiagnosticsResponse,
    MissingCheckRequest,
    MissingValueReport,
    ModelComparisonResponse,
    PredictionRequest,
    PredictionResponse,
    RegressionRequest,
    RegressionResponse,
    RocResponse,
    StepwiseSelectionRequest,
    StepwiseSelectionResponse,
    StepwiseStep,
    VIFResponse,
)
from app.services.error_translator import translate_error
from app.services.evaluation import (
    compute_confusion_matrix,
    compute_diagnostics,
    compute_extended_diagnostics,
    compute_roc_curve,
)
from app.services.missing_values import check_missing_values
from app.services.regression import (
    compute_vif,
    fit_decision_tree,
    fit_decision_tree_classifier,
    fit_elastic_net,
    fit_gradient_boosting_classifier,
    fit_gradient_boosting_regressor,
    fit_lasso,
    fit_logistic,
    fit_ols,
    fit_random_forest,
    fit_random_forest_classifier,
    fit_ridge,
    predict_new_observation,
    run_cross_validation,
    run_stepwise_selection,
    validate_data_quality,
)
from app.services.bayesian import bayesian_linear_regression
from app.session import store

router = APIRouter(prefix="/api/model", tags=["model"])

SUPPORTED_MODEL_TYPES = {
    "ols",
    "logistic",
    "ridge",
    "lasso",
    "elastic_net",
    "decision_tree",
    "random_forest",
    "decision_tree_classifier",
    "random_forest_classifier",
    "gradient_boosting",
    "gradient_boosting_classifier",
}
CLASSIFIER_TYPES = {"logistic", "decision_tree_classifier", "random_forest_classifier", "gradient_boosting_classifier"}


def _get_session(dataset_id: str):
    """Get a dataset session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


def _build_model_comparison_entry(response_payload: dict[str, Any], fit_result: dict[str, Any]) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "model_id": response_payload["model_id"],
        "model_type": response_payload["model_type"],
        "r_squared": response_payload.get("r_squared"),
        "rmse": response_payload.get("rmse"),
        "mae": response_payload.get("mae"),
        "aic": response_payload.get("aic"),
        "bic": response_payload.get("bic"),
        "accuracy": None,
        "f1": None,
        "n_observations": response_payload["n_observations"],
    }

    if response_payload.get("model_type") in CLASSIFIER_TYPES:
        y_eval = fit_result.get("y_eval")
        y_pred = fit_result.get("y_pred")
        if y_eval is not None and y_pred is not None:
            entry["accuracy"] = float(accuracy_score(y_eval, y_pred))
            entry["f1"] = float(f1_score(y_eval, y_pred, zero_division=0))

    return entry


@router.post("/{dataset_id}/regression", response_model=RegressionResponse)
async def fit_regression(dataset_id: str, request: RegressionRequest):
    """Fit a regression model for a selected dataset and variable set."""

    session = _get_session(dataset_id)

    if request.model_type not in SUPPORTED_MODEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported model_type '{request.model_type}'")

    if request.train_test_split <= 0.0 or request.train_test_split > 1.0:
        raise HTTPException(status_code=400, detail="train_test_split must be in (0, 1]")

    active_dataframe = session.active_dataframe

    try:
        if request.model_type == "ols":
            fit_result = fit_ols(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "logistic":
            fit_result = fit_logistic(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.interaction_terms,
            )
        elif request.model_type == "ridge":
            fit_result = fit_ridge(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.alpha,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "lasso":
            fit_result = fit_lasso(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.alpha,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "decision_tree":
            fit_result = fit_decision_tree(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "random_forest":
            fit_result = fit_random_forest(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.n_estimators,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "decision_tree_classifier":
            fit_result = fit_decision_tree_classifier(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.interaction_terms,
            )
        elif request.model_type == "random_forest_classifier":
            fit_result = fit_random_forest_classifier(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.n_estimators,
                request.interaction_terms,
            )
        elif request.model_type == "gradient_boosting":
            fit_result = fit_gradient_boosting_regressor(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.n_estimators,
                request.learning_rate,
                request.polynomial_degree,
                request.interaction_terms,
            )
        elif request.model_type == "gradient_boosting_classifier":
            fit_result = fit_gradient_boosting_classifier(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.max_depth,
                request.n_estimators,
                request.learning_rate,
                request.interaction_terms,
            )
        else:
            fit_result = fit_elastic_net(
                active_dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
                request.alpha,
                request.l1_ratio,
                request.polynomial_degree,
                request.interaction_terms,
            )
    except ValueError as exc:
        if exc.__class__.__name__ == "LinAlgError" or "Singular matrix" in str(exc):
            raise HTTPException(status_code=422, detail=translate_error(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    response_payload = dict(fit_result["response"])
    response_payload["model_id"] = str(uuid.uuid4())

    session.model_result = fit_result["model_result"]
    session.fitted_model = fit_result.get("model_object")
    session.feature_names = fit_result.get("feature_names")
    session.label_encoders = fit_result.get("label_encoders")
    session.predictor_dtypes = {
        column: str(active_dataframe[column].dtype)
        for column in request.independents
        if column in active_dataframe.columns
    }
    session.model_config_dict = {
        "model_type": request.model_type,
        "dependent": request.dependent,
        "independents": list(request.independents),
        "interaction_terms": request.interaction_terms,
        "train_test_split": request.train_test_split,
        "missing_strategy": request.missing_strategy,
        "alpha": request.alpha,
        "l1_ratio": request.l1_ratio,
        "polynomial_degree": request.polynomial_degree,
        "max_depth": request.max_depth,
        "n_estimators": request.n_estimators,
        "learning_rate": request.learning_rate,
    }
    session.model_result_payload = dict(response_payload)
    session.model_predictions = {
        "X_eval": fit_result.get("X_eval"),
        "y_eval": fit_result.get("y_eval"),
        "y_pred": fit_result.get("y_pred"),
        "y_prob": fit_result.get("y_prob"),
        "labels": fit_result.get("labels", ["0", "1"]),
    }
    session.model_history.append(_build_model_comparison_entry(response_payload, fit_result))

    return RegressionResponse(**response_payload)


@router.get("/{dataset_id}/vif", response_model=VIFResponse)
async def get_vif(dataset_id: str):
    """Compute variance inflation factors for the latest fitted regression design matrix."""

    session = _get_session(dataset_id)

    if session.fitted_model is None:
        raise HTTPException(status_code=400, detail="No fitted model available")

    config = session.model_config_dict
    try:
        result = compute_vif(
            session.active_dataframe,
            str(config.get("dependent", "")),
            [str(column) for column in config.get("independents", [])],
            str(config.get("missing_strategy", "listwise")),
            config.get("interaction_terms"),
            int(config.get("polynomial_degree", 1) or 1),
        )
    except HTTPException as exc:
        raise exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return VIFResponse(**result)


@router.post("/{dataset_id}/predict", response_model=PredictionResponse)
async def predict(dataset_id: str, request: PredictionRequest):
    """Predict a new observation using the latest fitted model."""

    session = _get_session(dataset_id)

    if session.fitted_model is None:
        raise HTTPException(status_code=400, detail="No fitted model available")

    try:
        result = predict_new_observation(session, request.values)
    except HTTPException as exc:
        raise exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return PredictionResponse(**result)


@router.get("/{dataset_id}/extended-diagnostics", response_model=ExtendedDiagnosticsResponse)
async def extended_diagnostics(dataset_id: str):
    """Return feature importance, coefficient path, and partial dependence payloads."""

    session = _get_session(dataset_id)

    if session.fitted_model is None:
        raise HTTPException(status_code=400, detail="No fitted model available")

    try:
        result = compute_extended_diagnostics(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return ExtendedDiagnosticsResponse(**result)


@router.get("/{dataset_id}/comparison", response_model=ModelComparisonResponse)
async def get_model_comparison(dataset_id: str):
    """Return fitted-model summaries for side-by-side comparison."""

    session = _get_session(dataset_id)
    return ModelComparisonResponse(models=list(session.model_history))


@router.get("/{dataset_id}/diagnostics", response_model=DiagnosticsResponse)
async def get_diagnostics(dataset_id: str):
    """Get OLS diagnostic plots from the latest fitted model."""

    session = _get_session(dataset_id)

    model_type = session.model_config_dict.get("model_type")
    if model_type != "ols":
        raise HTTPException(status_code=400, detail="Diagnostics are only available for OLS models")

    model_result = session.model_result
    X_eval = session.model_predictions.get("X_eval")
    y_eval = session.model_predictions.get("y_eval")

    if model_result is None or X_eval is None or y_eval is None:
        raise HTTPException(status_code=400, detail="No fitted OLS model available")

    try:
        diagnostics = compute_diagnostics(model_result, X_eval, y_eval)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return DiagnosticsResponse(**diagnostics)


@router.get("/{dataset_id}/confusion", response_model=ConfusionMatrixResponse)
async def get_confusion_matrix(dataset_id: str):
    """Get confusion matrix metrics for the latest fitted logistic model."""

    session = _get_session(dataset_id)

    model_type = session.model_config_dict.get("model_type")
    if model_type not in CLASSIFIER_TYPES:
        raise HTTPException(status_code=400, detail="Confusion matrix is only available for classifier models")

    y_true = session.model_predictions.get("y_eval")
    y_pred = session.model_predictions.get("y_pred")

    if y_true is None or y_pred is None:
        raise HTTPException(status_code=400, detail="No fitted classifier model available")

    payload = compute_confusion_matrix(y_true, y_pred, session.model_predictions.get("y_prob"))

    labels = session.model_predictions.get("labels")
    if isinstance(labels, list) and len(labels) == 2:
        payload["labels"] = [str(labels[0]), str(labels[1])]
        heatmap = payload.get("heatmap_figure", {})
        if isinstance(heatmap, dict) and heatmap.get("data"):
            first_trace: dict[str, Any] = heatmap["data"][0]
            first_trace["x"] = payload["labels"]
            first_trace["y"] = payload["labels"]

    return ConfusionMatrixResponse(**payload)


@router.get("/{dataset_id}/roc", response_model=RocResponse)
async def get_roc(dataset_id: str):
    """Get ROC curve payload for the latest fitted logistic model."""

    session = _get_session(dataset_id)

    model_type = session.model_config_dict.get("model_type")
    if model_type not in CLASSIFIER_TYPES:
        raise HTTPException(status_code=400, detail="ROC is only available for classifier models")

    y_true = session.model_predictions.get("y_eval")
    y_prob = session.model_predictions.get("y_prob")

    if y_true is None or y_prob is None:
        raise HTTPException(status_code=400, detail="No fitted classifier model available")

    payload = compute_roc_curve(y_true, y_prob)
    return RocResponse(**payload)


@router.post("/{dataset_id}/check-missing", response_model=MissingValueReport)
async def check_missing(dataset_id: str, request: MissingCheckRequest):
    """Check missing values for selected dependent/independent columns."""

    session = _get_session(dataset_id)

    columns = [request.dependent, *request.independents]
    try:
        report = check_missing_values(session.active_dataframe, columns)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return report


@router.post("/{dataset_id}/cross-validate", response_model=CrossValidationResponse)
async def cross_validate(dataset_id: str, request: CrossValidationRequest):
    """Run k-fold cross-validation for the given model configuration."""

    session = _get_session(dataset_id)

    if request.model_type not in SUPPORTED_MODEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported model_type '{request.model_type}'")

    try:
        result = run_cross_validation(
            session.active_dataframe,
            request.model_type,
            request.dependent,
            request.independents,
            request.k,
            request.scoring,
            request.missing_strategy,
            request.alpha,
            request.l1_ratio,
            request.polynomial_degree,
            request.max_depth,
            request.n_estimators,
            request.learning_rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=translate_error(exc)) from exc

    return CrossValidationResponse(**result)


@router.post("/{dataset_id}/validate", response_model=DataValidationResponse)
async def validate_data(dataset_id: str, request: DataValidationRequest):
    """Validate data quality before model fitting."""

    session = _get_session(dataset_id)

    try:
        result = validate_data_quality(
            session.active_dataframe,
            request.dependent,
            request.independents,
            request.model_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DataValidationResponse(**result)


@router.post("/{dataset_id}/stepwise", response_model=StepwiseSelectionResponse)
def stepwise_selection(dataset_id: str, body: StepwiseSelectionRequest):
    session = _get_session(dataset_id)
    df = session.active_dataframe
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        result = run_stepwise_selection(
            df,
            dependent=body.dependent,
            candidates=body.candidates,
            criterion=body.criterion,
            max_steps=body.max_steps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return StepwiseSelectionResponse(
        selected_variables=result["selected_variables"],
        steps=[StepwiseStep(**s) for s in result["steps"]],
        final_criterion=result["final_criterion"],
        criterion=result["criterion"],
        n_observations=result["n_observations"],
    )


@router.post("/{dataset_id}/bayesian-regression", response_model=BayesianRegressionResponse)
def bayesian_regression(dataset_id: str, body: BayesianRegressionRequest):
    session = _get_session(dataset_id)
    df = session.active_dataframe
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        result = bayesian_linear_regression(
            df,
            dependent=body.dependent,
            independents=body.independents,
            prior_mu=body.prior_mu,
            prior_kappa=body.prior_kappa,
            prior_alpha=body.prior_alpha,
            prior_beta=body.prior_beta,
            credible_level=body.credible_level,
            missing_strategy=body.missing_strategy,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BayesianRegressionResponse(
        coefficients=[BayesianCoefficientRow(**c) for c in result["coefficients"]],
        sigma_squared_mean=result["sigma_squared_mean"],
        sigma_squared_std=result["sigma_squared_std"],
        r_squared=result["r_squared"],
        n_observations=result["n_observations"],
        credible_level=result["credible_level"],
    )

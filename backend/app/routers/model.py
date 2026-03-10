"""Regression model API routes."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.regression import (
    ConfusionMatrixResponse,
    DiagnosticsResponse,
    MissingCheckRequest,
    MissingValueReport,
    RegressionRequest,
    RegressionResponse,
    RocResponse,
)
from app.services.error_translator import translate_error
from app.services.evaluation import compute_confusion_matrix, compute_diagnostics, compute_roc_curve
from app.services.missing_values import check_missing_values
from app.services.regression import fit_logistic, fit_ols
from app.session import store

router = APIRouter(prefix="/api/model", tags=["model"])

SUPPORTED_MODEL_TYPES = {"ols", "logistic"}


def _get_session(dataset_id: str):
    """Get a dataset session or raise 404."""

    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return session


@router.post("/{dataset_id}/regression", response_model=RegressionResponse)
async def fit_regression(dataset_id: str, request: RegressionRequest):
    """Fit a regression model for a selected dataset and variable set."""

    session = _get_session(dataset_id)

    if request.model_type not in SUPPORTED_MODEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported model_type '{request.model_type}'")

    if request.train_test_split <= 0.0 or request.train_test_split > 1.0:
        raise HTTPException(status_code=400, detail="train_test_split must be in (0, 1]")

    try:
        if request.model_type == "ols":
            fit_result = fit_ols(
                session.dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
            )
        else:
            fit_result = fit_logistic(
                session.dataframe,
                request.dependent,
                request.independents,
                request.train_test_split,
                request.missing_strategy,
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
    session.model_config_dict = {
        "model_type": request.model_type,
        "dependent": request.dependent,
        "independents": list(request.independents),
        "train_test_split": request.train_test_split,
        "missing_strategy": request.missing_strategy,
    }
    session.model_predictions = {
        "X_eval": fit_result.get("X_eval"),
        "y_eval": fit_result.get("y_eval"),
        "y_pred": fit_result.get("y_pred"),
        "y_prob": fit_result.get("y_prob"),
        "labels": fit_result.get("labels", ["0", "1"]),
    }

    return RegressionResponse(**response_payload)


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
    if model_type != "logistic":
        raise HTTPException(status_code=400, detail="Confusion matrix is only available for logistic models")

    y_true = session.model_predictions.get("y_eval")
    y_pred = session.model_predictions.get("y_pred")

    if y_true is None or y_pred is None:
        raise HTTPException(status_code=400, detail="No fitted logistic model available")

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
    if model_type != "logistic":
        raise HTTPException(status_code=400, detail="ROC is only available for logistic models")

    y_true = session.model_predictions.get("y_eval")
    y_prob = session.model_predictions.get("y_prob")

    if y_true is None or y_prob is None:
        raise HTTPException(status_code=400, detail="No fitted logistic model available")

    payload = compute_roc_curve(y_true, y_prob)
    return RocResponse(**payload)


@router.post("/{dataset_id}/check-missing", response_model=MissingValueReport)
async def check_missing(dataset_id: str, request: MissingCheckRequest):
    """Check missing values for selected dependent/independent columns."""

    session = _get_session(dataset_id)

    columns = [request.dependent, *request.independents]
    try:
        report = check_missing_values(session.dataframe, columns)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return report

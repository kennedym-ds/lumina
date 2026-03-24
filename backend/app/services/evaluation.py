"""Model evaluation utilities for regression endpoints."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from sklearn import metrics
from sklearn.inspection import partial_dependence
from sklearn.linear_model import ElasticNet, Lasso, Ridge

from app.services.regression import CLASSIFIER_TYPES, _apply_polynomial_features, _prepare_design_matrix

OKABE_ITO_COLORWAY = [
    "#E69F00",
    "#56B4E9",
    "#009E73",
    "#F0E442",
    "#0072B2",
    "#D55E00",
    "#CC79A7",
    "#000000",
]
TREE_MODEL_TYPES = {
    "decision_tree",
    "random_forest",
    "gradient_boosting",
    "decision_tree_classifier",
    "random_forest_classifier",
    "gradient_boosting_classifier",
}
REGULARIZED_MODEL_TYPES = {"ridge", "lasso", "elastic_net"}


def _to_float_list(values: Any) -> list[float]:
    return [float(v) for v in list(values)]


def compute_diagnostics(model_result: Any, X: Any, y: Any) -> dict[str, dict[str, Any]]:
    """Generate residuals-vs-fitted and Q-Q plots for OLS."""

    y_true = np.asarray(y, dtype=float)
    fitted = np.asarray(model_result.predict(X), dtype=float)
    residuals = y_true - fitted

    residuals_vs_fitted = {
        "data": [
            {
                "type": "scatter",
                "mode": "markers",
                "x": _to_float_list(fitted),
                "y": _to_float_list(residuals),
                "name": "Residuals",
            }
        ],
        "layout": {
            "template": "plotly_white",
            "colorway": OKABE_ITO_COLORWAY,
            "title": {"text": "Residuals vs Fitted"},
            "xaxis": {"title": {"text": "Fitted values"}},
            "yaxis": {"title": {"text": "Residuals"}},
        },
    }

    (theoretical_q, sample_q), (slope, intercept, _r) = stats.probplot(residuals, dist="norm")
    qq_line = [slope * q + intercept for q in theoretical_q]

    qq_plot = {
        "data": [
            {
                "type": "scatter",
                "mode": "markers",
                "x": _to_float_list(theoretical_q),
                "y": _to_float_list(sample_q),
                "name": "Residual quantiles",
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": _to_float_list(theoretical_q),
                "y": _to_float_list(qq_line),
                "name": "Reference line",
            },
        ],
        "layout": {
            "template": "plotly_white",
            "colorway": OKABE_ITO_COLORWAY,
            "title": {"text": "Q-Q Plot"},
            "xaxis": {"title": {"text": "Theoretical quantiles"}},
            "yaxis": {"title": {"text": "Sample quantiles"}},
        },
    }

    return {
        "residuals_vs_fitted": residuals_vs_fitted,
        "qq_plot": qq_plot,
    }


def compute_confusion_matrix(y_true: Any, y_pred: Any, y_prob: Any = None) -> dict[str, Any]:
    """Compute confusion matrix metrics and heatmap figure for logistic regression."""

    y_true_arr = np.asarray(y_true, dtype=int)
    y_pred_arr = np.asarray(y_pred, dtype=int)

    labels = ["0", "1"]
    cm = metrics.confusion_matrix(y_true_arr, y_pred_arr, labels=[0, 1])

    accuracy = metrics.accuracy_score(y_true_arr, y_pred_arr)
    precision = metrics.precision_score(y_true_arr, y_pred_arr, zero_division=0)
    recall = metrics.recall_score(y_true_arr, y_pred_arr, zero_division=0)
    f1 = metrics.f1_score(y_true_arr, y_pred_arr, zero_division=0)

    heatmap_figure = {
        "data": [
            {
                "type": "heatmap",
                "z": cm.tolist(),
                "x": labels,
                "y": labels,
                "colorscale": "Blues",
                "showscale": True,
            }
        ],
        "layout": {
            "template": "plotly_white",
            "colorway": OKABE_ITO_COLORWAY,
            "title": {"text": "Confusion matrix"},
            "xaxis": {"title": {"text": "Predicted label"}},
            "yaxis": {"title": {"text": "True label"}},
        },
    }

    return {
        "matrix": [[int(v) for v in row] for row in cm.tolist()],
        "labels": labels,
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "heatmap_figure": heatmap_figure,
    }


def compute_roc_curve(y_true: Any, y_prob: Any) -> dict[str, Any]:
    """Compute ROC curve data + Plotly figure for logistic regression."""

    y_true_arr = np.asarray(y_true, dtype=int)
    y_prob_arr = np.asarray(y_prob, dtype=float)

    fpr, tpr, _thresholds = metrics.roc_curve(y_true_arr, y_prob_arr)
    auc_value = metrics.auc(fpr, tpr)

    roc_figure = {
        "data": [
            {
                "type": "scatter",
                "mode": "lines",
                "x": _to_float_list(fpr),
                "y": _to_float_list(tpr),
                "name": "ROC",
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": [0.0, 1.0],
                "y": [0.0, 1.0],
                "name": "Chance",
                "line": {"dash": "dash"},
            },
        ],
        "layout": {
            "template": "plotly_white",
            "colorway": OKABE_ITO_COLORWAY,
            "title": {"text": "ROC curve"},
            "xaxis": {"title": {"text": "False positive rate"}},
            "yaxis": {"title": {"text": "True positive rate"}},
        },
    }

    return {
        "fpr": _to_float_list(fpr),
        "tpr": _to_float_list(tpr),
        "auc": float(auc_value),
        "roc_figure": roc_figure,
    }


def _subsample_rows(X: pd.DataFrame, y: pd.Series | None = None, max_rows: int = 500) -> tuple[pd.DataFrame, pd.Series | None]:
    if len(X) <= max_rows:
        return X, y

    sampled_X = X.sample(n=max_rows, random_state=42)
    if y is None:
        return sampled_X, None

    return sampled_X, y.loc[sampled_X.index]


def _prepare_session_matrix(session: Any) -> tuple[str, pd.DataFrame, pd.Series, list[str]]:
    config = session.model_config_dict
    model_type = str(config.get("model_type", ""))
    dependent = str(config.get("dependent", ""))
    independents = [str(column) for column in config.get("independents", [])]
    missing_strategy = str(config.get("missing_strategy", "listwise"))
    polynomial_degree = int(config.get("polynomial_degree", 1) or 1)

    _cleaned_df, y, X, _warnings, _label_encoders = _prepare_design_matrix(
        session.active_dataframe,
        dependent,
        independents,
        missing_strategy,
    )

    if model_type not in CLASSIFIER_TYPES:
        X_model, feature_names = _apply_polynomial_features(X, [], polynomial_degree)
    else:
        X_model = X
        feature_names = [str(column) for column in X.columns]

    return model_type, X_model, y, feature_names


def _get_top_feature_indices(model: Any, feature_names: list[str], limit: int = 4) -> list[int]:
    if hasattr(model, "feature_importances_"):
        importances = np.ravel(np.asarray(model.feature_importances_))
        return np.argsort(importances)[::-1][: min(limit, len(feature_names))].tolist()

    if hasattr(model, "coef_"):
        coefficients = np.ravel(np.asarray(model.coef_))
        return np.argsort(np.abs(coefficients))[::-1][: min(limit, len(feature_names))].tolist()

    return []


def _extract_partial_dependence_values(result: Any) -> tuple[np.ndarray, np.ndarray]:
    if hasattr(result, "grid_values"):
        grid = np.asarray(result.grid_values[0], dtype=float)
    else:
        grid = np.asarray(result["grid_values"][0], dtype=float)

    if hasattr(result, "average"):
        average = np.asarray(result.average, dtype=float)
    else:
        average = np.asarray(result["average"], dtype=float)

    if average.ndim == 1:
        values = average
    else:
        values = average.reshape(-1, average.shape[-1])[0]

    return grid, values


def compute_extended_diagnostics(session: Any) -> dict[str, Any]:
    """Compute extended diagnostics for the latest fitted model."""

    model = session.fitted_model
    if model is None:
        raise ValueError("No fitted model available")

    model_type, X_model, y, feature_names = _prepare_session_matrix(session)
    stored_feature_names = session.feature_names or feature_names

    feature_importances: list[dict[str, Any]] | None = None
    if model_type in TREE_MODEL_TYPES and hasattr(model, "feature_importances_"):
        rows = [
            {
                "feature": str(name),
                "importance": float(importance),
            }
            for name, importance in zip(stored_feature_names, np.ravel(np.asarray(model.feature_importances_)), strict=False)
        ]
        feature_importances = sorted(rows, key=lambda row: row["importance"], reverse=True)

    coefficient_path: dict[str, Any] | None = None
    if model_type in REGULARIZED_MODEL_TYPES:
        sampled_X, sampled_y = _subsample_rows(X_model, y)
        alphas = np.logspace(-4, 4, 50)
        paths: dict[str, list[float]] = {name: [] for name in stored_feature_names}
        l1_ratio = float(session.model_config_dict.get("l1_ratio", 0.5) or 0.5)

        for alpha in alphas:
            if model_type == "ridge":
                estimator = Ridge(alpha=float(alpha))
            elif model_type == "lasso":
                estimator = Lasso(alpha=float(alpha), max_iter=10000)
            else:
                estimator = ElasticNet(alpha=float(alpha), l1_ratio=l1_ratio, max_iter=10000)

            estimator.fit(sampled_X, sampled_y)
            coefficients = np.ravel(np.asarray(estimator.coef_))
            for name, coefficient in zip(stored_feature_names, coefficients, strict=False):
                paths[name].append(float(coefficient))

        coefficient_path = {
            "alphas": [float(alpha) for alpha in alphas],
            "paths": paths,
        }

    partial_dependence_rows: list[dict[str, Any]] | None = None
    if hasattr(model, "predict") and model_type != "ols" and model_type != "logistic":
        sampled_X, _sampled_y = _subsample_rows(X_model, y)
        top_indices = _get_top_feature_indices(model, stored_feature_names)
        if top_indices:
            partial_dependence_rows = []
            for feature_index in top_indices:
                result = partial_dependence(model, sampled_X, [feature_index], grid_resolution=50)
                grid, values = _extract_partial_dependence_values(result)
                partial_dependence_rows.append(
                    {
                        "feature": stored_feature_names[feature_index],
                        "grid": _to_float_list(grid),
                        "pd_values": _to_float_list(values),
                    }
                )

    return {
        "feature_importances": feature_importances,
        "coefficient_path": coefficient_path,
        "partial_dependence": partial_dependence_rows,
    }

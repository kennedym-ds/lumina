"""Model evaluation utilities for regression endpoints."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import stats
from sklearn import metrics

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

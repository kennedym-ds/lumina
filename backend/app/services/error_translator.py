"""Translate technical modeling exceptions into user-facing messages."""

from __future__ import annotations

ERROR_MAP = {
    "LinAlgError": "The model could not be fitted. Check for perfectly collinear variables.",
    "Singular matrix": "Check for collinear variables — the design matrix is singular.",
    "ConvergenceWarning": "The model did not converge. Try removing highly correlated variables.",
    "PerfectSeparationError": (
        "Perfect or quasi-complete separation detected. Logistic regression cannot be fitted "
        "with these variables."
    ),
}


DEFAULT_MESSAGE = "Model fitting failed. Please review your variable selection and try again."


def translate_error(exc: Exception) -> str:
    """Translate a statsmodels/sklearn exception to a user-friendly message."""

    type_name = exc.__class__.__name__
    message = str(exc)

    for key, friendly in ERROR_MAP.items():
        if key == type_name or key in type_name or key in message:
            return friendly

    return DEFAULT_MESSAGE

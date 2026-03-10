"""Regression model fitting services (OLS + logistic)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.model_selection import train_test_split

from app.services.missing_values import apply_missing_strategy


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return float(value)


def _validate_input_columns(df: pd.DataFrame, dependent: str, independents: list[str]) -> None:
    if not dependent:
        raise ValueError("dependent is required")
    if not independents:
        raise ValueError("independents must contain at least one column")

    all_columns = [dependent, *independents]
    missing_columns = [col for col in all_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Column(s) not found: {', '.join(missing_columns)}")


def _encode_features(df: pd.DataFrame, independents: list[str], warnings: list[str]) -> pd.DataFrame:
    raw = df[independents]
    encoded = pd.get_dummies(raw, drop_first=True)

    if len(encoded.columns) != len(raw.columns) or any(encoded.columns != raw.columns):
        warnings.append("Categorical variables were one-hot encoded (drop_first=True)")

    if encoded.shape[1] == 0:
        raise ValueError("No usable independent variables after preprocessing")

    return encoded


def _ensure_non_singular(X: Any) -> None:
    array = np.asarray(X)
    rank = np.linalg.matrix_rank(array)
    if rank < array.shape[1]:
        raise np.linalg.LinAlgError("Singular matrix")


def _coefficient_rows(
    model: Any,
    stat_values: pd.Series,
    stat_field: str,
) -> list[dict[str, float | str | None]]:
    conf_int = model.conf_int()
    rows: list[dict[str, float | str | None]] = []

    for variable in model.params.index:
        row: dict[str, float | str | None] = {
            "variable": str(variable),
            "coefficient": _to_float(model.params[variable]),
            "std_error": _to_float(model.bse[variable]),
            "t_stat": None,
            "z_stat": None,
            "p_value": _to_float(model.pvalues[variable]),
            "ci_lower": _to_float(conf_int.loc[variable, 0]),
            "ci_upper": _to_float(conf_int.loc[variable, 1]),
        }
        row[stat_field] = _to_float(stat_values[variable])
        rows.append(row)

    return rows


def _prepare_design_matrix(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    missing_strategy: str,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, list[str]]:
    _validate_input_columns(df, dependent, independents)

    selected_columns = [dependent, *independents]
    cleaned_df, warnings = apply_missing_strategy(df, selected_columns, missing_strategy)

    y = cleaned_df[dependent]
    X = _encode_features(cleaned_df, independents, warnings)

    return cleaned_df, y, X, warnings


def fit_ols(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
) -> dict[str, Any]:
    """Fit OLS regression via statsmodels."""

    cleaned_df, y, X, warnings = _prepare_design_matrix(df, dependent, independents, missing_strategy)

    if train_split < 1.0:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            train_size=train_split,
            random_state=42,
        )
    else:
        X_train, y_train = X, y
        X_test, y_test = None, None

    X_train_const = sm.add_constant(X_train, has_constant="add")
    _ensure_non_singular(X_train_const)

    model = sm.OLS(y_train, X_train_const).fit()

    if X_test is not None and y_test is not None:
        X_eval = sm.add_constant(X_test, has_constant="add")
        y_eval = y_test
        n_train = int(len(X_train))
        n_test = int(len(X_test))
    else:
        X_eval = X_train_const
        y_eval = y_train
        n_train = None
        n_test = None

    coefficients = _coefficient_rows(model, model.tvalues, "t_stat")

    response = {
        "model_type": "ols",
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "r_squared": _to_float(model.rsquared),
        "adj_r_squared": _to_float(model.rsquared_adj),
        "f_statistic": _to_float(model.fvalue),
        "f_pvalue": _to_float(model.f_pvalue),
        "aic": _to_float(model.aic),
        "bic": _to_float(model.bic),
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
    }

    return {
        "response": response,
        "model_result": model,
        "X_eval": X_eval,
        "y_eval": y_eval,
        "y_pred": model.predict(X_eval),
    }


def _encode_binary_target(y: pd.Series, warnings: list[str]) -> tuple[pd.Series, list[str]]:
    if pd.api.types.is_bool_dtype(y):
        return y.astype(int), ["0", "1"]

    unique = list(pd.Series(y.dropna().unique()))
    if len(unique) != 2:
        raise ValueError("Logistic regression requires a binary dependent variable")

    sorted_unique = sorted(unique)
    mapping = {sorted_unique[0]: 0, sorted_unique[1]: 1}
    encoded = y.map(mapping)
    if encoded.isna().any():
        raise ValueError("Unable to encode dependent variable as binary")

    if sorted_unique != [0, 1]:
        warnings.append("Dependent variable was encoded to binary values (0/1)")

    labels = [str(sorted_unique[0]), str(sorted_unique[1])]
    return encoded.astype(int), labels


def fit_logistic(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
) -> dict[str, Any]:
    """Fit logistic regression via statsmodels."""

    cleaned_df, y_raw, X, warnings = _prepare_design_matrix(df, dependent, independents, missing_strategy)
    y, labels = _encode_binary_target(y_raw, warnings)

    if train_split < 1.0:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            train_size=train_split,
            random_state=42,
            stratify=y,
        )
    else:
        X_train, y_train = X, y
        X_test, y_test = None, None

    X_train_const = sm.add_constant(X_train, has_constant="add")
    _ensure_non_singular(X_train_const)

    model = sm.Logit(y_train, X_train_const).fit(disp=0, maxiter=100)

    if X_test is not None and y_test is not None:
        X_eval = sm.add_constant(X_test, has_constant="add")
        y_eval = y_test
        n_train = int(len(X_train))
        n_test = int(len(X_test))
    else:
        X_eval = X_train_const
        y_eval = y_train
        n_train = None
        n_test = None

    z_values = getattr(model, "zvalues", model.tvalues)
    coefficients = _coefficient_rows(model, z_values, "z_stat")

    y_prob = model.predict(X_eval)
    y_pred = (y_prob >= 0.5).astype(int)

    response = {
        "model_type": "logistic",
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "aic": _to_float(model.aic),
        "bic": _to_float(model.bic),
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
    }

    return {
        "response": response,
        "model_result": model,
        "X_eval": X_eval,
        "y_eval": y_eval,
        "y_prob": y_prob,
        "y_pred": y_pred,
        "labels": labels,
    }

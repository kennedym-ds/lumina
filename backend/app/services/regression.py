"""Regression model fitting services (OLS + logistic)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import ElasticNet, Lasso, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import PolynomialFeatures
from sklearn.tree import DecisionTreeRegressor

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


def _sklearn_coefficient_rows(
    intercept: float | None,
    coefficients: np.ndarray,
    feature_names: list[str],
) -> list[dict[str, float | str | None]]:
    rows: list[dict[str, float | str | None]] = []

    if intercept is not None:
        rows.append(
            {
                "variable": "const",
                "coefficient": intercept,
                "std_error": None,
                "t_stat": None,
                "z_stat": None,
                "p_value": None,
                "ci_lower": None,
                "ci_upper": None,
            }
        )

    for name, coefficient in zip(feature_names, coefficients, strict=False):
        rows.append(
            {
                "variable": str(name),
                "coefficient": _to_float(coefficient),
                "std_error": None,
                "t_stat": None,
                "z_stat": None,
                "p_value": None,
                "ci_lower": None,
                "ci_upper": None,
            }
        )

    return rows


def _feature_importance_rows(
    feature_names: list[str],
    importances: np.ndarray,
) -> tuple[list[dict[str, float | str | None]], list[dict[str, float | str]]]:
    coefficient_rows: list[dict[str, float | str | None]] = []
    feature_rows: list[dict[str, float | str]] = []

    for name, importance in zip(feature_names, importances, strict=False):
        importance_value = float(importance)
        coefficient_rows.append(
            {
                "variable": str(name),
                "coefficient": importance_value,
                "std_error": None,
                "t_stat": None,
                "z_stat": None,
                "p_value": None,
                "ci_lower": None,
                "ci_upper": None,
            }
        )
        feature_rows.append({"feature": str(name), "importance": importance_value})

    return coefficient_rows, feature_rows


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


def _ensure_numeric_target(y: pd.Series, model_type: str) -> None:
    if not pd.api.types.is_numeric_dtype(y):
        raise ValueError(f"{model_type} requires a numeric dependent variable")


def _apply_polynomial_features(
    X: pd.DataFrame,
    warnings: list[str],
    poly_degree: int,
) -> tuple[pd.DataFrame, list[str]]:
    feature_names = [str(column) for column in X.columns]
    if poly_degree <= 1:
        return X, feature_names

    polynomial = PolynomialFeatures(degree=poly_degree, include_bias=False)
    transformed = polynomial.fit_transform(X)
    feature_names = [str(name) for name in polynomial.get_feature_names_out(feature_names)]
    warnings.append(f"Expanded independent variables to polynomial degree {poly_degree}")

    transformed_df = pd.DataFrame(transformed, columns=feature_names, index=X.index)
    return transformed_df, feature_names


def _compute_regression_error_metrics(y_true: Any, y_pred: Any) -> tuple[float | None, float | None]:
    if y_true is None or y_pred is None:
        return None, None

    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = mean_absolute_error(y_true, y_pred)
    return _to_float(rmse), _to_float(mae)


def _fit_regularized_regression(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    *,
    model_type: str,
    estimator: Any,
    poly_degree: int,
) -> dict[str, Any]:
    cleaned_df, y, X, warnings = _prepare_design_matrix(df, dependent, independents, missing_strategy)
    X_model, feature_names = _apply_polynomial_features(X, warnings, poly_degree)

    if train_split < 1.0:
        X_train, X_test, y_train, y_test = train_test_split(
            X_model,
            y,
            train_size=train_split,
            random_state=42,
        )
    else:
        X_train, y_train = X_model, y
        X_test, y_test = None, None

    estimator.fit(X_train, y_train)

    if X_test is not None and y_test is not None:
        X_eval = X_test
        y_eval = y_test
        n_train = int(len(X_train))
        n_test = int(len(X_test))
    else:
        X_eval = X_train
        y_eval = y_train
        n_train = None
        n_test = None

    y_pred = estimator.predict(X_eval)
    rmse, mae = _compute_regression_error_metrics(y_eval, y_pred)
    intercept = _to_float(np.ravel(np.asarray(estimator.intercept_))[0])
    coefficients = _sklearn_coefficient_rows(intercept, np.ravel(np.asarray(estimator.coef_)), feature_names)

    response = {
        "model_type": model_type,
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "r_squared": _to_float(estimator.score(X_eval, y_eval)),
        "adj_r_squared": None,
        "f_statistic": None,
        "f_pvalue": None,
        "aic": None,
        "bic": None,
        "rmse": rmse,
        "mae": mae,
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
    }

    return {
        "response": response,
        "model_result": estimator,
        "X_eval": X_eval,
        "y_eval": y_eval,
        "y_pred": y_pred,
    }


def _fit_tree_regression(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    *,
    model_type: str,
    estimator: Any,
    poly_degree: int,
) -> dict[str, Any]:
    cleaned_df, y, X, warnings = _prepare_design_matrix(df, dependent, independents, missing_strategy)
    _ensure_numeric_target(y, model_type.replace("_", " ").title())

    X_model, feature_names = _apply_polynomial_features(X, warnings, poly_degree)

    if train_split < 1.0:
        X_train, X_test, y_train, y_test = train_test_split(
            X_model,
            y,
            train_size=train_split,
            random_state=42,
        )
    else:
        X_train, y_train = X_model, y
        X_test, y_test = None, None

    estimator.fit(X_train, y_train)

    if X_test is not None and y_test is not None:
        X_eval = X_test
        y_eval = y_test
        n_train = int(len(X_train))
        n_test = int(len(X_test))
    else:
        X_eval = X_train
        y_eval = y_train
        n_train = None
        n_test = None

    y_pred = estimator.predict(X_eval)
    rmse, mae = _compute_regression_error_metrics(y_eval, y_pred)
    coefficients, feature_importances = _feature_importance_rows(
        feature_names,
        np.ravel(np.asarray(estimator.feature_importances_)),
    )

    response = {
        "model_type": model_type,
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "feature_importances": feature_importances,
        "r_squared": _to_float(estimator.score(X_eval, y_eval)),
        "adj_r_squared": None,
        "f_statistic": None,
        "f_pvalue": None,
        "aic": None,
        "bic": None,
        "rmse": rmse,
        "mae": mae,
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
    }

    return {
        "response": response,
        "model_result": estimator,
        "X_eval": X_eval,
        "y_eval": y_eval,
        "y_pred": y_pred,
    }


def fit_ols(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit OLS regression via statsmodels."""

    cleaned_df, y, X, warnings = _prepare_design_matrix(df, dependent, independents, missing_strategy)
    X_model, _feature_names = _apply_polynomial_features(X, warnings, poly_degree)

    if train_split < 1.0:
        X_train, X_test, y_train, y_test = train_test_split(
            X_model,
            y,
            train_size=train_split,
            random_state=42,
        )
    else:
        X_train, y_train = X_model, y
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
    y_pred = model.predict(X_eval)
    rmse, mae = _compute_regression_error_metrics(y_eval, y_pred)

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
        "rmse": rmse,
        "mae": mae,
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
        "y_pred": y_pred,
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


def fit_ridge(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    alpha: float = 1.0,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit Ridge regression via scikit-learn."""

    return _fit_regularized_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="ridge",
        estimator=Ridge(alpha=alpha),
        poly_degree=poly_degree,
    )


def fit_lasso(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    alpha: float = 1.0,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit Lasso regression via scikit-learn."""

    return _fit_regularized_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="lasso",
        estimator=Lasso(alpha=alpha, max_iter=10000),
        poly_degree=poly_degree,
    )


def fit_elastic_net(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    alpha: float = 1.0,
    l1_ratio: float = 0.5,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit Elastic Net regression via scikit-learn."""

    return _fit_regularized_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="elastic_net",
        estimator=ElasticNet(alpha=alpha, l1_ratio=l1_ratio, max_iter=10000),
        poly_degree=poly_degree,
    )


def fit_decision_tree(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit Decision Tree regression via scikit-learn."""

    return _fit_tree_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="decision_tree",
        estimator=DecisionTreeRegressor(max_depth=max_depth, random_state=42),
        poly_degree=poly_degree,
    )


def fit_random_forest(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    n_estimators: int = 100,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Fit Random Forest regression via scikit-learn."""

    return _fit_tree_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="random_forest",
        estimator=RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
        ),
        poly_degree=poly_degree,
    )

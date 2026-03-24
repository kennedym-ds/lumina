"""Regression model fitting services (OLS + logistic)."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import logging
from typing import Any

import joblib
import numpy as np
import pandas as pd
import statsmodels.api as sm
from fastapi import HTTPException
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import PolynomialFeatures
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from statsmodels.stats.outliers_influence import variance_inflation_factor

from app.config import get_model_signing_secret
from app.services.missing_values import apply_missing_strategy

logger = logging.getLogger(__name__)

CLASSIFIER_TYPES = {
    "logistic",
    "decision_tree_classifier",
    "random_forest_classifier",
    "gradient_boosting_classifier",
}
MAX_SERIALIZED_MODEL_BYTES = 10 * 1024 * 1024
EncodingMetadata = dict[str, list[Any]]


def serialize_model(session: Any) -> str | None:
    """Serialize the fitted model and preprocessing metadata to a base64 blob."""

    if session.fitted_model is None:
        return None

    payload = {
        "model": session.fitted_model,
        "feature_names": session.feature_names,
        "label_encoders": session.label_encoders,
        "predictor_dtypes": session.predictor_dtypes,
        "prediction_labels": session.model_predictions.get("labels") if session.model_predictions else None,
    }
    buffer = io.BytesIO()
    joblib.dump(payload, buffer)
    raw = buffer.getvalue()

    if len(raw) > MAX_SERIALIZED_MODEL_BYTES:
        logger.warning(
            "Serialized model for dataset %s is %.2f MB; consider reducing estimator count.",
            getattr(session, "dataset_id", "unknown"),
            len(raw) / (1024 * 1024),
        )

    signature = hmac.new(get_model_signing_secret(), raw, hashlib.sha256).hexdigest()
    return f"{signature}:{base64.b64encode(raw).decode('ascii')}"


def deserialize_model(blob: str, session: Any) -> None:
    """Restore a fitted model and preprocessing metadata from a base64 blob."""

    if ":" not in blob:
        raise HTTPException(status_code=400, detail="Invalid model blob format")

    signature, b64data = blob.split(":", 1)

    try:
        raw = base64.b64decode(b64data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid model blob format") from exc

    expected_signature = hmac.new(get_model_signing_secret(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=400,
            detail=(
                "Model blob signature mismatch — the model was created on a different machine "
                "or has been tampered with. Please re-fit the model."
            ),
        )

    buffer = io.BytesIO(raw)
    try:
        payload = joblib.load(buffer)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid model blob format") from exc

    try:
        session.fitted_model = payload["model"]
        session.model_result = payload["model"]
        session.feature_names = payload.get("feature_names")
        session.label_encoders = payload.get("label_encoders")
        session.predictor_dtypes = payload.get("predictor_dtypes")
        prediction_labels = payload.get("prediction_labels")
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid model blob format") from exc

    if prediction_labels is not None:
        session.model_predictions = {
            **session.model_predictions,
            "labels": list(prediction_labels),
        }


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


def _encode_features(
    df: pd.DataFrame,
    independents: list[str],
    warnings: list[str],
    label_encoders: EncodingMetadata | None = None,
) -> tuple[pd.DataFrame, EncodingMetadata]:
    raw = df[independents]
    encoder_mapping: EncodingMetadata = dict(label_encoders or {})

    if encoder_mapping:
        raw = raw.copy()
        for column, categories in encoder_mapping.items():
            if column not in raw.columns:
                continue

            observed_values = pd.Series(raw[column].dropna().unique()).tolist()
            unseen_values = [value for value in observed_values if value not in categories]
            if unseen_values:
                raise ValueError(f"Unseen category '{unseen_values[0]}' for column '{column}'")

            raw[column] = pd.Categorical(raw[column], categories=categories)
    else:
        raw = raw.copy()
        for column in raw.columns:
            if pd.api.types.is_numeric_dtype(raw[column]):
                continue

            categories = pd.Series(raw[column].dropna().unique()).tolist()
            if not categories:
                raise ValueError(f"Column '{column}' has no usable categorical values")

            raw[column] = pd.Categorical(raw[column], categories=categories)
            encoder_mapping[column] = categories

    encoded = pd.get_dummies(raw, drop_first=True)

    if len(encoded.columns) != len(raw.columns) or any(encoded.columns != raw.columns):
        warnings.append("Categorical variables were one-hot encoded (drop_first=True)")

    if encoded.shape[1] == 0:
        raise ValueError("No usable independent variables after preprocessing")

    return encoded, encoder_mapping


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
    interaction_terms: list[list[str]] | None = None,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, list[str], EncodingMetadata]:
    _validate_input_columns(df, dependent, independents)

    selected_columns = [dependent, *independents]
    cleaned_df, warnings = apply_missing_strategy(df, selected_columns, missing_strategy)

    y = cleaned_df[dependent]
    X, label_encoders = _encode_features(cleaned_df, independents, warnings)
    X = _apply_interaction_terms(X, warnings, interaction_terms)

    return cleaned_df, y, X, warnings, label_encoders


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


def _apply_interaction_terms(
    X: pd.DataFrame,
    warnings: list[str],
    interaction_terms: list[list[str]] | None,
) -> pd.DataFrame:
    if not interaction_terms:
        return X

    transformed = X.copy()
    added_terms: list[str] = []

    for term in interaction_terms:
        if len(term) < 2:
            raise ValueError("Each interaction term must reference at least two features")

        columns = [str(column) for column in term]
        missing_columns = [column for column in columns if column not in transformed.columns]
        if missing_columns:
            raise ValueError(
                "Interaction term column(s) not found after preprocessing: " + ", ".join(missing_columns)
            )

        interaction_name = ":".join(columns)
        interaction_values = transformed[columns[0]].astype(float)
        for column in columns[1:]:
            interaction_values = interaction_values * transformed[column].astype(float)

        transformed[interaction_name] = interaction_values.astype(float)
        added_terms.append(interaction_name)

    if added_terms:
        warnings.append("Added interaction terms: " + ", ".join(added_terms))

    return transformed


def _prediction_scalar(value: Any, class_labels: list[Any] | None = None) -> float:
    numeric = _to_float(value)
    if numeric is not None:
        return numeric

    if class_labels is not None:
        for index, label in enumerate(class_labels):
            if label == value:
                return float(index)

    raise ValueError(f"Unable to convert predicted value '{value}' to float")


def _build_prediction_frame(values: dict[str, float | int | str], independents: list[str]) -> pd.DataFrame:
    missing_columns = [column for column in independents if column not in values]
    if missing_columns:
        raise ValueError(f"Missing prediction values for: {', '.join(missing_columns)}")

    ordered_values = {column: values[column] for column in independents}
    return pd.DataFrame([ordered_values], columns=independents)


def _validate_prediction_input_types(
    values: dict[str, float | int | str],
    predictor_dtypes: dict[str, str] | None,
) -> None:
    if not predictor_dtypes:
        return

    for column, dtype_name in predictor_dtypes.items():
        if column not in values:
            continue

        try:
            predictor_dtype = pd.api.types.pandas_dtype(dtype_name)
        except TypeError:
            continue

        if pd.api.types.is_numeric_dtype(predictor_dtype) and isinstance(values[column], str):
            raise HTTPException(status_code=400, detail=f"Predictor '{column}' requires a numeric value")


def _prepare_prediction_matrix(
    values: dict[str, float | int | str],
    independents: list[str],
    poly_degree: int,
    feature_names: list[str] | None,
    label_encoders: EncodingMetadata | None,
    interaction_terms: list[list[str]] | None = None,
) -> pd.DataFrame:
    warnings: list[str] = []
    prediction_df = _build_prediction_frame(values, independents)
    encoded, _ = _encode_features(prediction_df, independents, warnings, label_encoders)
    encoded = _apply_interaction_terms(encoded, warnings, interaction_terms)
    X_model, derived_feature_names = _apply_polynomial_features(encoded, warnings, poly_degree)
    expected_feature_names = feature_names or derived_feature_names
    return X_model.reindex(columns=expected_feature_names, fill_value=0.0)


def _compute_regression_error_metrics(y_true: Any, y_pred: Any) -> tuple[float | None, float | None]:
    if y_true is None or y_pred is None:
        return None, None

    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = mean_absolute_error(y_true, y_pred)
    return _to_float(rmse), _to_float(mae)


def _prepare_binary_classifier_target(y: pd.Series, model_type: str) -> None:
    unique = pd.Series(y.dropna().unique())
    if len(unique) != 2:
        raise ValueError(f"{model_type} requires a binary dependent variable")


def _encode_classifier_values(values: Any, mapping: dict[Any, int]) -> np.ndarray:
    encoded = pd.Series(values).map(mapping)
    if encoded.isna().any():
        raise ValueError("Unable to encode classifier outputs")
    return encoded.astype(int).to_numpy()


def _fit_tree_classifier(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    *,
    model_type: str,
    estimator: Any,
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    cleaned_df, y, X, warnings, label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
    _prepare_binary_classifier_target(y, model_type.replace("_", " ").title())

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

    estimator.fit(X_train, y_train)

    if X_test is not None and y_test is not None:
        X_eval = X_test
        y_eval_raw = y_test
        n_train = int(len(X_train))
        n_test = int(len(X_test))
    else:
        X_eval = X_train
        y_eval_raw = y_train
        n_train = None
        n_test = None

    class_labels = list(estimator.classes_)
    if len(class_labels) != 2:
        raise ValueError(f"{model_type} requires a binary dependent variable")

    mapping = {label: index for index, label in enumerate(class_labels)}
    y_pred_raw = estimator.predict(X_eval)
    y_prob = estimator.predict_proba(X_eval)[:, 1]
    y_eval = _encode_classifier_values(y_eval_raw, mapping)
    y_pred = _encode_classifier_values(y_pred_raw, mapping)

    accuracy = float(accuracy_score(y_eval, y_pred))
    f1 = float(f1_score(y_eval, y_pred, zero_division=0))
    coefficients, feature_importances = _feature_importance_rows(
        [str(column) for column in X.columns],
        np.ravel(np.asarray(estimator.feature_importances_)),
    )

    response = {
        "model_type": model_type,
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "feature_importances": feature_importances,
        "r_squared": None,
        "adj_r_squared": None,
        "f_statistic": None,
        "f_pvalue": None,
        "aic": None,
        "bic": None,
        "rmse": None,
        "mae": None,
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
        "accuracy": accuracy,
        "f1": f1,
    }

    return {
        "response": response,
        "model_result": estimator,
        "model_object": estimator,
        "feature_names": [str(column) for column in X.columns],
        "label_encoders": label_encoders,
        "X_eval": X_eval,
        "y_eval": y_eval,
        "y_pred": y_pred,
        "y_prob": y_prob,
        "labels": [str(label) for label in class_labels],
    }


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
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    cleaned_df, y, X, warnings, label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
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
        "model_object": estimator,
        "feature_names": feature_names,
        "label_encoders": label_encoders,
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
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    cleaned_df, y, X, warnings, label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
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
        "model_object": estimator,
        "feature_names": feature_names,
        "label_encoders": label_encoders,
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
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit OLS regression via statsmodels."""

    cleaned_df, y, X, warnings, label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
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
        "model_object": model,
        "feature_names": feature_names,
        "label_encoders": label_encoders,
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
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit logistic regression via statsmodels."""

    cleaned_df, y_raw, X, warnings, label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
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
    accuracy = float(accuracy_score(y_eval, y_pred))
    f1 = float(f1_score(y_eval, y_pred, zero_division=0))

    response = {
        "model_type": "logistic",
        "dependent": dependent,
        "independents": independents,
        "coefficients": coefficients,
        "aic": _to_float(model.aic),
        "bic": _to_float(model.bic),
        "accuracy": accuracy,
        "f1": f1,
        "n_observations": int(len(cleaned_df)),
        "n_train": n_train,
        "n_test": n_test,
        "warnings": warnings,
    }

    return {
        "response": response,
        "model_result": model,
        "model_object": model,
        "feature_names": [str(column) for column in X.columns],
        "label_encoders": label_encoders,
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
    interaction_terms: list[list[str]] | None = None,
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
        interaction_terms=interaction_terms,
    )


def fit_lasso(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    alpha: float = 1.0,
    poly_degree: int = 1,
    interaction_terms: list[list[str]] | None = None,
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
        interaction_terms=interaction_terms,
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
    interaction_terms: list[list[str]] | None = None,
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
        interaction_terms=interaction_terms,
    )


def fit_decision_tree(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    poly_degree: int = 1,
    interaction_terms: list[list[str]] | None = None,
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
        interaction_terms=interaction_terms,
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
    interaction_terms: list[list[str]] | None = None,
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
        interaction_terms=interaction_terms,
    )


def fit_decision_tree_classifier(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit Decision Tree classification via scikit-learn."""

    return _fit_tree_classifier(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="decision_tree_classifier",
        estimator=DecisionTreeClassifier(max_depth=max_depth, random_state=42),
        interaction_terms=interaction_terms,
    )


def fit_random_forest_classifier(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    n_estimators: int = 100,
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit Random Forest classification via scikit-learn."""

    return _fit_tree_classifier(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="random_forest_classifier",
        estimator=RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
        ),
        interaction_terms=interaction_terms,
    )


def fit_gradient_boosting_regressor(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    n_estimators: int = 100,
    learning_rate: float = 0.1,
    poly_degree: int = 1,
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit Gradient Boosting regression via scikit-learn."""

    return _fit_tree_regression(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="gradient_boosting",
        estimator=GradientBoostingRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=42,
        ),
        poly_degree=poly_degree,
        interaction_terms=interaction_terms,
    )


def fit_gradient_boosting_classifier(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    train_split: float,
    missing_strategy: str,
    max_depth: int | None = None,
    n_estimators: int = 100,
    learning_rate: float = 0.1,
    interaction_terms: list[list[str]] | None = None,
) -> dict[str, Any]:
    """Fit Gradient Boosting classification via scikit-learn."""

    return _fit_tree_classifier(
        df,
        dependent,
        independents,
        train_split,
        missing_strategy,
        model_type="gradient_boosting_classifier",
        estimator=GradientBoostingClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=42,
        ),
        interaction_terms=interaction_terms,
    )


def compute_vif(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    missing_strategy: str,
    interaction_terms: list[list[str]] | None = None,
    poly_degree: int = 1,
) -> dict[str, Any]:
    """Compute variance inflation factors for a regression design matrix."""

    cleaned_df, _y, X, _warnings, _label_encoders = _prepare_design_matrix(
        df,
        dependent,
        independents,
        missing_strategy,
        interaction_terms,
    )
    X_model, feature_names = _apply_polynomial_features(X, [], poly_degree)
    feature_columns = [str(feature_name) for feature_name in feature_names]

    if len(feature_columns) > 50:
        raise HTTPException(status_code=400, detail="VIF computation limited to 50 features")

    if X_model.shape[1] == 0:
        raise ValueError("No usable independent variables after preprocessing")

    if X_model.shape[1] == 1:
        return {
            "entries": [{"feature": feature_columns[0], "vif": 1.0, "is_high": False}],
            "n_observations": int(len(cleaned_df)),
        }

    matrix = X_model.to_numpy(dtype=float)
    entries = [
        {
            "feature": feature_name,
            "vif": float(variance_inflation_factor(matrix, index)),
            "is_high": float(variance_inflation_factor(matrix, index)) > 10,
        }
        for index, feature_name in enumerate(feature_columns)
    ]
    return {
        "entries": entries,
        "n_observations": int(len(cleaned_df)),
    }


def run_cross_validation(
    df: pd.DataFrame,
    model_type: str,
    dependent: str,
    independents: list[str],
    k: int,
    scoring: str,
    missing_strategy: str,
    alpha: float = 1.0,
    l1_ratio: float = 0.5,
    polynomial_degree: int = 1,
    max_depth: int | None = None,
    n_estimators: int = 100,
    learning_rate: float = 0.1,
) -> dict[str, Any]:
    """Run k-fold cross-validation for the given model configuration."""

    cleaned_df, y_raw, X, warnings, _label_encoders = _prepare_design_matrix(df, dependent, independents, missing_strategy)
    del cleaned_df

    if model_type in CLASSIFIER_TYPES:
        X_model = X
    else:
        X_model, _feature_names = _apply_polynomial_features(X, warnings, polynomial_degree)

    if model_type == "logistic":
        y, _labels = _encode_binary_target(y_raw, warnings)
    elif model_type in CLASSIFIER_TYPES:
        _prepare_binary_classifier_target(y_raw, model_type.replace("_", " ").title())
        y = y_raw
    else:
        _ensure_numeric_target(y_raw, model_type.replace("_", " ").title())
        y = y_raw

    estimator_map = {
        "ols": lambda: LinearRegression(),
        "logistic": lambda: LogisticRegression(max_iter=1000),
        "ridge": lambda: Ridge(alpha=alpha),
        "lasso": lambda: Lasso(alpha=alpha, max_iter=10000),
        "elastic_net": lambda: ElasticNet(alpha=alpha, l1_ratio=l1_ratio, max_iter=10000),
        "decision_tree": lambda: DecisionTreeRegressor(max_depth=max_depth, random_state=42),
        "decision_tree_classifier": lambda: DecisionTreeClassifier(max_depth=max_depth, random_state=42),
        "random_forest": lambda: RandomForestRegressor(
            max_depth=max_depth,
            n_estimators=n_estimators,
            random_state=42,
        ),
        "random_forest_classifier": lambda: RandomForestClassifier(
            max_depth=max_depth,
            n_estimators=n_estimators,
            random_state=42,
        ),
        "gradient_boosting": lambda: GradientBoostingRegressor(
            max_depth=max_depth,
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            random_state=42,
        ),
        "gradient_boosting_classifier": lambda: GradientBoostingClassifier(
            max_depth=max_depth,
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            random_state=42,
        ),
    }

    if model_type not in estimator_map:
        raise ValueError(f"Unsupported model type for CV: {model_type}")

    estimator = estimator_map[model_type]()

    actual_scoring = scoring
    if model_type in CLASSIFIER_TYPES and scoring == "r2":
        actual_scoring = "accuracy"
        warnings.append("Scoring changed to accuracy for classification model")

    scores = cross_val_score(estimator, X_model, y, cv=k, scoring=actual_scoring)

    return {
        "model_type": model_type,
        "k": k,
        "scoring": actual_scoring,
        "fold_scores": [float(score) for score in scores],
        "mean_score": float(scores.mean()),
        "std_score": float(scores.std()),
        "warnings": warnings,
    }


def validate_data_quality(
    df: pd.DataFrame,
    dependent: str,
    independents: list[str],
    model_type: str = "ols",
) -> dict[str, Any]:
    """Check data quality before model fitting."""

    _validate_input_columns(df, dependent, independents)

    warnings_list: list[dict[str, str]] = []
    all_columns = [dependent, *independents]

    for column in all_columns:
        if column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
            if df[column].dropna().nunique() <= 1:
                warnings_list.append(
                    {
                        "column": column,
                        "warning_type": "zero_variance",
                        "message": f"Column '{column}' has zero variance (only one unique value).",
                        "severity": "warning",
                    }
                )

    for column in all_columns:
        if column in df.columns:
            missing_rate = df[column].isna().mean()
            if missing_rate > 0.3:
                warnings_list.append(
                    {
                        "column": column,
                        "warning_type": "high_missing",
                        "message": f"Column '{column}' has {missing_rate:.0%} missing values.",
                        "severity": "warning",
                    }
                )

    if model_type == "logistic" and dependent in df.columns:
        y = df[dependent].dropna()
        if y.nunique() == 2:
            for column in independents:
                if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
                    continue

                valid = df[[dependent, column]].dropna()
                if len(valid) < 2:
                    continue

                grouped_values = [group.to_numpy() for _, group in valid.groupby(dependent)[column]]
                if len(grouped_values) != 2:
                    continue

                first_group, second_group = grouped_values
                if first_group.max() < second_group.min() or second_group.max() < first_group.min():
                    warnings_list.append(
                        {
                            "column": column,
                            "warning_type": "perfect_separation",
                            "message": f"Column '{column}' may cause perfect separation — the two classes have no overlap.",
                            "severity": "warning",
                        }
                    )

    for column in independents:
        if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
            continue

        series = df[column].dropna()
        if len(series) < 10:
            continue

        mean = series.mean()
        std = series.std()
        if std <= 0:
            continue

        outlier_count = int(((series - mean).abs() > 3 * std).sum())
        if outlier_count > 0:
            percentage = outlier_count / len(series)
            warnings_list.append(
                {
                    "column": column,
                    "warning_type": "extreme_outliers",
                    "message": f"Column '{column}' has {outlier_count} extreme outlier(s) ({percentage:.1%} of values beyond ±3σ).",
                    "severity": "info",
                }
            )

    can_proceed = all(warning["warning_type"] != "zero_variance" for warning in warnings_list)

    return {
        "warnings": warnings_list,
        "can_proceed": can_proceed,
    }


def predict_new_observation(
    session: Any,
    values: dict[str, float | int | str],
) -> dict[str, Any]:
    """Predict a single new observation using the latest fitted model."""

    config = session.model_config_dict
    model_type = str(config.get("model_type", ""))
    independents = [str(column) for column in config.get("independents", [])]
    poly_degree = int(config.get("polynomial_degree", 1) or 1)
    interaction_terms = config.get("interaction_terms")
    model = session.fitted_model

    if model is None:
        raise ValueError("No fitted model available")

    _validate_prediction_input_types(values, getattr(session, "predictor_dtypes", None))

    X_model = _prepare_prediction_matrix(
        values,
        independents,
        poly_degree,
        session.feature_names,
        session.label_encoders,
        interaction_terms,
    )

    if model_type == "ols":
        X_input = sm.add_constant(X_model, has_constant="add")
        summary = model.get_prediction(X_input).summary_frame(alpha=0.05)
        interval = (
            float(summary["obs_ci_lower"].iloc[0]),
            float(summary["obs_ci_upper"].iloc[0]),
        )
        return {
            "predicted_value": float(summary["mean"].iloc[0]),
            "prediction_interval": interval,
            "probabilities": None,
        }

    if model_type == "logistic":
        X_input = sm.add_constant(X_model, has_constant="add")
        positive_probability = float(np.asarray(model.predict(X_input)).ravel()[0])
        labels = session.model_predictions.get("labels", ["0", "1"])
        return {
            "predicted_value": float(positive_probability >= 0.5),
            "prediction_interval": None,
            "probabilities": {
                str(labels[0]): float(1.0 - positive_probability),
                str(labels[1]): positive_probability,
            },
        }

    predicted = np.asarray(model.predict(X_model)).ravel()[0]
    probabilities: dict[str, float] | None = None
    class_labels = getattr(model, "classes_", session.model_predictions.get("labels"))
    if model_type in CLASSIFIER_TYPES and hasattr(model, "predict_proba"):
        probability_values = np.asarray(model.predict_proba(X_model))[0]
        probabilities = {
            str(label): float(probability)
            for label, probability in zip(class_labels, probability_values, strict=False)
        }

    return {
        "predicted_value": _prediction_scalar(predicted, list(class_labels) if class_labels is not None else None),
        "prediction_interval": None,
        "probabilities": probabilities,
    }


def run_stepwise_selection(
    df: pd.DataFrame,
    dependent: str,
    candidates: list[str],
    criterion: str = "aic",
    max_steps: int = 50,
) -> dict:
    """Forward stepwise variable selection based on AIC or BIC.

    At each step, the candidate that produces the largest decrease in
    the information criterion is added.  Stops when no candidate improves
    the criterion or *max_steps* is reached.
    """
    all_cols = [dependent] + candidates
    missing = [c for c in all_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {missing}")

    sub = df[all_cols].dropna()
    if sub.empty:
        raise ValueError("No complete cases after dropping missing values.")

    if not pd.api.types.is_numeric_dtype(sub[dependent]):
        raise ValueError("Stepwise selection requires a numeric dependent variable.")

    y = sub[dependent].astype(float)
    remaining = list(candidates)
    selected: list[str] = []
    steps: list[dict] = []

    # Intercept-only baseline
    X_base = sm.add_constant(pd.DataFrame(index=sub.index))
    base_model = sm.OLS(y, X_base).fit()
    best_crit = getattr(base_model, criterion)

    for step_num in range(1, max_steps + 1):
        best_candidate = None
        best_candidate_crit = best_crit

        for cand in remaining:
            trial_vars = selected + [cand]
            X_trial = sm.add_constant(sub[trial_vars].astype(float))
            try:
                trial_model = sm.OLS(y, X_trial).fit()
            except Exception:
                continue
            crit_val = getattr(trial_model, criterion)
            if crit_val < best_candidate_crit:
                best_candidate = cand
                best_candidate_crit = crit_val

        if best_candidate is None:
            break

        selected.append(best_candidate)
        remaining.remove(best_candidate)
        best_crit = best_candidate_crit
        steps.append({
            "step": step_num,
            "variable_added": best_candidate,
            "criterion_value": best_crit,
        })

        if not remaining:
            break

    return {
        "selected_variables": selected,
        "steps": steps,
        "final_criterion": best_crit,
        "criterion": criterion,
        "n_observations": len(sub),
    }

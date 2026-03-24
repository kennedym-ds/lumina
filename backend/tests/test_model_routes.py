"""Tests for regression modeling endpoints."""

import io

import pandas as pd
import pytest

from app.session import store


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("regression.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def _fit_regression(client, dataset_id: str, payload: dict):
    return client.post(f"/api/model/{dataset_id}/regression", json=payload)


def _coefficient_map(coefficients: list[dict]) -> dict[str, float]:
    return {
        row["variable"]: row["coefficient"]
        for row in coefficients
        if row["variable"] != "const"
    }


def test_ols_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "ols"
    assert len(body["coefficients"]) >= 2
    assert body["r_squared"] is not None
    assert body["adj_r_squared"] is not None
    assert body["n_observations"] == 120



def test_logistic_basic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "logistic",
            "dependent": "target",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "logistic"
    assert len(body["coefficients"]) >= 2
    assert body["aic"] is not None
    assert body["accuracy"] is not None
    assert 0.0 <= body["accuracy"] <= 1.0
    assert body["f1"] is not None
    assert 0.0 <= body["f1"] <= 1.0


def test_ridge_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "ridge"
    assert body["r_squared"] is not None
    assert body["rmse"] is not None
    assert body["mae"] is not None
    assert len(body["coefficients"]) >= 3


def test_lasso_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "lasso",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "alpha": 0.05,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "lasso"
    assert body["r_squared"] is not None
    assert body["rmse"] is not None


def test_elastic_net_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "elastic_net",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "alpha": 0.05,
            "l1_ratio": 0.4,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "elastic_net"
    assert body["r_squared"] is not None
    assert body["mae"] is not None


def test_ridge_polynomial_degree_two(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "polynomial_degree": 2,
        },
    )

    assert response.status_code == 200
    body = response.json()
    variables = {row["variable"] for row in body["coefficients"]}
    assert any("^2" in variable for variable in variables)


def test_ridge_high_alpha_shrinks_coefficients(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    low_alpha = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "alpha": 0.01,
        },
    )
    assert low_alpha.status_code == 200

    high_alpha = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "alpha": 1_000_000,
        },
    )
    assert high_alpha.status_code == 200

    low_coefficients = _coefficient_map(low_alpha.json()["coefficients"])
    high_coefficients = _coefficient_map(high_alpha.json()["coefficients"])

    assert max(abs(value) for value in high_coefficients.values()) < max(abs(value) for value in low_coefficients.values())
    assert max(abs(value) for value in high_coefficients.values()) < 0.01



def test_train_test_split(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.7,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["n_train"] is not None
    assert body["n_test"] is not None
    assert body["n_train"] + body["n_test"] == body["n_observations"]


def test_rmse_and_mae_present_for_ols_and_ridge(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    ols_response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )
    assert ols_response.status_code == 200

    ridge_response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )
    assert ridge_response.status_code == 200

    for response in (ols_response, ridge_response):
        body = response.json()
        assert body["rmse"] is not None
        assert body["mae"] is not None
        assert body["rmse"] >= 0
        assert body["mae"] >= 0



def test_missing_check(client, missing_csv_bytes):
    dataset_id = _upload_csv(client, missing_csv_bytes)

    response = client.post(
        f"/api/model/{dataset_id}/check-missing",
        json={"dependent": "y", "independents": ["x1", "x2"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["has_missing"] is True
    assert body["total_rows_affected"] > 0
    names = {item["name"] for item in body["columns_with_missing"]}
    assert "x1" in names



def test_missing_listwise(client, missing_csv_bytes):
    dataset_id = _upload_csv(client, missing_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "missing_strategy": "listwise",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["n_observations"] < 8
    assert any("Dropped" in warning for warning in body["warnings"])



def test_missing_mean_imputation(client, missing_csv_bytes):
    dataset_id = _upload_csv(client, missing_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "missing_strategy": "mean_imputation",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["n_observations"] == 8
    assert any("Imputed" in warning for warning in body["warnings"])



def test_diagnostics_ols(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/diagnostics")
    assert response.status_code == 200
    body = response.json()
    assert len(body["residuals_vs_fitted"]["data"]) > 0
    assert len(body["qq_plot"]["data"]) > 0



def test_confusion_matrix_logistic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "logistic",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/confusion")
    assert response.status_code == 200
    body = response.json()
    assert len(body["matrix"]) == 2
    assert len(body["matrix"][0]) == 2
    assert 0.0 <= body["accuracy"] <= 1.0
    assert len(body["heatmap_figure"]["data"]) > 0



def test_roc_logistic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "logistic",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/roc")
    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["auc"] <= 1.0
    assert len(body["roc_figure"]["data"]) > 0


def test_classifier_confusion_matrix(client, logistic_csv_bytes):
    """Verify confusion matrix works for all classifier types."""

    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/confusion")
    assert response.status_code == 200
    body = response.json()
    assert "matrix" in body
    assert body["accuracy"] > 0


def test_classifier_roc(client, logistic_csv_bytes):
    """Verify ROC works for all classifier types that produce probabilities."""

    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
            "n_estimators": 50,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/roc")
    assert response.status_code == 200
    body = response.json()
    assert body["auc"] > 0


def test_gradient_boosting_classifier_roc(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
            "n_estimators": 50,
            "learning_rate": 0.1,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/roc")
    assert response.status_code == 200



def test_singular_matrix_error(client, collinear_csv_bytes):
    dataset_id = _upload_csv(client, collinear_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["col_a", "col_b"],
        },
    )

    assert response.status_code == 422
    assert "collinear" in response.json()["detail"].lower()



def test_invalid_model_type(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "bogus",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 400


def test_polynomial_degree_bounds(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    supported_response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1"],
            "polynomial_degree": 5,
        },
    )
    assert supported_response.status_code == 200

    too_low = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1"],
            "polynomial_degree": 0,
        },
    )
    too_high = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1"],
            "polynomial_degree": 6,
        },
    )

    assert too_low.status_code == 422
    assert too_high.status_code == 422



def test_missing_dataset(client):
    response = _fit_regression(
        client,
        "missing-dataset-id",
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 404


def test_excluded_column_cannot_be_used_for_regression(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    config_response = client.post(
        f"/api/data/{dataset_id}/column-config",
        json={"columns": [{"name": "x1", "excluded": True}]},
    )
    assert config_response.status_code == 200

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_decision_tree_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "decision_tree"
    assert body["r_squared"] is not None
    assert body["rmse"] is not None
    assert body["mae"] is not None
    assert body["feature_importances"] is not None
    assert len(body["feature_importances"]) == 2


def test_random_forest_basic_returns_feature_importances(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "random_forest"
    assert body["feature_importances"] is not None
    assert len(body["feature_importances"]) == 2


def test_decision_tree_classifier_basic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "decision_tree_classifier"
    assert body["feature_importances"] is not None
    assert len(body["feature_importances"]) >= 2
    assert body["accuracy"] is not None
    assert 0.0 <= body["accuracy"] <= 1.0
    assert body["f1"] is not None
    assert 0.0 <= body["f1"] <= 1.0


def test_random_forest_classifier_basic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "random_forest_classifier"
    assert body["feature_importances"] is not None
    assert body["accuracy"] is not None
    assert 0.0 <= body["accuracy"] <= 1.0
    assert body["f1"] is not None
    assert 0.0 <= body["f1"] <= 1.0


def test_gradient_boosting_regressor_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
            "learning_rate": 0.1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "gradient_boosting"
    assert body["r_squared"] is not None
    assert body["rmse"] is not None
    assert body["feature_importances"] is not None


def test_gradient_boosting_classifier_basic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
            "learning_rate": 0.1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "gradient_boosting_classifier"
    assert body["feature_importances"] is not None
    assert body["accuracy"] is not None
    assert 0.0 <= body["accuracy"] <= 1.0
    assert body["f1"] is not None
    assert 0.0 <= body["f1"] <= 1.0


def test_decision_tree_max_depth_is_respected(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "max_depth": 2,
        },
    )

    assert response.status_code == 200
    session = store.get(dataset_id)
    assert session is not None
    assert session.model_result.get_depth() <= 2


def test_random_forest_n_estimators_parameter_is_applied(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "n_estimators": 7,
        },
    )

    assert response.status_code == 200
    session = store.get(dataset_id)
    assert session is not None
    assert len(session.model_result.estimators_) == 7


def test_model_comparison_endpoint_returns_history(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    first_fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert first_fit.status_code == 200

    second_fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "n_estimators": 9,
        },
    )
    assert second_fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/comparison")

    assert response.status_code == 200
    body = response.json()
    assert [entry["model_type"] for entry in body["models"]] == ["ridge", "random_forest"]
    assert body["models"][0]["model_id"] == first_fit.json()["model_id"]
    assert body["models"][1]["model_id"] == second_fit.json()["model_id"]


def test_model_comparison_includes_classifiers(client, logistic_csv_bytes):
    """Verify model comparison returns accuracy/f1 for classifier types."""

    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "train_test_split": 0.8,
            "n_estimators": 50,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/comparison")
    assert response.status_code == 200
    body = response.json()
    assert len(body["models"]) >= 1
    entry = body["models"][-1]
    assert entry["accuracy"] is not None
    assert entry["f1"] is not None


def test_model_comparison_endpoint_returns_empty_history_before_fit(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = client.get(f"/api/model/{dataset_id}/comparison")

    assert response.status_code == 200
    assert response.json() == {"models": []}


def test_tree_model_feature_importances_sum_to_one(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 200
    feature_importances = response.json()["feature_importances"]
    assert feature_importances is not None
    assert sum(item["importance"] for item in feature_importances) == pytest.approx(1.0, abs=1e-6)


def test_rmse_and_mae_present_for_tree_models(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    decision_tree_response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )
    assert decision_tree_response.status_code == 200

    random_forest_response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "train_test_split": 0.75,
        },
    )
    assert random_forest_response.status_code == 200

    for response in (decision_tree_response, random_forest_response):
        body = response.json()
        assert body["rmse"] is not None
        assert body["mae"] is not None
        assert body["rmse"] >= 0
        assert body["mae"] >= 0


# --- Cross-validation tests ---


def test_cross_validate_ols(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 5,
            "scoring": "r2",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "ols"
    assert body["k"] == 5
    assert len(body["fold_scores"]) == 5
    assert body["mean_score"] > 0.5
    assert body["std_score"] >= 0


def test_cross_validate_ridge(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 3,
            "scoring": "r2",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["fold_scores"]) == 3


def test_cross_validate_lasso(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "lasso",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 5,
            "scoring": "r2",
            "alpha": 0.05,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "lasso"
    assert len(body["fold_scores"]) == 5


def test_cross_validate_elastic_net(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "elastic_net",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 4,
            "scoring": "r2",
            "alpha": 0.05,
            "l1_ratio": 0.4,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "elastic_net"
    assert len(body["fold_scores"]) == 4


def test_cross_validate_logistic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "logistic",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "k": 5,
            "scoring": "r2",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["scoring"] == "accuracy"
    assert any("accuracy" in warning.lower() for warning in body["warnings"])


def test_cross_validate_decision_tree(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 3,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "decision_tree"
    assert len(body["fold_scores"]) == 3


def test_cross_validate_random_forest(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "random_forest",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 3,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["fold_scores"]) == 3


def test_cross_validate_gradient_boosting(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "gradient_boosting",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 3,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["fold_scores"]) == 3


def test_cross_validate_gradient_boosting_uses_requested_learning_rate(client, regression_csv_bytes, monkeypatch):
    import numpy as np

    from app.services import regression as regression_service

    dataset_id = _upload_csv(client, regression_csv_bytes)
    observed: dict[str, float] = {}

    def fake_cross_val_score(estimator, X_model, y, cv, scoring):
        del X_model, y, scoring
        observed["learning_rate"] = estimator.learning_rate
        return np.array([0.81] * cv)

    monkeypatch.setattr(regression_service, "cross_val_score", fake_cross_val_score)

    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "gradient_boosting",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 3,
            "learning_rate": 0.05,
        },
    )

    assert response.status_code == 200
    assert observed["learning_rate"] == pytest.approx(0.05)


def test_cross_validate_gb_classifier(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "gradient_boosting_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "k": 3,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["scoring"] == "accuracy"


def test_cross_validate_invalid_k(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "k": 1,
        },
    )
    assert response.status_code == 422


def test_cross_validate_unsupported_model(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/cross-validate",
        json={
            "model_type": "xgboost",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert response.status_code == 400


# --- Data validation tests ---


def test_validate_data_basic(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["can_proceed"] is True
    assert isinstance(body["warnings"], list)


def test_validate_data_zero_variance(client):
    df = pytest.importorskip("pandas").DataFrame(
        {
            "y": [1.0, 2.0, 3.0, 4.0],
            "x1": [5.0, 5.0, 5.0, 5.0],
            "x2": [1.0, 2.0, 3.0, 4.0],
        }
    )
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={"dependent": "y", "independents": ["x1", "x2"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["can_proceed"] is False
    zero_var = [warning for warning in body["warnings"] if warning["warning_type"] == "zero_variance"]
    assert len(zero_var) == 1
    assert zero_var[0]["column"] == "x1"


def test_validate_data_perfect_separation(client):
    df = pytest.importorskip("pandas").DataFrame(
        {"target": [0, 0, 0, 0, 1, 1, 1, 1], "x1": [1, 2, 3, 4, 10, 11, 12, 13]}
    )
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={"dependent": "target", "independents": ["x1"], "model_type": "logistic"},
    )
    assert response.status_code == 200
    body = response.json()
    separation = [warning for warning in body["warnings"] if warning["warning_type"] == "perfect_separation"]
    assert len(separation) == 1


def test_validate_data_high_missing(client):
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(99)
    n = 100
    y = rng.normal(0, 1, n)
    x1 = rng.normal(0, 1, n).astype(object)
    x1[:40] = np.nan
    x2 = rng.normal(0, 1, n)
    df = pd.DataFrame({"y": y, "x1": x1, "x2": x2})
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={"dependent": "y", "independents": ["x1", "x2"]},
    )
    assert response.status_code == 200
    body = response.json()
    high_miss = [warning for warning in body["warnings"] if warning["warning_type"] == "high_missing"]
    assert len(high_miss) >= 1
    assert high_miss[0]["column"] == "x1"


def test_validate_data_extreme_outliers(client):
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(42)
    n = 200
    y = rng.normal(0, 1, n)
    x1 = rng.normal(0, 1, n)
    x1[0] = 100.0
    x1[1] = -100.0
    df = pd.DataFrame({"y": y, "x1": x1})
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={"dependent": "y", "independents": ["x1"]},
    )
    assert response.status_code == 200
    body = response.json()
    outlier_warnings = [warning for warning in body["warnings"] if warning["warning_type"] == "extreme_outliers"]
    assert len(outlier_warnings) >= 1
    assert outlier_warnings[0]["column"] == "x1"


def test_validate_data_missing_column(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    response = client.post(
        f"/api/model/{dataset_id}/validate",
        json={"dependent": "y", "independents": ["nonexistent"]},
    )
    assert response.status_code == 400


def test_predict_ols(client, regression_csv_bytes):
    """OLS prediction returns a point estimate and prediction interval."""

    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 1.0, "x2": 2.0}},
    )

    assert response.status_code == 200
    body = response.json()
    assert "predicted_value" in body
    assert body["prediction_interval"] is not None
    assert len(body["prediction_interval"]) == 2


def test_predict_invalid_numeric_input(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    _fit_regression(client, dataset_id, {"model_type": "ols", "dependent": "y", "independents": ["x1", "x2"]})

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": "not_a_number", "x2": 2.0}},
    )

    assert response.status_code == 400


def test_predict_ridge(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 1.25, "x2": 0.75}},
    )

    assert response.status_code == 200
    assert "predicted_value" in response.json()


def test_predict_lasso(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "lasso",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "alpha": 0.05,
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 0.75, "x2": 1.25}},
    )

    assert response.status_code == 200
    assert "predicted_value" in response.json()


def test_predict_decision_tree(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 1.1, "x2": -0.2}},
    )

    assert response.status_code == 200
    assert "predicted_value" in response.json()


def test_predict_classifier(client, logistic_csv_bytes):
    """Classifier prediction returns probabilities."""

    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "random_forest_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 0.5, "x2": -0.3}},
    )

    assert response.status_code == 200
    body = response.json()
    assert "predicted_value" in body
    assert body["probabilities"] is not None


def test_predict_logistic(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "logistic",
            "dependent": "target",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 0.2, "x2": -0.4}},
    )

    assert response.status_code == 200
    body = response.json()
    assert "predicted_value" in body
    assert body["probabilities"] is not None


def test_predict_no_model(client, regression_csv_bytes):
    """Predict without fitting returns 400."""

    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 1.0}},
    )

    assert response.status_code == 400


def test_predict_gradient_boosting(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 1.5, "x2": 0.5}},
    )

    assert response.status_code == 200
    assert "predicted_value" in response.json()


def test_predict_gradient_boosting_classifier(client, logistic_csv_bytes):
    dataset_id = _upload_csv(client, logistic_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting_classifier",
            "dependent": "target",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
            "learning_rate": 0.1,
        },
    )
    assert fit.status_code == 200

    response = client.post(
        f"/api/model/{dataset_id}/predict",
        json={"values": {"x1": 0.4, "x2": 0.3}},
    )

    assert response.status_code == 200
    body = response.json()
    assert "predicted_value" in body
    assert body["probabilities"] is not None


def test_extended_diagnostics_tree(client, regression_csv_bytes):
    """Tree models return feature importances."""

    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "decision_tree",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/extended-diagnostics")

    assert response.status_code == 200
    body = response.json()
    assert body["feature_importances"] is not None
    assert len(body["feature_importances"]) >= 2


def test_extended_diagnostics_ridge_coef_path(client, regression_csv_bytes):
    """Ridge returns coefficient paths across alpha values."""

    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/extended-diagnostics")

    assert response.status_code == 200
    body = response.json()
    assert body["coefficient_path"] is not None
    assert len(body["coefficient_path"]["alphas"]) > 0


def test_extended_diagnostics_partial_dependence(client, regression_csv_bytes):
    """Gradient boosting returns partial dependence data."""

    dataset_id = _upload_csv(client, regression_csv_bytes)
    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "gradient_boosting",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "n_estimators": 50,
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/extended-diagnostics")

    assert response.status_code == 200
    body = response.json()
    assert body["partial_dependence"] is not None
    assert len(body["partial_dependence"]) >= 1


def test_extended_diagnostics_no_model(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = client.get(f"/api/model/{dataset_id}/extended-diagnostics")

    assert response.status_code == 400


def test_vif_endpoint_returns_entries_after_fit(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/vif")

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 2
    features = {entry["feature"] for entry in body["entries"]}
    assert features == {"x1", "x2"}
    assert all(entry["vif"] > 0 for entry in body["entries"])
    assert all(isinstance(entry["is_high"], bool) for entry in body["entries"])


def test_vif_endpoint_flags_high_multicollinearity(client):
    dataframe = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6],
            "x2": [2.0, 4.01, 6.02, 8.03, 10.04, 12.05],
            "y": [3, 5, 7, 9, 11, 13],
        }
    )
    buffer = io.BytesIO()
    dataframe.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/vif")

    assert response.status_code == 200
    entries = {entry["feature"]: entry for entry in response.json()["entries"]}
    assert entries["x1"]["is_high"] is True
    assert entries["x2"]["is_high"] is True
    assert entries["x1"]["vif"] > 10
    assert entries["x2"]["vif"] > 10


def test_vif_endpoint_requires_a_fitted_model(client, regression_csv_bytes):
    dataset_id = _upload_csv(client, regression_csv_bytes)

    response = client.get(f"/api/model/{dataset_id}/vif")

    assert response.status_code == 400
    assert "no fitted model" in response.json()["detail"].lower()


def test_vif_endpoint_limits_feature_count_to_50(client):
    row_count = 80
    dataframe = pd.DataFrame(
        {
            **{f"x{i}": [row + i for row in range(row_count)] for i in range(51)},
            "y": [row * 2 for row in range(row_count)],
        }
    )
    buffer = io.BytesIO()
    dataframe.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    fit = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ridge",
            "dependent": "y",
            "independents": [f"x{i}" for i in range(51)],
        },
    )
    assert fit.status_code == 200

    response = client.get(f"/api/model/{dataset_id}/vif")

    assert response.status_code == 400
    assert response.json()["detail"] == "VIF computation limited to 50 features"


def test_ols_supports_interaction_terms(client):
    dataframe = pd.DataFrame(
        {
            "x1": [0, 0, 1, 1, 2, 2, 3, 3],
            "x2": [0, 1, 0, 1, 0, 1, 0, 1],
        }
    )
    dataframe["y"] = 1.0 + 2.0 * dataframe["x1"] + 3.0 * dataframe["x2"] + 4.0 * dataframe["x1"] * dataframe["x2"]

    buffer = io.BytesIO()
    dataframe.to_csv(buffer, index=False)
    dataset_id = _upload_csv(client, buffer.getvalue())

    response = _fit_regression(
        client,
        dataset_id,
        {
            "model_type": "ols",
            "dependent": "y",
            "independents": ["x1", "x2"],
            "interaction_terms": [["x1", "x2"]],
        },
    )

    assert response.status_code == 200
    coefficients = {row["variable"]: row["coefficient"] for row in response.json()["coefficients"]}
    assert "x1:x2" in coefficients
    assert coefficients["x1:x2"] == pytest.approx(4.0, abs=1e-6)

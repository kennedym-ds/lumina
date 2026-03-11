"""Tests for regression modeling endpoints."""

import io

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

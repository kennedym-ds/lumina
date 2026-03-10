"""Tests for regression modeling endpoints."""

import io


def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("regression.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]


def _fit_regression(client, dataset_id: str, payload: dict):
    return client.post(f"/api/model/{dataset_id}/regression", json=payload)


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
            "model_type": "ridge",
            "dependent": "y",
            "independents": ["x1", "x2"],
        },
    )

    assert response.status_code == 400



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

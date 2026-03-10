"""Tests for bundled sample dataset endpoints."""


def test_list_samples(client):
    response = client.get("/api/data/samples")
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 3

    names = {item["name"] for item in payload}
    assert names == {"palmer_penguins", "iris", "titanic"}


def test_load_sample_penguins(client):
    response = client.post("/api/data/samples/palmer_penguins")
    assert response.status_code == 200

    payload = response.json()
    assert payload["file_name"] == "palmer_penguins.csv"
    assert payload["file_format"] == "csv"
    assert payload["row_count"] >= 50

    column_names = {column["name"] for column in payload["columns"]}
    assert "species" in column_names
    assert "bill_length_mm" in column_names


def test_load_sample_iris(client):
    response = client.post("/api/data/samples/iris")
    assert response.status_code == 200

    payload = response.json()
    column_names = {column["name"] for column in payload["columns"]}
    assert "species" in column_names
    assert payload["row_count"] >= 100


def test_load_sample_not_found(client):
    response = client.post("/api/data/samples/nonexistent")
    assert response.status_code == 404

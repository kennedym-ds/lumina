"""Tests for saved views CRUD endpoints."""

import io



def _upload_csv(client, csv_bytes: bytes) -> str:
    response = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert response.status_code == 200
    return response.json()["dataset_id"]



def test_create_view(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.post(
        f"/api/views/{dataset_id}",
        json={
            "name": "My View",
            "charts": [{"chart_id": "c1", "chart_type": "scatter", "x": "id", "y": "value"}],
            "cross_filter": {"column": "category", "values": ["A"]},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["view_id"]
    assert payload["name"] == "My View"
    assert isinstance(payload["charts"], list)



def test_list_views(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    for index in range(2):
        create = client.post(
            f"/api/views/{dataset_id}",
            json={"name": f"View {index + 1}", "charts": [{"chart_id": f"c{index + 1}"}], "cross_filter": None},
        )
        assert create.status_code == 200

    response = client.get(f"/api/views/{dataset_id}")
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 2



def test_get_view(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    created = client.post(
        f"/api/views/{dataset_id}",
        json={"name": "Saved", "charts": [{"chart_id": "c1"}], "cross_filter": None},
    )
    assert created.status_code == 200
    view_id = created.json()["view_id"]

    response = client.get(f"/api/views/{dataset_id}/{view_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["view_id"] == view_id



def test_rename_view(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    created = client.post(
        f"/api/views/{dataset_id}",
        json={"name": "Old Name", "charts": [{"chart_id": "c1"}], "cross_filter": None},
    )
    assert created.status_code == 200
    view_id = created.json()["view_id"]

    response = client.put(
        f"/api/views/{dataset_id}/{view_id}",
        json={"name": "New Name"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"



def test_delete_view(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    created = client.post(
        f"/api/views/{dataset_id}",
        json={"name": "To Delete", "charts": [{"chart_id": "c1"}], "cross_filter": None},
    )
    assert created.status_code == 200
    view_id = created.json()["view_id"]

    deleted = client.delete(f"/api/views/{dataset_id}/{view_id}")
    assert deleted.status_code == 200

    listed = client.get(f"/api/views/{dataset_id}")
    assert listed.status_code == 200
    assert listed.json() == []



def test_view_not_found(client, sample_csv_bytes):
    dataset_id = _upload_csv(client, sample_csv_bytes)

    response = client.get(f"/api/views/{dataset_id}/nonexistent")
    assert response.status_code == 404

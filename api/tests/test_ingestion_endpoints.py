"""
Tests for /ingestion/* endpoints.

Uses:
- SQLite test DB (configured in conftest.py)
- Mocked MinIO client via FastAPI dependency_overrides
- TestClient from FastAPI
"""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _signup_and_get_token(client: TestClient, email: str = "user@test.com") -> str:
    """Sign up a user and return an access token."""
    resp = client.post(
        "/auth/signup",
        json={"email": email, "password": "password123"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["accessToken"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _mock_minio():
    """Return a MagicMock that behaves like a minio.Minio client."""
    mock = MagicMock()
    mock.put_object.return_value = None
    mock.remove_object.return_value = None
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_mock_minio(client: TestClient) -> TestClient:
    """TestClient with mocked MinIO dependency."""
    from app.main import app
    from app.api.ingestion import get_minio_client

    mock = _mock_minio()
    app.dependency_overrides[get_minio_client] = lambda: mock
    yield client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth guard tests
# ---------------------------------------------------------------------------


def test_upload_requires_bearer_token(client):
    """POST /ingestion/upload without Bearer returns 401."""
    resp = client.post(
        "/ingestion/upload", files={"file": ("test.csv", b"data,col\n1,2\n")}
    )
    assert resp.status_code == 401


def test_list_uploads_requires_bearer_token(client):
    """GET /ingestion/uploads without Bearer returns 401."""
    resp = client.get("/ingestion/uploads")
    assert resp.status_code == 401


def test_get_upload_requires_bearer_token(client):
    """GET /ingestion/uploads/{id} without Bearer returns 401."""
    resp = client.get("/ingestion/uploads/some-id")
    assert resp.status_code == 401


def test_confirm_requires_bearer_token(client):
    """POST /ingestion/uploads/{id}/confirm without Bearer returns 401."""
    resp = client.post("/ingestion/uploads/some-id/confirm")
    assert resp.status_code == 401


def test_delete_requires_bearer_token(client):
    """DELETE /ingestion/uploads/{id} without Bearer returns 401."""
    resp = client.delete("/ingestion/uploads/some-id")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Upload endpoint tests
# ---------------------------------------------------------------------------


def test_upload_returns_202_with_upload_id(client_with_mock_minio):
    """POST /ingestion/upload with valid token and small CSV returns 202 with upload_id."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    resp = client.post(
        "/ingestion/upload",
        files={
            "file": (
                "test.csv",
                b"date,amount,description\n2024-01-01,100,Coffee\n",
                "text/csv",
            )
        },
        headers=_auth_headers(token),
    )

    assert resp.status_code == 202, resp.text
    payload = resp.json()
    assert "upload_id" in payload
    assert payload["status"] == "pending"


def test_upload_rejects_oversized_file(client_with_mock_minio):
    """POST /ingestion/upload with file > 20 MB returns 413."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    big_bytes = b"x" * (21 * 1024 * 1024)  # 21 MB

    resp = client.post(
        "/ingestion/upload",
        files={"file": ("huge.csv", big_bytes, "text/csv")},
        headers=_auth_headers(token),
    )

    assert resp.status_code == 413


# ---------------------------------------------------------------------------
# List uploads tests
# ---------------------------------------------------------------------------


def test_list_uploads_returns_empty_list_initially(client_with_mock_minio):
    """GET /ingestion/uploads with valid token returns empty list initially."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    resp = client.get("/ingestion/uploads", headers=_auth_headers(token))

    assert resp.status_code == 200
    assert resp.json() == []


def test_list_uploads_returns_own_uploads_only(client_with_mock_minio):
    """GET /ingestion/uploads returns only uploads for the current user."""
    client = client_with_mock_minio
    token_a = _signup_and_get_token(client, "a@test.com")
    token_b = _signup_and_get_token(client, "b@test.com")

    # User A uploads a file
    upload_resp = client.post(
        "/ingestion/upload",
        files={"file": ("a.csv", b"col\n1\n", "text/csv")},
        headers=_auth_headers(token_a),
    )
    assert upload_resp.status_code == 202

    # User B's list should be empty
    list_resp = client.get("/ingestion/uploads", headers=_auth_headers(token_b))

    assert list_resp.status_code == 200
    assert list_resp.json() == []


# ---------------------------------------------------------------------------
# Get upload tests
# ---------------------------------------------------------------------------


def test_get_upload_nonexistent_returns_404(client_with_mock_minio):
    """GET /ingestion/uploads/{bad_id} with valid token returns 404."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    resp = client.get(
        "/ingestion/uploads/nonexistent-id-123",
        headers=_auth_headers(token),
    )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Confirm endpoint tests
# ---------------------------------------------------------------------------


def test_confirm_pending_upload_returns_400(client_with_mock_minio):
    """POST /ingestion/uploads/{id}/confirm on pending upload returns 400."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    # Upload a file (creates pending upload)
    upload_resp = client.post(
        "/ingestion/upload",
        files={"file": ("test.csv", b"date,amount\n2024-01-01,50\n", "text/csv")},
        headers=_auth_headers(token),
    )
    assert upload_resp.status_code == 202
    upload_id = upload_resp.json()["upload_id"]

    # Confirm while still pending → should fail
    confirm_resp = client.post(
        f"/ingestion/uploads/{upload_id}/confirm",
        headers=_auth_headers(token),
    )

    assert confirm_resp.status_code == 400
    payload = confirm_resp.json()
    assert payload["detail"]["code"] == "cannot_confirm"


def test_confirm_nonexistent_upload_returns_404(client_with_mock_minio):
    """POST /ingestion/uploads/{bad_id}/confirm returns 404."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    resp = client.post(
        "/ingestion/uploads/does-not-exist/confirm",
        headers=_auth_headers(token),
    )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Report endpoint tests
# ---------------------------------------------------------------------------


def test_report_creates_report_record(client_with_mock_minio):
    """POST /ingestion/uploads/{id}/report creates a report and returns 201."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    upload_resp = client.post(
        "/ingestion/upload",
        files={"file": ("test.csv", b"date,amount\n2024-01-01,50\n", "text/csv")},
        headers=_auth_headers(token),
    )
    upload_id = upload_resp.json()["upload_id"]

    report_resp = client.post(
        f"/ingestion/uploads/{upload_id}/report",
        json={"note": "This looks wrong"},
        headers=_auth_headers(token),
    )

    assert report_resp.status_code == 201
    assert report_resp.json()["reported"] is True


# ---------------------------------------------------------------------------
# Delete endpoint tests
# ---------------------------------------------------------------------------


def test_delete_upload_returns_204(client_with_mock_minio):
    """DELETE /ingestion/uploads/{id} removes the upload and returns 204."""
    client = client_with_mock_minio
    token = _signup_and_get_token(client)

    upload_resp = client.post(
        "/ingestion/upload",
        files={"file": ("del.csv", b"col\n1\n", "text/csv")},
        headers=_auth_headers(token),
    )
    upload_id = upload_resp.json()["upload_id"]

    del_resp = client.delete(
        f"/ingestion/uploads/{upload_id}",
        headers=_auth_headers(token),
    )

    assert del_resp.status_code == 204


def test_confirm_all_without_token_returns_401(client):
    resp = client.post("/ingestion/confirm-all")
    assert resp.status_code == 401


def test_confirm_all_with_no_uploads_returns_zero_confirmed(client):
    resp = client.post(
        "/auth/signup", json={"email": "ca@ex.com", "password": "Test1234!"}
    )
    token = resp.json()["accessToken"]

    resp = client.post(
        "/ingestion/confirm-all", headers={"authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["confirmed_count"] == 0
    assert data["categorization_status"] == "queued"


def test_confirm_all_queues_categorization_job(client):
    resp = client.post(
        "/auth/signup", json={"email": "caj@ex.com", "password": "Test1234!"}
    )
    token = resp.json()["accessToken"]

    # Trigger confirm-all
    client.post("/ingestion/confirm-all", headers={"authorization": f"Bearer {token}"})

    # Check that profile/status shows queued (background job may have already run in test)
    resp = client.get("/profile/status", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["status"] in (
        "queued",
        "complete",
        "categorizing",
        "generating_insights",
    )

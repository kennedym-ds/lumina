"""Non-functional requirement guardrail tests."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware

from app.main import create_app


EXPECTED_CORS_ORIGINS = {
    "http://localhost:1420",
    "tauri://localhost",
    "https://tauri.localhost",
}


def test_main_binds_to_loopback_only() -> None:
    """Ensure backend startup host remains bound to localhost only."""

    main_py = Path(__file__).resolve().parents[1] / "app" / "main.py"
    source = main_py.read_text(encoding="utf-8")

    assert re.search(r"host\s*=\s*['\"]127\.0\.0\.1['\"]", source)
    assert not re.search(r"host\s*=\s*['\"]0\.0\.0\.0['\"]", source)


def test_health_endpoint_returns_expected_shape_and_version(client) -> None:
    """Health endpoint should expose stable shape and release version."""

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "1.0.0"}


def test_cors_origins_are_restricted_to_expected_values() -> None:
    """CORS allowlist should include only intended desktop dev origins."""

    app = create_app()
    cors_middleware = next((item for item in app.user_middleware if item.cls is CORSMiddleware), None)

    assert cors_middleware is not None
    assert set(cors_middleware.kwargs["allow_origins"]) == EXPECTED_CORS_ORIGINS

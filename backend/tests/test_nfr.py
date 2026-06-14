"""Non-functional requirement guardrail tests."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware

from app.main import create_app


# Origins the webview/dev server legitimately use and must be allowed. Windows
# WebView2 serves from http://tauri.localhost (this exact origin was previously
# missing and CORS-blocked every request).
ALLOWED_CORS_ORIGINS = {
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
    "http://127.0.0.1:8089",
}
REJECTED_CORS_ORIGINS = {"https://evil.example.com", "http://example.org"}


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
    assert response.json() == {"status": "ok", "version": "2.2.4"}


def test_cors_origins_are_restricted_to_expected_values() -> None:
    """CORS regex should allow the local webview/dev origins and reject others."""

    app = create_app()
    cors_middleware = next((item for item in app.user_middleware if item.cls is CORSMiddleware), None)

    assert cors_middleware is not None
    pattern = re.compile(cors_middleware.kwargs["allow_origin_regex"])
    for origin in ALLOWED_CORS_ORIGINS:
        assert pattern.fullmatch(origin), f"{origin} should be allowed"
    for origin in REJECTED_CORS_ORIGINS:
        assert not pattern.fullmatch(origin), f"{origin} should be rejected"

"""Lumina backend — FastAPI application entry point."""

import argparse
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware.auth import BearerTokenMiddleware


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Lumina Backend",
        version="0.0.0",
        docs_url="/api/docs" if settings.debug else None,
        redoc_url=None,
    )

    # CORS — only allow the Tauri webview origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:1420", "tauri://localhost", "https://tauri.localhost"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Bearer token auth
    if settings.token:
        app.add_middleware(BearerTokenMiddleware, token=settings.token)

    # Health endpoint (no auth required — handled before middleware)
    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "0.0.0"}

    return app


app = create_app()


def main() -> None:
    """Entry point for running the backend directly or via PyInstaller."""
    parser = argparse.ArgumentParser(description="Lumina Backend")
    parser.add_argument("--port", type=int, default=8089, help="Port to listen on")
    parser.add_argument("--token", type=str, default="", help="Bearer token for auth")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    # Update settings from CLI args
    settings.port = args.port
    settings.token = args.token
    settings.debug = args.debug

    # Recreate app with updated settings
    global app
    app = create_app()

    print(f"[lumina-backend] Starting on 127.0.0.1:{settings.port}")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=settings.port,
        log_level="info" if settings.debug else "warning",
    )


if __name__ == "__main__":
    main()
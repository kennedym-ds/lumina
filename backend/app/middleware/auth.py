"""Bearer token authentication middleware."""

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class BearerTokenMiddleware(BaseHTTPMiddleware):
    """Validates Bearer token on all requests except health check."""

    def __init__(self, app, token: str):
        super().__init__(app)
        self.token = token

    async def dispatch(self, request: Request, call_next):
        # Skip auth for health endpoint and docs
        if request.url.path in ("/api/health", "/api/docs", "/api/openapi.json"):
            return await call_next(request)

        # Validate bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "UNAUTHORIZED", "detail": "Missing bearer token"},
            )

        provided_token = auth_header[7:]  # Strip "Bearer " prefix
        if not hmac.compare_digest(provided_token, self.token):
            return JSONResponse(
                status_code=401,
                content={"error": "UNAUTHORIZED", "detail": "Invalid bearer token"},
            )

        return await call_next(request)
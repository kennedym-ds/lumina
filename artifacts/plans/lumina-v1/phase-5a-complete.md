# Phase 5A Complete: Backend Persistence & Export

**Completed**: 2026-03-10
**Implementer**: GitHub Copilot (GPT-5.3-Codex)

## Changes Made

| File | Change Type | Description |
| ---- | ----------- | ----------- |
| `backend/tests/test_project_routes.py` | Added | TDD coverage for project save/load flows, missing-file handling, roundtrip state hydration, and export route behaviors (PNG/SVG/invalid format). |
| `backend/tests/test_export.py` | Added | Service-level tests validating PNG magic bytes and SVG payload generation from Plotly figure dicts. |
| `backend/app/models/project.py` | Added | Pydantic schemas for `.lumina` persistence payloads and export requests/responses (`ProjectSchema`, `SaveRequest`, `LoadResponse`, etc.). |
| `backend/app/services/project.py` | Added | `.lumina` save/load utilities with atomic write pattern (temp + replace) and data-file existence validation helper. |
| `backend/app/services/export.py` | Added | Plotly-based image rendering service for PNG/SVG bytes via Kaleido-backed `to_image`. |
| `backend/app/routers/project.py` | Added | New `/api/project` router with `save`, `load`, and `export` endpoints, path validation, image size bounds, and missing-file 404 payload including `missing_file`. |
| `backend/app/services/ingestion.py` | Updated | Added generic `load_file(file_bytes, filename, sheet_name)` for reload-from-disk flow and improved typing-safe datetime/sheet handling. |
| `backend/app/main.py` | Updated | Registered project router in the FastAPI app factory. |
| `backend/requirements.txt` | Updated | Added `plotly>=5.24.1` and `kaleido>=0.2.1` for server-side export support. |

## Test Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `.\.venv\Scripts\python.exe -m pytest tests/test_project_routes.py tests/test_export.py -q` (pre-impl) | ❌ Fail | Expected RED: `ModuleNotFoundError: No module named 'app.services.export'`. |
| `.\.venv\Scripts\pip.exe install kaleido` | ✅ Pass | Installed Kaleido and required transitive packages in backend venv. |
| `.\.venv\Scripts\python.exe -m pytest tests/test_project_routes.py tests/test_export.py -q` (post-impl, first run) | ❌ Fail | Missing runtime dependency: `ModuleNotFoundError: No module named 'plotly'`. |
| `.\.venv\Scripts\pip.exe install plotly` | ✅ Pass | Installed Plotly runtime required by export service. |
| `.\.venv\Scripts\python.exe -m pytest tests/test_project_routes.py tests/test_export.py -q` (post-deps) | ✅ Pass | 10 passed. |
| `.\.venv\Scripts\python.exe -m pytest tests/ -q` | ✅ Pass | 43 passed (existing + new, no regressions). |

## Residual Risks

- Save/load currently accepts trusted absolute file paths (desktop/Tauri context). If this backend is ever exposed beyond local desktop boundaries, stronger sandbox/path policy controls should be added.
- Export rendering uses server-side Plotly + Kaleido; very large figures may still be expensive. Current width/height guards (`<= 4000`) reduce abuse risk.
- Project load intentionally re-ingests source data but does not refit prior models in this backend slice; frontend can rehydrate config and trigger fit as needed.

## Next Phase

Phase 5B can implement frontend serializer/hydration wiring (`save/open/export` toolbar actions, store hydration, unsaved-change tracking) on top of these backend APIs.

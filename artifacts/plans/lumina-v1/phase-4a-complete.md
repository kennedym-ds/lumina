# Phase 4a Complete: New backend chart types

**Completed**: 2026-03-11
**Implementer**: GitHub Copilot (GPT-5.4)

## Changes made

| File | Change type | Description |
|------|-------------|-------------|
| `backend/app/models/eda.py` | Updated | Extended `ChartRequest` with `aggregation` and `values` so heatmap and pie requests can carry aggregation metadata. |
| `backend/app/services/chart_builder.py` | Updated | Added `violin`, `heatmap`, `density`, `pie`, `area`, and `qq_plot` builders; expanded request validation; registered new builders; and added numeric/aggregation helpers. |
| `backend/tests/test_build_spec.py` | Updated | Added 12 backend chart-builder tests covering the six new chart types and their validation, aggregation, and category-capping behavior. |

## Test results

| Command | Result | Notes |
|---------|--------|-------|
| `backend\.venv\Scripts\python.exe -m pytest tests/test_build_spec.py -v` (pre-implementation) | ❌ Fail | Expected red run: 12 new chart-type tests failed because the chart types were not yet supported. |
| `backend\.venv\Scripts\python.exe -m pytest tests/test_build_spec.py -v` | ✅ Pass | Focused chart-builder/spec suite passed: 15 tests. |
| `backend\.venv\Scripts\python.exe -m pytest tests/test_eda_routes.py tests/test_downsampling.py -v` | ✅ Pass | Integration coverage for chart routes and builder consumers passed: 31 tests. |
| `backend\.venv\Scripts\python.exe -m pytest tests/ -v` | ✅ Pass | Full backend suite passed: 161 tests. |

## Residual risks

- `backend/tests/test_build_spec.py` now contains both PyInstaller spec tests and chart-builder tests because the phase request explicitly targeted that file; a later cleanup could split those concerns into separate test modules for clarity.
- The new `area` builder follows the existing backend WebGL threshold pattern, but frontend rendering of filled `scattergl` traces should be verified during Phase 4b.
- Faceting behavior for pie charts is not covered in this phase; if frontend UX exposes pie faceting later, dedicated integration tests should be added.

## Next phase

Phase 4b can wire the six new chart types into the frontend chart builder, validate renderer-specific behavior, and add UI coverage for the new request fields where applicable.

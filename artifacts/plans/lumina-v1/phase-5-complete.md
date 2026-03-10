# Phase 5 Complete: Persistence & Export

## Summary

Phase 5 delivers project save/load (`.lumina` JSON files), chart export (PNG/SVG via kaleido), full store hydration on load, and unsaved changes tracking.

## Changes

### Backend (Phase 5A)

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/project.py` | Created | Pydantic schemas — ProjectSchema, ChartState, RegressionState, CrossFilterState, SaveRequest, LoadRequest, LoadResponse, ExportRequest |
| `backend/app/services/project.py` | Created | Atomic save (temp+rename), load, data file validation |
| `backend/app/services/export.py` | Created | Plotly figure → PNG/SVG via kaleido |
| `backend/app/routers/project.py` | Created | 3 endpoints: save, load, export with path traversal protection |
| `backend/app/main.py` | Modified | Registered project_router |
| `backend/requirements.txt` | Modified | Added kaleido>=0.2.1, plotly>=5.24.1 |
| `backend/tests/test_project_routes.py` | Created | 8 route tests (save, load, roundtrip, missing file, export PNG/SVG) |
| `backend/tests/test_export.py` | Created | 2 export service tests |

### Frontend (Phase 5B)

| File | Action | Purpose |
|------|--------|---------|
| `src/types/project.ts` | Created | TypeScript interfaces for project API |
| `src/services/projectSerializer.ts` | Created | Collects all store state into ProjectSchema |
| `src/api/project.ts` | Created | useSaveProject, useLoadProject mutations + exportChart blob fetch |
| `src/components/Toolbar/SaveButton.tsx` | Created | Save with Tauri dialog (prompt fallback) |
| `src/components/Toolbar/OpenButton.tsx` | Created | Open with Tauri dialog + full store hydration |
| `src/components/Toolbar/ExportChartButton.tsx` | Created | PNG/SVG dropdown + blob download |
| `src/hooks/useUnsavedChanges.ts` | Created | Store-mutation dirty tracking + beforeunload guard |
| `src/stores/datasetStore.ts` | Modified | Added filePath field + hydrate() method |
| `src/stores/chartStore.ts` | Modified | Added hydrateCharts() method |
| `src/stores/regressionStore.ts` | Modified | Added hydrateRegression() method |
| `src/types/data.ts` | Modified | Added optional file_path to UploadResponse |
| `src/components/Layout/AppLayout.tsx` | Modified | Added Save, Open, Export buttons to header |

### Tests

| File | Tests | Purpose |
|------|-------|---------|
| `src/services/__tests__/projectSerializer.test.ts` | 3 | Serialization: null on empty, full state, cross-filter omission |
| `src/stores/__tests__/chartStore.test.ts` | 1 | hydrateCharts replaces existing |
| `src/hooks/__tests__/useUnsavedChanges.test.ts` | 2 | isDirty starts false, becomes true on change |
| `src/stores/__tests__/datasetStore.test.ts` | +1 | hydrate method |
| `src/stores/__tests__/regressionStore.test.ts` | +1 | hydrateRegression method |

## Test Results

- Backend: **43 passed** (33 existing + 10 new)
- Frontend: **37 passed** (29 existing + 8 new)
- TypeScript: **0 errors**
- **Total: 80 tests**

## Acceptance Criteria

| AC ID | Status | Evidence |
|-------|--------|----------|
| AC-030 | ✅ | Save/load roundtrip test passes — charts + regression config preserved |
| AC-031 | ✅ | Export PNG endpoint returns valid PNG bytes (magic number verified in test) |
| — | ✅ | Export SVG returns valid SVG content (contains `<svg` tag) |
| — | ✅ | Unsaved changes hook tracks dirty state via store subscriptions |
| — | ✅ | Load with missing data file → 404 with missing_file field |

## Security

- Path traversal protection: absolute path required, `..` segments rejected
- Atomic file writes: temp+rename prevents corrupt saves on crash
- Export bounds: max 4000×4000, scale 1-4, format whitelist (png/svg)
- Tauri dialog wrapping: graceful fallback in dev mode

## Risks

| Risk | Status | Notes |
|------|--------|-------|
| kaleido adds ~40MB to sidecar | Accepted | Within 350MB budget |
| Moved data file on load | Mitigated | 404 with missing_file field — frontend can prompt for re-location |
| Model refit not supported on load | Open | Only config persisted, not fitted model; user must re-fit after load |

## Next Phase

**Phase 6: Onboarding & UX Polish** — Empty states, sample datasets, resizable layout, undo/redo, favourites, accessibility.

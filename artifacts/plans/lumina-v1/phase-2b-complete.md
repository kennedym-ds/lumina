# Phase 2b Complete: Correlation matrix heatmap

**Completed**: 2026-03-11T13:19:41.5666005+00:00
**Implementer**: GitHub Copilot (GPT-5.4)

## Changes made

| File | Change type | Description |
|------|-------------|-------------|
| `backend/app/models/profiling.py` | Updated | Added correlation request/response models for numeric-column matrix computation. |
| `backend/app/services/profiling.py` | Updated | Added `compute_correlation` with Pearson, Spearman, and Kendall support plus numeric-column filtering and rounded JSON-safe matrix output. |
| `backend/app/routers/eda.py` | Updated | Added `/api/eda/{dataset_id}/correlation` endpoint with 400 handling for invalid correlation methods. |
| `backend/tests/test_profiling.py` | Updated | Added service and API coverage for correlation computation and numeric-column filtering. |
| `src/types/profiling.ts` | Updated | Added shared `CorrelationResponse` typing for the frontend. |
| `src/api/profiling.ts` | Updated | Added `useCorrelation` React Query hook using the existing authenticated POST client. |
| `src/platforms/profiling/CorrelationHeatmap.tsx` | Added | Created a dedicated Plotly heatmap component with selectable method, annotations, and loading/error/empty states. |
| `src/platforms/profiling/ProfilingPlatform.tsx` | Updated | Inserted the new correlation heatmap section between summary cards and column profiles. |
| `src/platforms/profiling/__tests__/ProfilingPlatform.test.tsx` | Updated | Added a UI test covering heatmap rendering and query-hook usage. |

## Test results

| Command | Result | Notes |
|---------|--------|-------|
| `backend\.venv\Scripts\python.exe -m pytest tests\test_profiling.py -v` (pre-implementation) | ❌ Fail | Expected red run: `compute_correlation` import was missing. |
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run src/platforms/profiling/__tests__/ProfilingPlatform.test.tsx` (pre-implementation) | ❌ Fail | Expected red run: `Correlation Matrix` section was not rendered yet. |
| `backend\.venv\Scripts\python.exe -m pytest tests\test_profiling.py -v` | ✅ Pass | Targeted profiling suite passed: 11 tests. |
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run src/platforms/profiling/__tests__/ProfilingPlatform.test.tsx` | ✅ Pass | Targeted profiling platform suite passed: 3 tests. |
| `backend\.venv\Scripts\python.exe -m pytest tests\ -v` | ✅ Pass | Full backend suite passed: 124 tests. |
| `C:\Program Files\nodejs\node.exe .\node_modules\typescript\bin\tsc --noEmit` | ✅ Pass | TypeScript compile completed with zero reported errors. |
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run` | ✅ Pass | Full frontend suite passed: 70 tests across 21 files. |

## Residual risks

- Wide datasets with many numeric columns will produce dense annotations; the component reduces font size, but readability will still degrade as the matrix grows.
- Correlation is computed on demand from the active in-memory dataset. If future phases introduce server-side caching or persisted profiling artifacts, this endpoint should reuse them rather than recomputing every time.
- Constant numeric columns yield `null` values where the statistical method cannot compute a finite correlation; the UI currently renders those cells blank rather than explaining why.

## Next phase

A sensible follow-up is to add richer cell hover text or click-through drilldowns so users can jump from a strong correlation cell directly into a scatter plot or related EDA view.

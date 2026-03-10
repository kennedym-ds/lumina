# Phase 5B Complete: Frontend Persistence & Export UI

**Completed**: 2026-03-10
**Implementer**: GitHub Copilot (GPT-5.3-Codex)

## Changes Made

| File | Change Type | Description |
| ---- | ----------- | ----------- |
| `src/types/project.ts` | Added | Frontend project persistence/export contracts (`ProjectSchema`, save/load/export payloads). |
| `src/services/projectSerializer.ts` | Added | Serializes dataset/chart/regression/cross-filter Zustand state into `ProjectSchema`. |
| `src/api/project.ts` | Added | React Query save/load mutations + binary export helper with authenticated fetch. |
| `src/components/Toolbar/SaveButton.tsx` | Added | Save flow (serialize → file picker with Tauri fallback → `/api/project/save`). |
| `src/components/Toolbar/OpenButton.tsx` | Added | Open flow (file picker with fallback → `/api/project/load` → hydrate all stores). |
| `src/components/Toolbar/ExportChartButton.tsx` | Added | Export dropdown for PNG/SVG using active chart figure and blob download helper. |
| `src/hooks/useUnsavedChanges.ts` | Added | Dirty-state tracking across stores + browser `beforeunload` and Tauri close-request guard. |
| `src/stores/datasetStore.ts` | Updated | Added `filePath` field, upload-path capture, and `hydrate()` bulk setter. |
| `src/stores/chartStore.ts` | Updated | Added `hydrateCharts()` bulk replacement API with active-chart normalization. |
| `src/stores/regressionStore.ts` | Updated | Added `hydrateRegression()` bulk config hydration/reset API. |
| `src/types/data.ts` | Updated | Added optional `file_path` on `UploadResponse` for persistence fidelity. |
| `src/components/Layout/AppLayout.tsx` | Updated | Added Open/Save/Export controls and unsaved-changes indicator in toolbar. |
| `src/platforms/regression/__tests__/RegressionPlatform.test.tsx` | Updated | Mocked new toolbar/hook dependencies for isolated layout test compatibility. |
| `src/services/__tests__/projectSerializer.test.ts` | Added | Serializer tests for empty state, full state, and empty cross-filter behavior. |
| `src/stores/__tests__/chartStore.test.ts` | Added | Chart hydration replacement test (`hydrateCharts`). |
| `src/hooks/__tests__/useUnsavedChanges.test.ts` | Added | Dirty-state hook tests (`starts false`, `becomes true on store mutation`). |
| `src/stores/__tests__/datasetStore.test.ts` | Updated | Added assertions for `filePath` and `hydrate()` behavior. |
| `src/stores/__tests__/regressionStore.test.ts` | Updated | Added `hydrateRegression()` behavior coverage. |

## Test Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npx vitest run src/services/__tests__/projectSerializer.test.ts src/stores/__tests__/chartStore.test.ts src/hooks/__tests__/useUnsavedChanges.test.ts` (pre-impl) | ❌ Fail | Expected RED: missing `projectSerializer`, missing `useUnsavedChanges`, missing `hydrateCharts`. |
| `npx vitest run src/services/__tests__/projectSerializer.test.ts src/stores/__tests__/chartStore.test.ts src/hooks/__tests__/useUnsavedChanges.test.ts src/stores/__tests__/datasetStore.test.ts src/stores/__tests__/regressionStore.test.ts` | ✅ Pass | 5 files, 16 tests passed. |
| `npx tsc --noEmit` (first post-impl run) | ❌ Fail | Strict cast error in `OpenButton` for loaded columns payload. |
| `npx tsc --noEmit` (post-fix) | ✅ Pass | Explicit `TSC_OK` marker confirmed zero type errors. |
| `npx vitest run` | ✅ Pass | 10 files, 37 tests passed (existing + new). |

## Residual Risks

- Save/Open currently use browser `window.alert`/`prompt` for dev fallback UX; this is functional but not polished.
- `ExportChartButton` exports the currently active chart configuration; if chart query data is not yet materialized, users must render/select a valid chart first.
- Loaded project columns are cast from generic backend payload (`Record<string, unknown>[]`) to `ColumnInfo[]`; backend/frontend schema drift could surface at runtime if contracts diverge.

## Next Phase

Phase 6 can build on this foundation for onboarding UX improvements (e.g., toast system, recent projects, richer close-flow prompts, and view persistence extensions).

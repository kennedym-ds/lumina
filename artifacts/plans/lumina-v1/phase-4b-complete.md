# Phase 4b Complete: wire up new chart types in frontend

**Completed**: 2026-03-11T14:18:00Z
**Implementer**: GitHub Copilot (GPT-5.4)

## Changes made

| File | Change type | Description |
|------|-------------|-------------|
| `src/types/eda.ts` | Updated | Expanded `ChartType` to 11 chart kinds and added optional `aggregation` / `values` fields to chart config and request types. |
| `src/api/eda.ts` | Updated | Exported chart helper functions, added required-field support for the new chart types, included `aggregation` / `values` in request building, and extended the query cache key. |
| `src/components/ChartBuilder/ChartTypeSelector.tsx` | Updated | Added selector buttons for violin, heatmap, density, pie, area, and Q-Q plot. |
| `src/components/ChartBuilder/ChartPanel.tsx` | Updated | Added per-chart shelf visibility rules plus heatmap aggregation and values-column controls. |
| `src/stores/chartStore.ts` | Updated | Added `aggregation` / `values` defaults for new charts and labeled those updates for undo/redo history. |
| `src/types/project.ts` | Updated | Added persisted `aggregation` / `values` fields to chart state. |
| `src/services/projectSerializer.ts` | Updated | Serialized the new chart fields so save/export paths retain chart configuration. |
| `src/components/Toolbar/OpenButton.tsx` | Updated | Hydrated `aggregation` / `values` from loaded projects. |
| `src/components/Sidebar/FavouritesPanel.tsx` | Updated | Accepted the expanded chart type list and persisted/restored `aggregation` / `values` for saved views. |
| `src/components/Toolbar/SaveViewButton.tsx` | Updated | Included `aggregation` / `values` in saved-view payloads. |
| `src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx` | Updated | Asserted the selector now renders all 11 chart types. |
| `src/api/__tests__/eda.test.ts` | Added | Covered new `hasRequiredFields` behavior and request building for `aggregation` / `values`. |
| `src/components/ChartBuilder/__tests__/ChartPanel.test.tsx` | Added | Covered new builder shelf visibility and heatmap/pie auxiliary controls. |
| `src/services/__tests__/projectSerializer.test.ts` | Updated | Verified the new chart fields survive serialization. |

## Test results

| Command | Result | Notes |
|---------|--------|-------|
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx src/components/ChartBuilder/__tests__/ChartPanel.test.tsx src/api/__tests__/eda.test.ts` (pre-impl) | ❌ Fail | Expected RED phase: 17 failing tests covering missing exports, selector options, and missing builder controls. |
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx src/components/ChartBuilder/__tests__/ChartPanel.test.tsx src/api/__tests__/eda.test.ts src/services/__tests__/projectSerializer.test.ts` | ✅ Pass | Focused frontend regression suite passed: 26 tests across 4 files. |
| `C:\Program Files\nodejs\node.exe .\node_modules\typescript\bin\tsc --noEmit` | ✅ Pass | Full frontend type-check completed with zero errors. |
| `C:\Program Files\nodejs\node.exe .\node_modules\vitest\vitest.mjs run` | ✅ Pass | Full frontend suite passed: 94 tests across 25 files. |
| `backend\.venv\Scripts\python.exe -m pytest tests\ -v` | ✅ Pass | Full backend suite passed: 161 tests. |

## Residual risks

- The frontend now exposes an optional `x` shelf for violin charts per the requested UX, but the current backend violin builder still groups by `color` rather than `x`; that extra shelf is harmless, but it is not yet semantically active server-side.
- Heatmap `sum` / `mean` aggregation still relies on the user selecting a numeric values column; the frontend reveals that control, but the backend remains the final validator if the field is missing or non-numeric.
- Pie and heatmap values selectors intentionally offer numeric columns only; if future backend support expands to derived metrics or expressions, the builder UI will need to evolve with it.

## Next phase

The sensible follow-up is a small UX pass on chart-type switching to proactively clear or migrate incompatible shelf assignments when users jump between structurally different chart families.

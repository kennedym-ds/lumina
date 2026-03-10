# Phase 2B Complete: Frontend Chart Builder & EDA Components

**Completed**: 2026-03-10T00:00:00Z  
**Implementer**: implementer-agent

## Changes Made

| File | Change Type | Description |
| ---- | ----------- | ----------- |
| `src/types/eda.ts` | Added | Frontend EDA contracts (`ChartType`, `ChartConfig`, API request/response types, shelf assignment type). |
| `src/stores/chartStore.ts` | Added | Zustand chart state with `addChart`, `removeChart`, `updateChart`, `setActiveChart`, `clearCharts`, and max-8 guard. |
| `src/api/eda.ts` | Added | React Query chart hook (`useChartData`) with minimum-field gating and stable query key hashing. |
| `src/components/ChartBuilder/VariableShelf.tsx` | Added | Droppable shelf UI for X/Y/Color/Facet with assignment chip and remove action. |
| `src/components/ChartBuilder/DraggableVariable.tsx` | Added | Draggable variable item with dtype icon mapping. |
| `src/components/ChartBuilder/ChartTypeSelector.tsx` | Added | 5-option chart-type picker with active highlight state. |
| `src/components/ChartBuilder/ChartPanel.tsx` | Added | Single-chart builder panel composing chart type selector, shelves, and Plotly renderer. |
| `src/components/Chart/PlotlyChart.tsx` | Added | Plotly renderer wrapper with loading, error, and responsive config support. |
| `src/components/Chart/ChartGrid.tsx` | Added | Tiled chart grid with add/remove controls and active chart highlighting. |
| `src/platforms/eda/EdaPlatform.tsx` | Added | Main EDA platform view with global DnD context, draggable variable list, drag overlay, and chart grid wiring. |
| `src/types/plotly.d.ts` | Added | Type declaration shim for `plotly.js-dist-min`. |
| `src/components/Layout/AppLayout.tsx` | Updated | Added Data/Charts tab switch while preserving existing sidebar and import controls. |
| `src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx` | Added | Phase 2B tests covering selector options, type switch state, shelf rendering, grid add button, and chart store behaviors. |
| `package.json` / `package-lock.json` | Updated | Added DnD + Plotly dependencies and Plotly React typings. |

## Test Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npm run test` (initial) | ❌ Fail | Environment PATH issue in script shell (`"node" is not recognized`). |
| `npm run test --script-shell "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"` (first run) | ❌ Fail | 2 failures: DnD context requirement in shelf test + duplicate button query due missing cleanup. |
| `npm run test --script-shell "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"` (after fixes) | ✅ Pass | 3 files, 12 tests passed. |
| `npm run type-check --script-shell "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"` | ✅ Pass | `tsc --noEmit` completed successfully. |
| `npm run test` + `npm run type-check` (exact commands, normalized PATH in-shell) | ✅ Pass | Exit codes: `TEST_EXIT=0`, `TYPE_EXIT=0`. |

## Dependency / Security Notes

- Installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-plotly.js`, `plotly.js-dist-min`, `@types/react-plotly.js`.
- `npm install` reported **5 moderate vulnerabilities** in dependency tree (no auto-fix applied in this phase).

## Residual Risks

- Shelf compatibility by dtype (e.g., numeric-only recommendations) is not yet enforced client-side.
- `facet` is exposed in UI/store and request payload, but backend facet rendering support remains limited from Phase 2A.
- Plotly introduces a larger frontend bundle; lazy-loading/perf tuning can be revisited in later phases.

## Next Phase

Proceed to **Phase 3: Cross-filtering** (selection propagation across charts + table).

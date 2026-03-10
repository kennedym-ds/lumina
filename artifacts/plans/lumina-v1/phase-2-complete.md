# Phase 2 Complete: Chart Builder & EDA

**Completed**: 2026-03-10
**Conductor**: conductor-agent

## Summary

Phase 2 delivered the core EDA experience — drag-and-drop variable shelves, 5 chart types with Plotly rendering, multi-chart tiled layout, and a backend chart builder service generating Plotly JSON specs. Split into two implementation cycles:

- **Phase 2A (Backend)**: Chart builder service, EDA router, downsampling stub, Pydantic models
- **Phase 2B (Frontend)**: DnD shelves, chart store, Plotly chart component, chart grid, EDA platform, tab navigation

## Changes Made

### Backend (Phase 2A)
| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/models/eda.py` | Added | ChartRequest/ChartResponse Pydantic schemas |
| `backend/app/services/chart_builder.py` | Added | Plotly JSON figure builder for 5 chart types with WebGL, color grouping, Okabe-Ito palette |
| `backend/app/services/downsampling.py` | Added | LTTB stub with uniform sampling fallback |
| `backend/app/routers/eda.py` | Added | POST /api/eda/{dataset_id}/chart endpoint |
| `backend/app/main.py` | Updated | Registered EDA router |
| `backend/tests/test_eda_routes.py` | Added | 10 tests covering all chart types, WebGL, color, errors |
| `backend/tests/conftest.py` | Updated | Added large_csv_bytes fixture (>10K rows) |

### Frontend (Phase 2B)
| File | Change Type | Description |
|------|-------------|-------------|
| `src/types/eda.ts` | Added | ChartType, ChartConfig, ChartRequest, ChartResponse, ShelfAssignment types |
| `src/types/plotly.d.ts` | Added | Module declaration for plotly.js-dist-min |
| `src/stores/chartStore.ts` | Added | Zustand chart store with add/remove/update, max 8 charts |
| `src/api/eda.ts` | Added | useChartData React Query hook with auto-render gating |
| `src/components/ChartBuilder/VariableShelf.tsx` | Added | DnD droppable shelf with chip display |
| `src/components/ChartBuilder/DraggableVariable.tsx` | Added | DnD draggable column with dtype icons |
| `src/components/ChartBuilder/ChartTypeSelector.tsx` | Added | 5 chart type selector buttons |
| `src/components/ChartBuilder/ChartPanel.tsx` | Added | Single chart builder panel (shelves + type + Plotly) |
| `src/components/Chart/PlotlyChart.tsx` | Added | react-plotly.js wrapper with loading/error states |
| `src/components/Chart/ChartGrid.tsx` | Added | Multi-chart tiled layout (1-4+ charts) |
| `src/platforms/eda/EdaPlatform.tsx` | Added | Main EDA workspace with DnD context + variable list |
| `src/components/Layout/AppLayout.tsx` | Updated | Added Data/Charts tab navigation |
| `src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx` | Added | 7 tests for chart builder components + store |

### Dependencies Added
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `react-plotly.js`, `plotly.js-dist-min`
- `@types/react-plotly.js` (dev)

## Test Results
| Suite | Result | Count |
|-------|--------|-------|
| Backend (pytest) | ✅ Pass | 21 tests (11 Phase 1 + 10 Phase 2A) |
| Frontend (vitest) | ✅ Pass | 12 tests (5 Phase 1 + 7 Phase 2B) |
| TypeScript type-check | ✅ Pass | Zero errors |

## Acceptance Criteria Status
| AC ID | Criterion | Status |
|-------|-----------|--------|
| AC-052 | Drag variable to X shelf → appears as chip | ✅ Implemented |
| AC-053 | Type icons for each column type | ✅ Implemented |
| AC-054 | Click type icon → recast type → charts update | ⏳ Partial (type selector exists, recast deferred to Phase 6) |
| AC-055 | X+Y populated → chart auto-renders | ✅ Implemented (query gating) |
| AC-012 | Scatter >10K uses Scattergl WebGL | ✅ Implemented + tested |
| — | 5 chart types render correctly | ✅ All tested |
| — | 2+ charts in tiled grid | ✅ Implemented |
| — | Plotly toolbar visible | ✅ displayModeBar: true |

## Residual Risks
- Plotly bundle size (~3 MB) may impact initial load — using `plotly.js-dist-min` to mitigate
- DnD overlay rendering during scroll with many variables needs UX testing
- npm audit reported 5 moderate vulnerabilities in dependency tree (not addressed this phase)

## Next Phase
Phase 3: Cross-Filtering — lasso/box selection on charts propagates to all charts and data table.

# Phase 6C Complete: Undo/Redo + Favourite Views UI

**Completed**: 2026-03-10
**Implementer**: GitHub Copilot (GPT-5.3-Codex)

## Changes Made

| File | Change Type | Description |
| ---- | ----------- | ----------- |
| `src/stores/undoRedoStore.ts` | Added | Added bounded snapshot history store (`undoStack`/`redoStack`, max 50 entries) with `undo`, `redo`, `pushSnapshot`, and `resetHistory`. |
| `src/stores/chartStore.ts` | Updated | Wired pre-mutation snapshot capture for `addChart`, `removeChart`, `updateChart`, and `clearCharts`; `hydrateCharts` remains non-history. |
| `src/api/views.ts` | Added | Added React Query hooks for saved view list/create/rename/delete operations. |
| `src/components/Toolbar/UndoRedoButtons.tsx` | Added | Added Undo/Redo toolbar buttons with disabled states and action-label tooltips; restores chart snapshots via `hydrateCharts`. |
| `src/components/Toolbar/SaveViewButton.tsx` | Added | Added toolbar action to save current chart + cross-filter state as a backend view. |
| `src/components/Sidebar/FavouritesPanel.tsx` | Added | Added sidebar panel for save/list/restore/rename/delete saved views, including cross-filter restoration. |
| `src/components/Layout/AppLayout.tsx` | Updated | Integrated Undo/Redo + Save View buttons in header, inserted `FavouritesPanel` below `SummaryPanel`, and wired global `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`, `Ctrl/Cmd+Shift+Z`. |
| `src/platforms/eda/EdaPlatform.tsx` | Updated | Reset undo/redo history after dataset-driven chart initialization so auto-init doesn’t pollute user undo history. |
| `src/stores/__tests__/undoRedoStore.test.ts` | Added | Added store tests for stack behavior, max history, undo/redo semantics, and reset behavior. |
| `src/components/Toolbar/__tests__/UndoRedoButtons.test.tsx` | Added | Added jsdom tests verifying disabled Undo/Redo buttons when history is empty. |
| `src/components/Sidebar/__tests__/FavouritesPanel.test.tsx` | Added | Added jsdom tests for save-button rendering and empty-state rendering. |
| `src/platforms/regression/__tests__/RegressionPlatform.test.tsx` | Updated | Fixed regression test to render `AppLayout` with `QueryClientProvider` now that layout contains React Query-based view components. |

## Impact Assessment

- **Change**: Chart-only undo/redo + backend-backed saved views UI + layout integration.
- **Scope**: **Cross-module** (stores, toolbar, sidebar, layout, API hooks, regression test harness).
- **Blast radius**: `chartStore` mutators affect EDA chart interactions, keyboard flows affect global app shell, new views hooks affect any tests rendering `AppLayout` without query context.
- **Coverage**: Added 3 new Phase 6C test files and validated full suite.
- **Confidence**: **High** after full type-check and full test pass.

## Test Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npx vitest run src/stores/__tests__/undoRedoStore.test.ts src/components/Toolbar/__tests__/UndoRedoButtons.test.tsx src/components/Sidebar/__tests__/FavouritesPanel.test.tsx` (pre-impl) | ❌ Fail | Expected RED phase: new modules/components did not exist. |
| `npx vitest run src/stores/__tests__/undoRedoStore.test.ts src/components/Toolbar/__tests__/UndoRedoButtons.test.tsx src/components/Sidebar/__tests__/FavouritesPanel.test.tsx src/stores/__tests__/chartStore.test.ts src/components/ChartBuilder/__tests__/ChartBuilder.test.tsx` | ✅ Pass | 5 files passed, 19 tests passed. |
| `npx tsc --noEmit` (first post-impl run) | ✅ Pass | No TypeScript errors. |
| `npx vitest run` (first full run) | ❌ Fail | 1 regression failure (`RegressionPlatform.test.tsx`) because `AppLayout` now requires `QueryClientProvider`. |
| `npx vitest run src/platforms/regression/__tests__/RegressionPlatform.test.tsx` (post-fix) | ✅ Pass | 1 file passed, 5 tests passed. |
| `npx tsc --noEmit` (post-fix) | ✅ Pass | No TypeScript errors. |
| `npx vitest run` (post-fix) | ✅ Pass | 16 files passed, 54 tests passed. |

## Residual Risks

- View naming UX currently uses prompt/confirm dialogs for speed and scope; replacing with richer inline/modals can improve polish.
- Undo/redo history intentionally resets on dataset initialization and view restore; this matches scope intent (chart edits only) but should be documented for users.
- Saved view payload uses permissive `Record<string, unknown>[]` contracts from backend; tighter runtime validation can be added if schema evolution accelerates.

## Next Phase

Continue remaining Phase 6 polish items (palette selector, view match indicator, export resolution options, recent projects), or transition to Phase 7 packaging/distribution work.
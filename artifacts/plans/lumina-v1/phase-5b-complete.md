# Phase 5B Complete: Tree-Based Regression Models & Model Comparison

**Completed**: 2026-03-11
**Implementer**: GitHub Copilot (GPT-5.4)

## Changes Made

| File | Change Type | Description |
| ---- | ----------- | ----------- |
| `backend/app/models/regression.py` | Updated | Added tree-model request fields (`max_depth`, `n_estimators`), `feature_importances`, and model-comparison response schemas. |
| `backend/app/services/regression.py` | Updated | Implemented `DecisionTreeRegressor` and `RandomForestRegressor` fitters, feature-importance serialization, and RMSE/MAE reporting for tree models. |
| `backend/app/routers/model.py` | Updated | Added `decision_tree`/`random_forest` dispatch, session-local comparison history accumulation, and `GET /api/model/{dataset_id}/comparison`. |
| `backend/app/session.py` | Updated | Added `model_history` storage so fitted-model summaries can be compared within a dataset session. |
| `backend/app/models/project.py` | Updated | Extended persisted regression state to carry `max_depth` and `n_estimators`. |
| `backend/tests/test_model_routes.py` | Updated | Added coverage for tree-model fitting, feature importances, comparison history, parameter plumbing, and RMSE/MAE metrics. |
| `backend/tests/test_project_routes.py` | Updated | Updated project round-trip expectations for the new persisted regression defaults. |
| `src/types/regression.ts` | Updated | Added frontend tree-model types, feature-importance shapes, and comparison response contracts. |
| `src/types/project.ts` | Updated | Extended persisted regression config shape with `max_depth` and `n_estimators`. |
| `src/stores/regressionStore.ts` | Updated | Added tree hyperparameter state/actions and hydration support for persisted regression settings. |
| `src/services/projectSerializer.ts` | Updated | Persisted tree-model hyperparameters during project save/export serialization. |
| `src/components/Toolbar/OpenButton.tsx` | Updated | Hydrated persisted tree-model hyperparameters when loading a saved project. |
| `src/api/model.ts` | Updated | Added comparison query hook for fetching accumulated fitted-model summaries. |
| `src/platforms/regression/ModelConfigPanel.tsx` | Updated | Added `Decision Tree` and `Random Forest` selectors plus `Max Depth`/`Number of Trees` controls. |
| `src/platforms/regression/RegressionPlatform.tsx` | Updated | Sent tree-model parameters in fit requests, refreshed comparison results after fit, and rendered a model-comparison table. |
| `src/platforms/regression/ResultsSummary.tsx` | Updated | Rendered tree-model feature importances as a bar-style summary and expanded metric cards with RMSE/MAE. |
| `src/stores/__tests__/regressionStore.test.ts` | Updated | Added assertions for new regression defaults, hydration, and response shape extensions. |
| `src/services/__tests__/projectSerializer.test.ts` | Updated | Added serialization expectations for tree-model persistence fields. |
| `src/platforms/regression/__tests__/RegressionPlatform.test.tsx` | Updated | Added coverage for the seven-model selector, tree controls, feature-importance rendering, comparison UI, and random-forest request payloads. |

## Test Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `.\.venv\Scripts\python.exe -m pytest tests -v` | ✅ Pass | 176 backend tests passed in 9.49s. |
| `& "C:\Program Files\nodejs\node.exe" .\node_modules\typescript\bin\tsc --noEmit` | ✅ Pass | Type-check completed with zero TypeScript errors. |
| `& "C:\Program Files\nodejs\node.exe" .\node_modules\vitest\vitest.mjs run` | ✅ Pass | 25 frontend test files passed; 98 tests passed in 3.64s. |

## Residual Risks

- Model comparison history is session-local; it resets when a dataset session is recreated unless future work persists comparison snapshots explicitly.
- Tree-model responses expose feature importance rather than inferential statistics; fields like AIC/BIC/adjusted $R^2$ remain intentionally unavailable for those estimators.
- The comparison table currently accumulates fitted models for the active session without a clear/reset UX, so long exploratory sessions may produce a noisy side-by-side list.

## Next Phase

The next iteration can build richer model-evaluation workflows on top of this foundation, such as comparison filtering/reset controls, persisted model histories, and classification-oriented tree variants if the roadmap still calls for them.

import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";
import type { ProjectSchema } from "@/types/project";

export function serializeProject(): ProjectSchema | null {
  const ds = useDatasetStore.getState();
  if (!ds.datasetId) {
    return null;
  }

  const charts = useChartStore.getState();
  const cf = useCrossFilterStore.getState();
  const dashboard = useDashboardStore.getState();
  const reg = useRegressionStore.getState();
  const excludedColumns = Array.from(ds.excludedColumns).sort((left, right) => left.localeCompare(right));
  const selectedRowIds = Array.from(cf.selectedRowIds);

  return {
    version: "1.2",
    file_path: ds.filePath ?? "",
    file_name: ds.fileName ?? "",
    file_format: ds.fileFormat ?? "csv",
    sheet_name: ds.sheetName ?? null,
    column_config: excludedColumns.map((columnName) => ({ name: columnName, excluded: true })),
    saved_views: [],
    excluded_columns: excludedColumns,
    charts: charts.charts.map((chart) => ({
      chart_id: chart.chartId,
      chart_type: chart.chartType,
      x: chart.x,
      y: chart.y,
      color: chart.color,
      facet: chart.facet,
      aggregation: chart.aggregation ?? null,
      values: chart.values ?? null,
      nbins: chart.nbins ?? null,
    })),
    active_chart_id: charts.activeChartId,
    dashboard_panels: dashboard.panels.map((panel) => ({
      id: panel.id,
      chart_id: panel.chartId,
      x: panel.x,
      y: panel.y,
      w: panel.w,
      h: panel.h,
    })),
    regression: {
      model_type: reg.modelType,
      dependent: reg.dependent,
      independents: reg.independents,
      interaction_terms: reg.interactionTerms,
      train_test_split: reg.trainTestSplit,
      missing_strategy: reg.missingStrategy,
      alpha: reg.alpha,
      l1_ratio: reg.l1Ratio,
      polynomial_degree: reg.polynomialDegree,
      max_depth: reg.maxDepth,
      n_estimators: reg.nEstimators,
      learning_rate: reg.learningRate,
      ...(reg.modelBlob ? { model_blob: reg.modelBlob } : {}),
      ...(reg.lastResult ? { model_result: reg.lastResult } : {}),
      ...(reg.modelHistory.length > 0 ? { model_history: reg.modelHistory } : {}),
    },
    cross_filter:
      selectedRowIds.length > 0
        ? {
            selected_indices: selectedRowIds,
            selection_source: cf.selectionSource,
          }
        : null,
  };
}
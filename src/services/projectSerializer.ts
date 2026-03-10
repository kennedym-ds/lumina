import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
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
  const reg = useRegressionStore.getState();

  return {
    version: "1.0",
    file_path: ds.filePath ?? "",
    file_name: ds.fileName ?? "",
    file_format: ds.fileFormat ?? "csv",
    sheet_name: null,
    column_config: [],
    charts: charts.charts.map((chart) => ({
      chart_id: chart.chartId,
      chart_type: chart.chartType,
      x: chart.x,
      y: chart.y,
      color: chart.color,
      facet: chart.facet,
      nbins: chart.nbins ?? null,
    })),
    active_chart_id: charts.activeChartId,
    regression: {
      model_type: reg.modelType,
      dependent: reg.dependent,
      independents: reg.independents,
      train_test_split: reg.trainTestSplit,
      missing_strategy: reg.missingStrategy,
    },
    cross_filter:
      cf.selectedIndices.length > 0
        ? {
            selected_indices: cf.selectedIndices,
            selection_source: cf.selectionSource,
          }
        : null,
  };
}
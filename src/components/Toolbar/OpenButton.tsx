import { useLoadProject } from "@/api/project";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";
import type { ColumnInfo } from "@/types/data";
import type { ChartConfig, ChartType } from "@/types/eda";

interface OpenButtonProps {
  onLoaded?: () => void;
}

async function getOpenPath(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      filters: [{ name: "Lumina Project", extensions: ["lumina"] }],
      multiple: false,
    });

    return typeof result === "string" ? result : null;
  } catch {
    const fallback = window.prompt("Open file path (dev mode):");
    return fallback && fallback.trim().length > 0 ? fallback.trim() : null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to open project.";
}

export function OpenButton({ onLoaded }: OpenButtonProps) {
  const loadProject = useLoadProject();

  const handleOpen = async () => {
    const path = await getOpenPath();
    if (!path) {
      return;
    }

    try {
      const response = await loadProject.mutateAsync({ file_path: path });

      useDatasetStore.getState().hydrate({
        datasetId: response.dataset_id,
        fileName: response.file_name,
        fileFormat: response.file_format,
        columns: response.columns as unknown as ColumnInfo[],
        rowCount: response.row_count,
        columnCount: response.column_count,
        filePath: response.project.file_path,
      });

      const hydratedCharts: ChartConfig[] = response.project.charts.map((chart) => ({
        chartId: chart.chart_id,
        chartType: chart.chart_type as ChartType,
        x: chart.x,
        y: chart.y,
        color: chart.color,
        facet: chart.facet,
        nbins: chart.nbins ?? undefined,
      }));

      useChartStore.getState().hydrateCharts(hydratedCharts, response.project.active_chart_id);

      const regressionStore = useRegressionStore.getState();
      regressionStore.reset();
      if (response.project.regression) {
        const regression = response.project.regression;
        regressionStore.hydrateRegression({
          modelType: regression.model_type,
          dependent: regression.dependent,
          independents: regression.independents,
          trainTestSplit: regression.train_test_split,
          missingStrategy: regression.missing_strategy,
        });
      }

      const crossFilterStore = useCrossFilterStore.getState();
      crossFilterStore.clearSelection();
      if (response.project.cross_filter && response.project.cross_filter.selected_indices.length > 0) {
        crossFilterStore.setSelection(
          response.project.cross_filter.selection_source ?? "loaded-project",
          response.project.cross_filter.selected_indices,
        );
      }

      onLoaded?.();
      window.alert(`Project loaded from:\n${path}`);
    } catch (error) {
      window.alert(`Open failed: ${getErrorMessage(error)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loadProject.isPending}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loadProject.isPending ? "Opening..." : "Open"}
    </button>
  );
}
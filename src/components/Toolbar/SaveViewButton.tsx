import { useSaveView } from "@/api/views";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save view.";
}

export function SaveViewButton() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const saveView = useSaveView(datasetId);

  const handleSave = async () => {
    if (!datasetId) {
      window.alert("Import a dataset before saving a view.");
      return;
    }

    const name = window.prompt("View name:", "My View")?.trim();
    if (!name) {
      return;
    }

    const chartState = useChartStore.getState();
    const crossFilterState = useCrossFilterStore.getState();
    const selectedRowIds = Array.from(crossFilterState.selectedRowIds);

    try {
      await saveView.mutateAsync({
        name,
        charts: chartState.charts.map((chart) => ({
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
        active_chart_id: chartState.activeChartId,
        cross_filter:
          selectedRowIds.length > 0
            ? {
                selected_indices: selectedRowIds,
                selection_source: crossFilterState.selectionSource,
              }
            : null,
      });

      window.alert(`Saved view: ${name}`);
    } catch (error) {
      window.alert(`Save view failed: ${getErrorMessage(error)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={!datasetId || saveView.isPending}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saveView.isPending ? "Saving view..." : "Save View"}
    </button>
  );
}
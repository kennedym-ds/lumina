import { useState } from "react";
import { useDeleteView, useRenameView, useSaveView, useViewsList, type ViewSchema } from "@/api/views";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import type { ChartConfig, ChartType } from "@/types/eda";

function isChartType(value: unknown): value is ChartType {
  return (
    value === "histogram" ||
    value === "scatter" ||
    value === "box" ||
    value === "bar" ||
    value === "line" ||
    value === "violin" ||
    value === "heatmap" ||
    value === "density" ||
    value === "pie" ||
    value === "area" ||
    value === "qq_plot"
  );
}

function toChartConfig(chart: Record<string, unknown>): ChartConfig | null {
  const chartId = typeof chart.chart_id === "string" ? chart.chart_id : null;
  const chartType = chart.chart_type;

  if (!chartId || !isChartType(chartType)) {
    return null;
  }

  return {
    chartId,
    chartType,
    x: typeof chart.x === "string" ? chart.x : null,
    y: typeof chart.y === "string" ? chart.y : null,
    color: typeof chart.color === "string" ? chart.color : null,
    facet: typeof chart.facet === "string" ? chart.facet : null,
    aggregation: typeof chart.aggregation === "string" ? chart.aggregation : null,
    values: typeof chart.values === "string" ? chart.values : null,
    nbins: typeof chart.nbins === "number" ? chart.nbins : undefined,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Action failed.";
}

function restoreView(view: ViewSchema) {
  const charts = view.charts
    .map((chart) => toChartConfig(chart))
    .filter((chart): chart is ChartConfig => chart !== null);

  useChartStore.getState().hydrateCharts(charts, view.active_chart_id);

  const crossFilterStore = useCrossFilterStore.getState();
  const selectedRowIds = Array.isArray(view.cross_filter?.selected_indices)
    ? view.cross_filter.selected_indices.filter((value): value is number => typeof value === "number")
    : [];

  const selectionSource =
    typeof view.cross_filter?.selection_source === "string" ? view.cross_filter.selection_source : "saved-view";

  if (selectedRowIds.length > 0) {
    crossFilterStore.setSelection(selectionSource, selectedRowIds);
  } else {
    crossFilterStore.clearSelection();
  }

  useUndoRedoStore.getState().resetHistory();
}

export function FavouritesPanel() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const viewsQuery = useViewsList(datasetId);
  const saveView = useSaveView(datasetId);
  const renameView = useRenameView(datasetId);
  const deleteView = useDeleteView(datasetId);

  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleSaveCurrentView = async () => {
    if (!datasetId) {
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
    } catch (error) {
      window.alert(`Save view failed: ${getErrorMessage(error)}`);
    }
  };

  const handleDelete = async (viewId: string, name: string) => {
    if (!window.confirm(`Delete view "${name}"?`)) {
      return;
    }

    try {
      await deleteView.mutateAsync(viewId);
    } catch (error) {
      window.alert(`Delete failed: ${getErrorMessage(error)}`);
    }
  };

  const handleRename = async (viewId: string) => {
    const nextName = editingName.trim();
    if (!nextName) {
      return;
    }

    try {
      await renameView.mutateAsync({ viewId, name: nextName });
      setEditingViewId(null);
      setEditingName("");
    } catch (error) {
      window.alert(`Rename failed: ${getErrorMessage(error)}`);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Favourite Views</h2>
        <button
          type="button"
          onClick={() => {
            void handleSaveCurrentView();
          }}
          disabled={!datasetId || saveView.isPending}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Current View
        </button>
      </div>

      {viewsQuery.isLoading ? <p className="text-xs text-slate-500">Loading saved views...</p> : null}
      {viewsQuery.isError ? <p className="text-xs text-red-600">Failed to load saved views.</p> : null}

      {!viewsQuery.isLoading && (viewsQuery.data?.length ?? 0) === 0 ? (
        <p className="text-xs text-slate-500">No saved views yet.</p>
      ) : null}

      <ul className="space-y-2">
        {viewsQuery.data?.map((view) => {
          const isEditing = editingViewId === view.view_id;

          return (
            <li key={view.view_id} className="rounded-md border border-slate-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => restoreView(view)}
                  className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title={`Restore ${view.name}`}
                >
                  {view.name}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingViewId(view.view_id);
                      setEditingName(view.name);
                    }}
                    className="rounded px-1 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(view.view_id, view.name);
                    }}
                    className="rounded px-1 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-1 text-[11px] text-slate-500">{formatDate(view.created_at)}</p>

              {isEditing ? (
                <form
                  className="mt-2 flex items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRename(view.view_id);
                  }}
                >
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    aria-label="View name"
                  />
                  <button
                    type="submit"
                    className="rounded bg-lumina-600 px-2 py-1 text-xs font-medium text-white hover:bg-lumina-700"
                  >
                    Save
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
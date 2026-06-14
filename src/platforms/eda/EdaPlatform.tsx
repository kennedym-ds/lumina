import { DndContext, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartGrid } from "@/components/Chart/ChartGrid";
import { DraggableVariable } from "@/components/ChartBuilder/DraggableVariable";
import { useChartStore } from "@/stores/chartStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import type { ChartType, LuminaDtype } from "@/types/eda";

interface ActiveDragState {
  columnName: string;
  dtype: LuminaDtype;
}

export function EdaPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);

  const charts = useChartStore((state) => state.charts);
  const activeChartId = useChartStore((state) => state.activeChartId);
  const addChart = useChartStore((state) => state.addChart);
  const removeChart = useChartStore((state) => state.removeChart);
  const setActiveChart = useChartStore((state) => state.setActiveChart);
  const clearCharts = useChartStore((state) => state.clearCharts);
  const updateChart = useChartStore((state) => state.updateChart);

  const handleAddPreset = useCallback((chartType: ChartType) => {
    const chartId = addChart();
    updateChart(chartId, { chartType });
    setActiveChart(chartId);
  }, [addChart, updateChart, setActiveChart]);

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const [varsCollapsed, setVarsCollapsed] = useState(false);

  useEffect(() => {
    clearCharts();

    if (datasetId) {
      addChart();
    }

    useUndoRedoStore.getState().resetHistory();
  }, [datasetId, clearCharts, addChart]);

  const sortedColumns = useMemo(
    () => [...columns].sort((left, right) => left.name.localeCompare(right.name)),
    [columns],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const columnName = event.active.data.current?.columnName;
    const dtype = event.active.data.current?.dtype;

    if (typeof columnName === "string" && typeof dtype === "string") {
      setActiveDrag({
        columnName,
        dtype: dtype as LuminaDtype,
      });
    }
  };

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to open chart builder.
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveDrag(null)}
      onDragEnd={() => setActiveDrag(null)}
    >
      <div
        className={`grid h-full min-h-0 gap-3 ${
          varsCollapsed ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)]"
        }`}
      >
        {!varsCollapsed ? (
          <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Variables</h2>
              <button
                type="button"
                onClick={() => setVarsCollapsed(true)}
                aria-label="Collapse variables"
                title="Collapse variables panel"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                «
              </button>
            </div>

            <div className="space-y-2 overflow-auto">
              {sortedColumns.map((column) => (
                <DraggableVariable key={column.name} columnName={column.name} dtype={column.dtype} />
              ))}
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {varsCollapsed ? (
            <button
              type="button"
              onClick={() => setVarsCollapsed(false)}
              className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <span aria-hidden="true">»</span>
              <span>Show variables</span>
            </button>
          ) : null}

          <div className="min-h-0 min-w-0 flex-1">
            <ChartGrid
              charts={charts}
              activeChartId={activeChartId}
              onSetActiveChart={setActiveChart}
              onAddChart={addChart}
              onAddPreset={handleAddPreset}
              onRemoveChart={removeChart}
              datasetId={datasetId}
            />
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? (
          <div className="rounded-md border border-lumina-300 bg-lumina-50 px-2 py-1 text-sm text-slate-700 shadow-sm">
            <span className="mr-2">{activeDrag.dtype === "numeric" ? "📏" : activeDrag.dtype === "categorical" ? "🏷️" : activeDrag.dtype === "datetime" ? "📅" : activeDrag.dtype === "text" ? "📝" : "✅"}</span>
            {activeDrag.columnName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

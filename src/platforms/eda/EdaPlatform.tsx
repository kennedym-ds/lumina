import { DndContext, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { ChartGrid } from "@/components/Chart/ChartGrid";
import { DraggableVariable } from "@/components/ChartBuilder/DraggableVariable";
import { useChartStore } from "@/stores/chartStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import type { LuminaDtype } from "@/types/eda";

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

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);

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
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Variables</h2>

          <div className="space-y-2 overflow-auto">
            {sortedColumns.map((column) => (
              <DraggableVariable key={column.name} columnName={column.name} dtype={column.dtype} />
            ))}
          </div>
        </aside>

        <ChartGrid
          charts={charts}
          activeChartId={activeChartId}
          onSetActiveChart={setActiveChart}
          onAddChart={addChart}
          onRemoveChart={removeChart}
          datasetId={datasetId}
        />
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

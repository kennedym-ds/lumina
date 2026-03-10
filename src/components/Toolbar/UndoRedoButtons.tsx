import { useChartStore } from "@/stores/chartStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";

function cloneCharts() {
  return useChartStore
    .getState()
    .charts.map((chart) => ({
      ...chart,
    }));
}

export function UndoRedoButtons() {
  const canUndo = useUndoRedoStore((state) => state.canUndo);
  const canRedo = useUndoRedoStore((state) => state.canRedo);
  const undoLabel = useUndoRedoStore((state) => state.undoStack[state.undoStack.length - 1]?.label ?? "Undo");
  const redoLabel = useUndoRedoStore((state) => state.redoStack[state.redoStack.length - 1]?.label ?? "Redo");

  const handleUndo = () => {
    const chartState = useChartStore.getState();
    const snapshot = useUndoRedoStore.getState().undo({
      charts: cloneCharts(),
      activeChartId: chartState.activeChartId,
      label: "Undo",
    });

    if (!snapshot) {
      return;
    }

    useChartStore.getState().hydrateCharts(
      snapshot.charts.map((chart) => ({ ...chart })),
      snapshot.activeChartId,
    );
  };

  const handleRedo = () => {
    const chartState = useChartStore.getState();
    const snapshot = useUndoRedoStore.getState().redo({
      charts: cloneCharts(),
      activeChartId: chartState.activeChartId,
      label: "Redo",
    });

    if (!snapshot) {
      return;
    }

    useChartStore.getState().hydrateCharts(
      snapshot.charts.map((chart) => ({ ...chart })),
      snapshot.activeChartId,
    );
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleUndo}
        disabled={!canUndo}
        title={`Undo: ${undoLabel}`}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">↩</span>
        Undo
      </button>

      <button
        type="button"
        onClick={handleRedo}
        disabled={!canRedo}
        title={`Redo: ${redoLabel}`}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">↪</span>
        Redo
      </button>
    </div>
  );
}
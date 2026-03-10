import { beforeEach, describe, expect, it } from "vitest";
import type { ChartSnapshot } from "@/stores/undoRedoStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";

function createSnapshot(label: string): ChartSnapshot {
  return {
    label,
    activeChartId: `${label}-id`,
    charts: [
      {
        chartId: `${label}-id`,
        chartType: "histogram",
        x: "value",
        y: null,
        color: null,
        facet: null,
      },
    ],
  };
}

describe("undoRedoStore", () => {
  beforeEach(() => {
    useUndoRedoStore.getState().resetHistory();
  });

  it("initial state has empty stacks", () => {
    const state = useUndoRedoStore.getState();

    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it("pushSnapshot adds to undo stack", () => {
    useUndoRedoStore.getState().pushSnapshot(createSnapshot("Add Chart"));

    const state = useUndoRedoStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0]?.label).toBe("Add Chart");
    expect(state.canUndo).toBe(true);
  });

  it("undo returns previous snapshot", () => {
    const snapshot = createSnapshot("Add Chart");
    useUndoRedoStore.getState().pushSnapshot(snapshot);

    const previous = useUndoRedoStore.getState().undo(createSnapshot("Current"));
    const state = useUndoRedoStore.getState();

    expect(previous?.label).toBe("Add Chart");
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(1);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(true);
  });

  it("redo returns snapshot after undo", () => {
    useUndoRedoStore.getState().pushSnapshot(createSnapshot("Add Chart"));
    useUndoRedoStore.getState().undo(createSnapshot("Current"));

    const next = useUndoRedoStore.getState().redo(createSnapshot("Restored"));
    const state = useUndoRedoStore.getState();

    expect(next?.label).toBe("Current");
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(0);
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
  });

  it("undo clears redo stack on new push", () => {
    useUndoRedoStore.getState().pushSnapshot(createSnapshot("Add Chart"));
    useUndoRedoStore.getState().undo(createSnapshot("Current"));

    useUndoRedoStore.getState().pushSnapshot(createSnapshot("Change X axis"));

    const state = useUndoRedoStore.getState();
    expect(state.redoStack).toEqual([]);
    expect(state.canRedo).toBe(false);
  });

  it("max 50 entries in undo stack", () => {
    for (let index = 0; index < 60; index += 1) {
      useUndoRedoStore.getState().pushSnapshot(createSnapshot(`Action ${index}`));
    }

    const state = useUndoRedoStore.getState();
    expect(state.undoStack).toHaveLength(50);
    expect(state.undoStack[0]?.label).toBe("Action 10");
    expect(state.undoStack[49]?.label).toBe("Action 59");
  });

  it("resetHistory clears both stacks", () => {
    useUndoRedoStore.getState().pushSnapshot(createSnapshot("Add Chart"));
    useUndoRedoStore.getState().undo(createSnapshot("Current"));

    useUndoRedoStore.getState().resetHistory();

    const state = useUndoRedoStore.getState();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});
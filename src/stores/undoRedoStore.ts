import { create } from "zustand";
import type { ChartConfig } from "@/types/eda";

const MAX_HISTORY = 50;

export interface ChartSnapshot {
  charts: ChartConfig[];
  activeChartId: string | null;
  label: string;
}

interface UndoRedoState {
  undoStack: ChartSnapshot[];
  redoStack: ChartSnapshot[];
  pushSnapshot: (snapshot: ChartSnapshot) => void;
  undo: (currentSnapshot: ChartSnapshot) => ChartSnapshot | null;
  redo: (currentSnapshot: ChartSnapshot) => ChartSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: () => void;
}

function cloneCharts(charts: ChartConfig[]): ChartConfig[] {
  return charts.map((chart) => ({ ...chart }));
}

function cloneSnapshot(snapshot: ChartSnapshot): ChartSnapshot {
  return {
    charts: cloneCharts(snapshot.charts),
    activeChartId: snapshot.activeChartId,
    label: snapshot.label,
  };
}

function trimStack(stack: ChartSnapshot[]): ChartSnapshot[] {
  if (stack.length <= MAX_HISTORY) {
    return stack;
  }

  return stack.slice(stack.length - MAX_HISTORY);
}

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: (snapshot) => {
    const nextUndo = trimStack([...get().undoStack, cloneSnapshot(snapshot)]);

    set({
      undoStack: nextUndo,
      redoStack: [],
      canUndo: nextUndo.length > 0,
      canRedo: false,
    });
  },

  undo: (currentSnapshot) => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) {
      return null;
    }

    const previous = undoStack[undoStack.length - 1];
    const nextUndo = undoStack.slice(0, -1);
    const nextRedo = trimStack([...redoStack, cloneSnapshot(currentSnapshot)]);

    set({
      undoStack: nextUndo,
      redoStack: nextRedo,
      canUndo: nextUndo.length > 0,
      canRedo: nextRedo.length > 0,
    });

    return cloneSnapshot(previous);
  },

  redo: (currentSnapshot) => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) {
      return null;
    }

    const next = redoStack[redoStack.length - 1];
    const nextRedo = redoStack.slice(0, -1);
    const nextUndo = trimStack([...undoStack, cloneSnapshot(currentSnapshot)]);

    set({
      undoStack: nextUndo,
      redoStack: nextRedo,
      canUndo: nextUndo.length > 0,
      canRedo: nextRedo.length > 0,
    });

    return cloneSnapshot(next);
  },

  resetHistory: () => {
    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));
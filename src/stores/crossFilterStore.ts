import { create } from "zustand";

interface CrossFilterState {
  /** Sorted array of selected point indices from the source chart. */
  selectedIndices: number[];
  /** Chart ID that originated the current selection. */
  selectionSource: string | null;
  /** Set the cross-filter selection from a specific chart. */
  setSelection: (chartId: string, indices: number[]) => void;
  /** Clear the cross-filter selection. */
  clearSelection: () => void;
}

export const useCrossFilterStore = create<CrossFilterState>((set) => ({
  selectedIndices: [],
  selectionSource: null,
  setSelection: (chartId, indices) => {
    const sorted = [...indices].sort((a, b) => a - b);
    set({ selectedIndices: sorted, selectionSource: chartId });
  },
  clearSelection: () => set({ selectedIndices: [], selectionSource: null }),
}));

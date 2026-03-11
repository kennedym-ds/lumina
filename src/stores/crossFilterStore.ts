import { create } from "zustand";

interface CrossFilterState {
  /** Selected DataFrame row IDs from the source chart. */
  selectedRowIds: Set<number>;
  /** Chart ID that originated the current selection. */
  selectionSource: string | null;
  /** Set the cross-filter selection from a specific chart. */
  setSelection: (chartId: string, rowIds: number[]) => void;
  /** Clear the cross-filter selection. */
  clearSelection: () => void;
}

export const useCrossFilterStore = create<CrossFilterState>((set) => ({
  selectedRowIds: new Set(),
  selectionSource: null,
  setSelection: (chartId, rowIds) => {
    const normalized = [...new Set(rowIds)].sort((left, right) => left - right);
    set({ selectedRowIds: new Set(normalized), selectionSource: chartId });
  },
  clearSelection: () => set({ selectedRowIds: new Set(), selectionSource: null }),
}));

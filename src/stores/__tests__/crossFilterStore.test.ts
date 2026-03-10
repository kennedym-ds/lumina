import { describe, expect, it, beforeEach } from "vitest";
import { useCrossFilterStore } from "@/stores/crossFilterStore";

describe("crossFilterStore", () => {
  beforeEach(() => {
    useCrossFilterStore.getState().clearSelection();
  });

  it("has empty selection initially", () => {
    const state = useCrossFilterStore.getState();
    expect(state.selectedIndices).toEqual([]);
    expect(state.selectionSource).toBeNull();
  });

  it("setSelection stores sorted indices and source", () => {
    useCrossFilterStore.getState().setSelection("chart-1", [5, 2, 8, 1]);
    const state = useCrossFilterStore.getState();
    expect(state.selectedIndices).toEqual([1, 2, 5, 8]);
    expect(state.selectionSource).toBe("chart-1");
  });

  it("clearSelection resets state", () => {
    useCrossFilterStore.getState().setSelection("chart-1", [1, 2, 3]);
    useCrossFilterStore.getState().clearSelection();
    const state = useCrossFilterStore.getState();
    expect(state.selectedIndices).toEqual([]);
    expect(state.selectionSource).toBeNull();
  });

  it("setSelection replaces previous selection", () => {
    useCrossFilterStore.getState().setSelection("chart-1", [1, 2]);
    useCrossFilterStore.getState().setSelection("chart-2", [10, 20]);
    const state = useCrossFilterStore.getState();
    expect(state.selectedIndices).toEqual([10, 20]);
    expect(state.selectionSource).toBe("chart-2");
  });
});

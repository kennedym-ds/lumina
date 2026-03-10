// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

describe("useUnsavedChanges", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useChartStore.getState().clearCharts();
    useCrossFilterStore.getState().clearSelection();
    useRegressionStore.getState().reset();
  });

  it("isDirty starts false", () => {
    const { result } = renderHook(() => useUnsavedChanges());
    expect(result.current.isDirty).toBe(false);
  });

  it("isDirty becomes true on store change", () => {
    const { result } = renderHook(() => useUnsavedChanges());

    act(() => {
      useDatasetStore.getState().setLoading(true);
    });

    expect(result.current.isDirty).toBe(true);
  });
});
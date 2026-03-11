// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";

describe("useUnsavedChanges", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useChartStore.getState().clearCharts();
    useCrossFilterStore.getState().clearSelection();
    useDashboardStore.getState().clearDashboard();
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

  it("tracks dashboard layout changes", () => {
    const { result } = renderHook(() => useUnsavedChanges());

    act(() => {
      useDashboardStore.getState().hydrate([
        {
          id: "panel-1",
          chartId: "chart-1",
          x: 0,
          y: 0,
          w: 3,
          h: 2,
        },
      ]);
    });

    expect(result.current.isDirty).toBe(true);
  });
});
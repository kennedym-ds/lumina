import { beforeEach, describe, expect, it } from "vitest";
import { useChartStore } from "@/stores/chartStore";

describe("chartStore", () => {
  beforeEach(() => {
    useChartStore.getState().clearCharts();
  });

  it("hydrate charts replaces existing", () => {
    const existingId = useChartStore.getState().addChart();

    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-a",
          chartType: "histogram",
          x: "value",
          y: null,
          color: null,
          facet: null,
        },
        {
          chartId: "chart-b",
          chartType: "scatter",
          x: "x",
          y: "y",
          color: null,
          facet: null,
        },
      ],
      "chart-b",
    );

    const state = useChartStore.getState();
    expect(state.charts).toHaveLength(2);
    expect(state.activeChartId).toBe("chart-b");
    expect(state.charts.some((chart) => chart.chartId === existingId)).toBe(false);
  });
});
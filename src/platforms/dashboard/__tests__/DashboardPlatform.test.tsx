// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPlatform } from "@/platforms/dashboard/DashboardPlatform";
import { useChartStore } from "@/stores/chartStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import type { ChartConfig, ChartResponse } from "@/types/eda";

vi.mock("@/api/eda", () => ({
  useChartData: (_datasetId: string | null, chartConfig: ChartConfig | null) => ({
    data: chartConfig
      ? ({
          chart_id: chartConfig.chartId,
          chart_type: chartConfig.chartType,
          plotly_figure: { data: [], layout: {} },
          row_count: 0,
          webgl: false,
          warnings: [],
          downsampled: false,
          displayed_row_count: null,
        } satisfies ChartResponse)
      : undefined,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/Chart/PlotlyChart", () => ({
  PlotlyChart: ({ chartResponse }: { chartResponse?: ChartResponse }) => (
    <div data-testid={`plotly-${chartResponse?.chart_id ?? "empty"}`}>Plotly chart</div>
  ),
}));

describe("DashboardPlatform", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useChartStore.getState().clearCharts();
    useDashboardStore.getState().clearDashboard();
    useCrossFilterStore.getState().clearSelection();

    useDatasetStore.getState().setDataset({
      dataset_id: "ds_1",
      file_name: "sample.csv",
      file_format: "csv",
      row_count: 25,
      column_count: 2,
      columns: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when no panels exist", () => {
    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-1",
          chartType: "scatter",
          x: "x",
          y: "y",
          color: null,
          facet: null,
        },
      ],
      "chart-1",
    );

    render(<DashboardPlatform />);

    expect(screen.getByText("No charts on this dashboard yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add your first chart" })).toBeTruthy();
  });

  it("renders dashboard panels when panels exist", () => {
    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-1",
          chartType: "scatter",
          x: "x",
          y: "y",
          color: null,
          facet: null,
        },
      ],
      "chart-1",
    );
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

    render(<DashboardPlatform />);

    expect(screen.getByTestId("dashboard-panel-panel-1")).toBeTruthy();
    expect(screen.getByTestId("plotly-chart-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove panel" })).toBeTruthy();
  });

  it("adds a panel from the selected chart", async () => {
    const user = userEvent.setup();

    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-1",
          chartType: "scatter",
          x: "x",
          y: "y",
          color: null,
          facet: null,
        },
      ],
      "chart-1",
    );

    render(<DashboardPlatform />);

    await user.click(screen.getByRole("button", { name: "Add your first chart" }));

    expect(useDashboardStore.getState().panels).toHaveLength(1);
    expect(screen.getByTestId("dashboard-panel")).toBeTruthy();
  });
});

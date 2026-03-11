// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartPanel } from "@/components/ChartBuilder/ChartPanel";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";

vi.mock("@/api/eda", () => ({
  useChartData: () => ({
    data: undefined,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/Chart/PlotlyChart", () => ({
  PlotlyChart: () => <div data-testid="plotly-chart">Plotly Chart</div>,
}));

describe("ChartPanel", () => {
  beforeEach(() => {
    useChartStore.getState().clearCharts();
    useCrossFilterStore.getState().clearSelection();
    useDatasetStore.getState().clearDataset();

    useDatasetStore.getState().hydrate({
      datasetId: "dataset-1",
      fileName: "demo.csv",
      fileFormat: "csv",
      columns: [
        { name: "region", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 4 },
        { name: "segment", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 3 },
        { name: "sales", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 20 },
        { name: "date", dtype: "datetime", original_dtype: "datetime64[ns]", missing_count: 0, unique_count: 20 },
      ],
      rowCount: 20,
      columnCount: 4,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows heatmap controls without the color shelf", () => {
    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-heatmap",
          chartType: "heatmap",
          x: "segment",
          y: "region",
          color: null,
          facet: null,
          aggregation: null,
          values: null,
        },
      ],
      "chart-heatmap",
    );

    render(
      <DndContext>
        <ChartPanel chartId="chart-heatmap" datasetId="dataset-1" />
      </DndContext>,
    );

    expect(screen.getByText(/x axis/i)).toBeTruthy();
    expect(screen.getByText(/y axis/i)).toBeTruthy();
    expect(screen.queryByText(/^color$/i)).toBeNull();
    expect(screen.getByLabelText(/heatmap aggregation/i)).toBeTruthy();
  });

  it("shows optional values for pie charts and only x shelf for qq plots", () => {
    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-pie",
          chartType: "pie",
          x: "region",
          y: null,
          color: null,
          facet: null,
          aggregation: null,
          values: "sales",
        },
      ],
      "chart-pie",
    );

    const { rerender } = render(
      <DndContext>
        <ChartPanel chartId="chart-pie" datasetId="dataset-1" />
      </DndContext>,
    );

    expect(screen.getByLabelText(/values column/i)).toBeTruthy();
    expect(screen.queryByText(/y axis/i)).toBeNull();

    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-qq",
          chartType: "qq_plot",
          x: "sales",
          y: null,
          color: null,
          facet: null,
          aggregation: null,
          values: null,
        },
      ],
      "chart-qq",
    );

    rerender(
      <DndContext>
        <ChartPanel chartId="chart-qq" datasetId="dataset-1" />
      </DndContext>,
    );

    expect(screen.getByText(/x axis/i)).toBeTruthy();
    expect(screen.queryByText(/y axis/i)).toBeNull();
    expect(screen.queryByText(/^color$/i)).toBeNull();
    expect(screen.queryByText(/^facet$/i)).toBeNull();
  });

  it("reveals the values selector for heatmap sum aggregation", () => {
    useChartStore.getState().hydrateCharts(
      [
        {
          chartId: "chart-heatmap-sum",
          chartType: "heatmap",
          x: "segment",
          y: "region",
          color: null,
          facet: null,
          aggregation: null,
          values: null,
        },
      ],
      "chart-heatmap-sum",
    );

    render(
      <DndContext>
        <ChartPanel chartId="chart-heatmap-sum" datasetId="dataset-1" />
      </DndContext>,
    );

    fireEvent.change(screen.getByLabelText(/heatmap aggregation/i), { target: { value: "sum" } });

    expect(screen.getByLabelText(/values column/i)).toBeTruthy();
  });
});

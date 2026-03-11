// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlotlyChart } from "@/components/Chart/PlotlyChart";
import type { ChartResponse } from "@/types/eda";

let lastPlotProps: Record<string, unknown> | null = null;

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => {
    return function MockPlot(props: Record<string, unknown>) {
      lastPlotProps = props;
      return <div data-testid="plotly-mock" />;
    };
  },
}));

function makeChartResponse(data: Array<Record<string, unknown>>): ChartResponse {
  return {
    chart_id: "chart-1",
    chart_type: "scatter",
    plotly_figure: {
      data,
      layout: {},
    },
    row_count: 3,
    webgl: false,
    warnings: [],
    downsampled: false,
    displayed_row_count: null,
  };
}

function getRenderedData(): Array<Record<string, unknown>> {
  return ((lastPlotProps?.data as Array<Record<string, unknown>> | undefined) ?? []);
}

describe("PlotlyChart", () => {
  beforeEach(() => {
    lastPlotProps = null;
  });

  it("extracts row IDs from customdata on selection", () => {
    const onSelected = vi.fn();

    render(
      <PlotlyChart
        chartResponse={makeChartResponse([
          { type: "scatter", mode: "markers", x: [1, 2, 3], y: [3, 4, 5], customdata: [10, 11, 12] },
        ])}
        isLoading={false}
        onSelected={onSelected}
      />,
    );

    act(() => {
      const handler = lastPlotProps?.onSelected as
        | ((event: { points: Array<{ pointIndex: number; customdata?: number }> }) => void)
        | undefined;
      handler?.({
        points: [
          { pointIndex: 1, customdata: 11 },
          { pointIndex: 2, customdata: 12 },
        ],
      });
    });

    expect(onSelected).toHaveBeenCalledWith([11, 12]);
  });

  it("dims non-source traces using selected row IDs from customdata", () => {
    render(
      <PlotlyChart
        chartResponse={makeChartResponse([
          { type: "scatter", mode: "markers", x: [1, 2, 3], y: [3, 4, 5], customdata: [10, 11, 12] },
        ])}
        isLoading={false}
        selectedRowIds={new Set([11])}
      />,
    );

    expect(getRenderedData()).toEqual([
      expect.objectContaining({
        selectedpoints: [1],
        marker: expect.objectContaining({ opacity: [0.15, 1, 0.15] }),
      }),
    ]);
  });

  it("maps source-chart selection highlights from row IDs back to trace indices", () => {
    render(
      <PlotlyChart
        chartResponse={makeChartResponse([
          { type: "scatter", mode: "markers", x: [1, 2, 3], y: [3, 4, 5], customdata: [10, 11, 12] },
        ])}
        isLoading={false}
        selectedRowIds={new Set([10, 12])}
        isSelectionSource
      />,
    );

    expect(getRenderedData()).toEqual([
      expect.objectContaining({
        selectedpoints: [0, 2],
      }),
    ]);
  });

  it("leaves aggregated traces untouched when customdata is missing", () => {
    render(
      <PlotlyChart
        chartResponse={makeChartResponse([
          { type: "histogram", x: [1, 2, 3] },
        ])}
        isLoading={false}
        selectedRowIds={new Set([1])}
      />,
    );

    expect(getRenderedData()).toEqual([
      expect.not.objectContaining({
        selectedpoints: expect.anything(),
      }),
    ]);
    expect(getRenderedData()[0]?.marker).toBeUndefined();
  });
});

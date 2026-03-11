// @vitest-environment jsdom

import React from "react";
import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartGrid } from "@/components/Chart/ChartGrid";
import { ChartTypeSelector } from "@/components/ChartBuilder/ChartTypeSelector";
import { VariableShelf } from "@/components/ChartBuilder/VariableShelf";
import { useChartStore } from "@/stores/chartStore";
import type { ChartConfig } from "@/types/eda";

vi.mock("@/components/ChartBuilder/ChartPanel", () => ({
  ChartPanel: ({ chartId }: { chartId: string }) => <div data-testid={`chart-panel-${chartId}`}>Chart Panel</div>,
}));

describe("ChartBuilder", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useChartStore.getState().clearCharts();
  });

  it("renders chart type selector with 11 options", () => {
    render(<ChartTypeSelector value="histogram" onChange={() => undefined} />);

    expect(screen.getAllByRole("button")).toHaveLength(11);
    expect(screen.getByRole("button", { name: /violin/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /heatmap/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /density/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^pie$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /area/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /q-q plot/i })).toBeTruthy();
  });

  it("switching chart type updates active button", async () => {
    function Wrapper() {
      const [type, setType] = React.useState<ChartConfig["chartType"]>("histogram");
      return <ChartTypeSelector value={type} onChange={setType} />;
    }

    render(<Wrapper />);

    const scatterButton = screen.getByRole("button", { name: /scatter/i });
    fireEvent.click(scatterButton);

    expect(scatterButton.getAttribute("data-active")).toBe("true");
  });

  it("renders variable shelves", () => {
    render(
      <DndContext>
        <div>
          <VariableShelf shelfType="x" value={null} onDrop={() => undefined} onRemove={() => undefined} />
          <VariableShelf shelfType="y" value={null} onDrop={() => undefined} onRemove={() => undefined} />
          <VariableShelf shelfType="color" value={null} onDrop={() => undefined} onRemove={() => undefined} />
          <VariableShelf shelfType="facet" value={null} onDrop={() => undefined} onRemove={() => undefined} />
        </div>
      </DndContext>,
    );

    expect(screen.getByText(/x axis/i)).toBeTruthy();
    expect(screen.getByText(/y axis/i)).toBeTruthy();
    expect(screen.getByText(/color/i)).toBeTruthy();
    expect(screen.getByText(/facet/i)).toBeTruthy();
  });

  it("renders chart grid with add button", () => {
    const chart: ChartConfig = {
      chartId: "chart-1",
      chartType: "histogram",
      x: null,
      y: null,
      color: null,
      facet: null,
    };

    render(
      <ChartGrid
        charts={[chart]}
        activeChartId={chart.chartId}
        onSetActiveChart={() => undefined}
        onAddChart={() => undefined}
        onRemoveChart={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /add chart/i })).toBeTruthy();
  });

  it("chart store: addChart creates new chart", () => {
    const chartId = useChartStore.getState().addChart();
    const state = useChartStore.getState();

    expect(chartId).toBeTruthy();
    expect(state.charts.some((chart) => chart.chartId === chartId)).toBe(true);
  });

  it("chart store: removeChart removes chart", () => {
    const chartId = useChartStore.getState().addChart();
    useChartStore.getState().removeChart(chartId);

    expect(useChartStore.getState().charts.some((chart) => chart.chartId === chartId)).toBe(false);
  });

  it("chart store: max 8 charts", () => {
    for (let index = 0; index < 10; index += 1) {
      useChartStore.getState().addChart();
    }

    expect(useChartStore.getState().charts.length).toBe(8);
  });
});

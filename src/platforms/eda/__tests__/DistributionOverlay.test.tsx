// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DistributionOverlay } from "@/platforms/eda/DistributionOverlay";
import { useDatasetStore } from "@/stores/datasetStore";
import type { DistributionResponse } from "@/types/eda";

const useDistribution = vi.fn();

let lastPlotProps: Record<string, unknown> | null = null;

vi.mock("@/api/eda", async () => {
  const actual = await vi.importActual<typeof import("@/api/eda")>("@/api/eda");

  return {
    ...actual,
    useDistribution: (datasetId: string | null, column: string | null, groupBy: string | null) =>
      useDistribution(datasetId, column, groupBy),
  };
});

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => {
    return function MockPlot(props: Record<string, unknown>) {
      lastPlotProps = props;
      return <div data-testid="distribution-plot" />;
    };
  },
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={createClient()}>{ui}</QueryClientProvider>);
}

const distributionFixture: DistributionResponse = {
  column: "value",
  group_by: "category",
  traces: [
    { group: "A", x: [1, 2, 3], y: [0.1, 0.2, 0.1] },
    { group: "B", x: [1, 2, 3], y: [0.15, 0.1, 0.05] },
  ],
};

describe("DistributionOverlay", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useDistribution.mockReset();
    lastPlotProps = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when no dataset is loaded", () => {
    useDistribution.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderWithQuery(<DistributionOverlay />);

    expect(screen.getByText("Import a dataset to compare distributions.")).toBeTruthy();
  });

  it("renders selectors and KDE line traces for numeric vs grouped columns", () => {
    useDatasetStore.getState().setDataset({
      dataset_id: "ds_1",
      file_name: "sample.csv",
      file_format: "csv",
      row_count: 100,
      column_count: 4,
      columns: [
        { name: "value", dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 100 },
        { name: "score", dtype: "numeric", original_dtype: "int64", missing_count: 0, unique_count: 100 },
        { name: "category", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 4 },
        { name: "name", dtype: "text", original_dtype: "object", missing_count: 0, unique_count: 100 },
      ],
    });

    useDistribution.mockReturnValue({
      data: distributionFixture,
      isLoading: false,
      error: null,
    });

    renderWithQuery(<DistributionOverlay />);

    expect(screen.getByLabelText("Numeric column")).toBeTruthy();
    expect(screen.getByLabelText("Group by column")).toBeTruthy();
    expect(screen.getByTestId("distribution-plot")).toBeTruthy();
    expect(useDistribution).toHaveBeenCalledWith("ds_1", "value", "category");
    expect(lastPlotProps?.data).toEqual([
      expect.objectContaining({ type: "scatter", mode: "lines", name: "A", x: [1, 2, 3], y: [0.1, 0.2, 0.1] }),
      expect.objectContaining({ type: "scatter", mode: "lines", name: "B", x: [1, 2, 3], y: [0.15, 0.1, 0.05] }),
    ]);
  });
});
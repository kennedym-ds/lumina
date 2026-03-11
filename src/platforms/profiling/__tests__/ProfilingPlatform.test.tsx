// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProfilingPlatform } from "@/platforms/profiling/ProfilingPlatform";
import { useDatasetStore } from "@/stores/datasetStore";
import type { CorrelationResponse, DatasetProfile } from "@/types/profiling";

const useDatasetProfile = vi.fn();
const useCorrelation = vi.fn();

let lastPlotProps: Record<string, unknown> | null = null;

vi.mock("@/api/profiling", () => ({
  useDatasetProfile: (datasetId: string | null) => useDatasetProfile(datasetId),
  useCorrelation: (datasetId: string | null, method: string) => useCorrelation(datasetId, method),
}));

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => {
    return function MockPlot(props: Record<string, unknown>) {
      lastPlotProps = props;
      return <div data-testid="correlation-plot" />;
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

const profileFixture: DatasetProfile = {
  dataset_id: "ds_1",
  row_count: 120,
  column_count: 2,
  total_memory_bytes: 4096,
  duplicate_row_count: 3,
  columns: [
    {
      name: "value",
      dtype: "numeric",
      total_count: 120,
      missing_count: 2,
      missing_pct: 1.67,
      unique_count: 118,
      mean: 10.5,
      std: 2.1,
      min: 1,
      max: 20,
      median: 10,
      q1: 8,
      q3: 12,
      skewness: 0.4,
      kurtosis: 1.2,
      zeros_count: 0,
      histogram_bins: [0, 5, 10, 15, 20],
      histogram_counts: [4, 10, 20, 6],
      top_values: null,
      memory_bytes: 1024,
    },
    {
      name: "species",
      dtype: "categorical",
      total_count: 120,
      missing_count: 0,
      missing_pct: 0,
      unique_count: 3,
      mean: null,
      std: null,
      min: null,
      max: null,
      median: null,
      q1: null,
      q3: null,
      skewness: null,
      kurtosis: null,
      zeros_count: null,
      histogram_bins: null,
      histogram_counts: null,
      top_values: [
        { value: "cat", count: 60, pct: 50 },
        { value: "dog", count: 40, pct: 33.33 },
      ],
      memory_bytes: 512,
    },
  ],
};

const correlationFixture: CorrelationResponse = {
  method: "pearson",
  columns: ["value", "other"],
  matrix: [
    [1, 0.42],
    [0.42, 1],
  ],
};

describe("ProfilingPlatform", () => {
  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useDatasetProfile.mockReset();
    useCorrelation.mockReset();
    lastPlotProps = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when no dataset is loaded", () => {
    useDatasetProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    useCorrelation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderWithQuery(<ProfilingPlatform />);

    expect(screen.getByText("Import a dataset to see profiling report.")).toBeTruthy();
  });

  it("renders summary cards and column details", () => {
    useDatasetStore.getState().setDataset({
      dataset_id: "ds_1",
      file_name: "sample.csv",
      file_format: "csv",
      row_count: 120,
      column_count: 2,
      columns: [],
    });

    useDatasetProfile.mockReturnValue({
      data: profileFixture,
      isLoading: false,
      error: null,
    });
    useCorrelation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderWithQuery(<ProfilingPlatform />);

    expect(screen.getByText("Rows")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("Duplicate Rows")).toBeTruthy();
    expect(screen.getByText("value")).toBeTruthy();
    expect(screen.getByText("species")).toBeTruthy();
    expect(screen.getByTitle("cat")).toBeTruthy();
  });

  it("renders the correlation heatmap when numeric correlations are available", () => {
    useDatasetStore.getState().setDataset({
      dataset_id: "ds_1",
      file_name: "sample.csv",
      file_format: "csv",
      row_count: 120,
      column_count: 2,
      columns: [],
    });

    useDatasetProfile.mockReturnValue({
      data: profileFixture,
      isLoading: false,
      error: null,
    });
    useCorrelation.mockReturnValue({
      data: correlationFixture,
      isLoading: false,
      error: null,
    });

    renderWithQuery(<ProfilingPlatform />);

    expect(screen.getByText("Correlation Matrix")).toBeTruthy();
    expect(screen.getByTestId("correlation-plot")).toBeTruthy();
    expect(useCorrelation).toHaveBeenCalledWith("ds_1", "pearson");
    expect(lastPlotProps?.data).toEqual([
      expect.objectContaining({
        type: "heatmap",
        x: ["value", "other"],
        y: ["value", "other"],
        z: correlationFixture.matrix,
      }),
    ]);
  });
});

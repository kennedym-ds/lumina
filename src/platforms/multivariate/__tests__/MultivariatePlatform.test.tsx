// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MultivariatePlatform } from "@/platforms/multivariate/MultivariatePlatform";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ColumnInfo } from "@/types/data";

const pcaMutate = vi.fn();
const clusteringMutate = vi.fn();

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => () => <div data-testid="plotly-mock" />,
}));
vi.mock("@/api/multivariate", () => ({
  usePca: () => ({ mutate: pcaMutate, isPending: false, data: undefined, isError: false }),
  useClustering: () => ({ mutate: clusteringMutate, isPending: false, data: undefined, isError: false }),
}));

function numericColumn(name: string): ColumnInfo {
  return { name, dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 20 };
}

describe("MultivariatePlatform", () => {
  beforeEach(() => {
    pcaMutate.mockReset();
    clusteringMutate.mockReset();
    useDatasetStore.setState({
      datasetId: "ds-mv",
      columns: [numericColumn("sepal_length"), numericColumn("sepal_width"), numericColumn("petal_length")],
    });
  });

  afterEach(() => {
    cleanup();
    useDatasetStore.setState({ datasetId: null, columns: [] });
  });

  it("renders column checkboxes for all numeric columns", () => {
    render(<MultivariatePlatform />);

    expect(screen.getByLabelText("Include column sepal_length")).toBeTruthy();
    expect(screen.getByLabelText("Include column sepal_width")).toBeTruthy();
    expect(screen.getByLabelText("Include column petal_length")).toBeTruthy();
  });

  it("calls usePca mutate with all numeric columns when Run PCA is clicked", () => {
    render(<MultivariatePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Run PCA" }));

    expect(pcaMutate).toHaveBeenCalledWith({
      columns: ["sepal_length", "sepal_width", "petal_length"],
    });
  });

  it("calls useClustering mutate with selected columns and k when Cluster is clicked", () => {
    render(<MultivariatePlatform />);

    fireEvent.change(screen.getByLabelText("Number of clusters"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Cluster" }));

    expect(clusteringMutate).toHaveBeenCalledWith({
      columns: ["sepal_length", "sepal_width", "petal_length"],
      n_clusters: 4,
    });
  });

  it("prompts to import when no dataset is loaded", () => {
    useDatasetStore.setState({ datasetId: null, columns: [] });
    render(<MultivariatePlatform />);

    expect(screen.getByText(/Import a dataset/i)).toBeTruthy();
  });

  it("shows no-numeric-columns message when dataset has no numeric columns", () => {
    useDatasetStore.setState({
      datasetId: "ds-text",
      columns: [{ name: "name", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 5 }],
    });
    render(<MultivariatePlatform />);

    expect(screen.getByText(/no numeric columns/i)).toBeTruthy();
  });
});

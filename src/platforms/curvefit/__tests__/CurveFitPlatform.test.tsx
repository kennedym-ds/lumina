// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CurveFitPlatform } from "@/platforms/curvefit/CurveFitPlatform";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ColumnInfo } from "@/types/data";

const fitMutate = vi.fn();

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => () => <div data-testid="plotly-mock" />,
}));
vi.mock("@/api/curve_fit", () => ({
  useCurveFitModels: () => ({
    data: [
      { name: "linear", param_names: ["a", "b"] },
      { name: "exponential", param_names: ["a", "b", "c"] },
      { name: "gaussian", param_names: ["a", "b", "c"] },
    ],
  }),
  useFitCurve: () => ({ mutate: fitMutate, isPending: false, data: undefined, isError: false }),
}));

function numericColumn(name: string): ColumnInfo {
  return { name, dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 20 };
}

describe("CurveFitPlatform", () => {
  beforeEach(() => {
    fitMutate.mockReset();
    useDatasetStore.setState({
      datasetId: "ds-cf",
      columns: [numericColumn("x"), numericColumn("y"), numericColumn("z")],
    });
  });

  afterEach(() => {
    cleanup();
    useDatasetStore.setState({ datasetId: null, columns: [] });
  });

  it("renders column selects for X and Y with numeric columns", () => {
    render(<CurveFitPlatform />);

    expect(screen.getByLabelText("X column")).toBeTruthy();
    expect(screen.getByLabelText("Y column")).toBeTruthy();
  });

  it("renders model select with models from the API", () => {
    render(<CurveFitPlatform />);

    const modelSelect = screen.getByLabelText("Model");
    expect(modelSelect).toBeTruthy();
    expect(screen.getByText("linear")).toBeTruthy();
    expect(screen.getByText("exponential")).toBeTruthy();
  });

  it("calls useFitCurve mutate with chosen x/y/model when Fit is clicked", () => {
    render(<CurveFitPlatform />);

    // Change X to "z"
    fireEvent.change(screen.getByLabelText("X column"), { target: { value: "z" } });
    // Change Y to "x"
    fireEvent.change(screen.getByLabelText("Y column"), { target: { value: "x" } });
    // Change model to exponential
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "exponential" } });

    fireEvent.click(screen.getByRole("button", { name: "Fit" }));

    expect(fitMutate).toHaveBeenCalledWith({
      x_column: "z",
      y_column: "x",
      model_name: "exponential",
    });
  });

  it("prompts to import when no dataset is loaded", () => {
    useDatasetStore.setState({ datasetId: null, columns: [] });
    render(<CurveFitPlatform />);

    expect(screen.getByText(/Import a dataset/i)).toBeTruthy();
  });

  it("shows no-columns message when dataset has fewer than 2 numeric columns", () => {
    useDatasetStore.setState({
      datasetId: "ds-text",
      columns: [{ name: "name", dtype: "categorical", original_dtype: "object", missing_count: 0, unique_count: 5 }],
    });
    render(<CurveFitPlatform />);

    expect(screen.getByText(/no numeric columns/i)).toBeTruthy();
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QualityPlatform } from "@/platforms/spc/QualityPlatform";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ColumnInfo } from "@/types/data";

const controlChartMutate = vi.fn();
const capabilityMutate = vi.fn();

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => () => <div data-testid="plotly-mock" />,
}));
vi.mock("@/api/spc", () => ({
  useControlChart: () => ({ mutate: controlChartMutate, isPending: false, data: undefined, isError: false }),
  useCapability: () => ({ mutate: capabilityMutate, isPending: false, data: undefined, isError: false }),
}));

function numericColumn(name: string): ColumnInfo {
  return { name, dtype: "numeric", original_dtype: "float64", missing_count: 0, unique_count: 10 };
}

describe("QualityPlatform", () => {
  beforeEach(() => {
    controlChartMutate.mockReset();
    capabilityMutate.mockReset();
    useDatasetStore.setState({ datasetId: "ds-1", columns: [numericColumn("diameter"), numericColumn("weight")] });
  });

  afterEach(() => {
    cleanup();
    useDatasetStore.setState({ datasetId: null, columns: [] });
  });

  it("builds a control chart for the selected column", () => {
    render(<QualityPlatform />);

    fireEvent.click(screen.getByRole("button", { name: "Build Control Chart" }));

    expect(controlChartMutate).toHaveBeenCalledWith({ column: "diameter", subgroup_size: 1 });
  });

  it("computes capability with the entered spec limits", () => {
    render(<QualityPlatform />);

    fireEvent.change(screen.getByLabelText("Lower spec limit"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Upper spec limit"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Compute Capability" }));

    expect(capabilityMutate).toHaveBeenCalledWith(
      expect.objectContaining({ column: "diameter", lsl: 9, usl: 11 }),
    );
  });

  it("prompts to import when no dataset is loaded", () => {
    useDatasetStore.setState({ datasetId: null, columns: [] });
    render(<QualityPlatform />);

    expect(screen.getByText(/Import a dataset/i)).toBeTruthy();
  });
});

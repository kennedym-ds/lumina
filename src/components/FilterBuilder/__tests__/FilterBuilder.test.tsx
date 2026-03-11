// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBuilder } from "@/components/FilterBuilder/FilterBuilder";
import { useDatasetStore } from "@/stores/datasetStore";
import { useFilterStore } from "@/stores/filterStore";

const useApplyFiltersMock = vi.fn();

vi.mock("@/api/filters", () => ({
  useApplyFilters: (datasetId: string | null) => useApplyFiltersMock(datasetId),
}));

describe("FilterBuilder", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useApplyFiltersMock.mockReset();
    useFilterStore.getState().clearFilters();
    useDatasetStore.getState().clearDataset();
    useDatasetStore.getState().hydrate({
      datasetId: "dataset-1",
      fileName: "penguins.csv",
      fileFormat: "csv",
      rowCount: 344,
      columnCount: 2,
      columns: [
        {
          name: "age",
          dtype: "numeric",
          original_dtype: "int64",
          missing_count: 0,
          unique_count: 50,
        },
        {
          name: "species",
          dtype: "categorical",
          original_dtype: "object",
          missing_count: 0,
          unique_count: 3,
        },
      ],
    });
  });

  it("adds a filter row and applies the current filters", async () => {
    const mutate = vi.fn();
    useApplyFiltersMock.mockReturnValue({ mutate, isPending: false, data: null });

    render(<FilterBuilder />);

    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    await userEvent.click(screen.getByRole("button", { name: /add filter/i }));

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1]!, ">");
    const valueInput = screen.getByPlaceholderText(/value/i);
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, "30");

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(mutate).toHaveBeenCalledWith({
      filters: [{ column: "age", operator: ">", value: "30" }],
      logic: "and",
    });
  });

  it("clears all filters locally and on the backend", async () => {
    const mutate = vi.fn();
    useApplyFiltersMock.mockReturnValue({ mutate, isPending: false, data: null });

    useFilterStore.getState().hydrateFilters([
      {
        id: "filter-1",
        column: "species",
        operator: "==",
        value: "Adelie",
      },
    ]);

    render(<FilterBuilder />);

    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(mutate).toHaveBeenCalledWith({ filters: [], logic: "and" });
    await waitFor(() => {
      expect(useFilterStore.getState().filters).toEqual([]);
    });
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VariableList } from "@/components/Sidebar/VariableList";
import { useDatasetStore } from "@/stores/datasetStore";

const useCastColumnMock = vi.fn();
const useUpdateColumnConfigMock = vi.fn();

vi.mock("@/api/data", () => ({
  useCastColumn: (datasetId: string | null) => useCastColumnMock(datasetId),
  useUpdateColumnConfig: (datasetId: string | null) => useUpdateColumnConfigMock(datasetId),
}));

describe("VariableList", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useDatasetStore.getState().hydrate({
      datasetId: "dataset-1",
      fileName: "demo.csv",
      fileFormat: "csv",
      columns: [
        {
          name: "id",
          dtype: "numeric",
          original_dtype: "int64",
          missing_count: 0,
          unique_count: 3,
        },
        {
          name: "name",
          dtype: "text",
          original_dtype: "object",
          missing_count: 0,
          unique_count: 3,
        },
      ],
      rowCount: 3,
      columnCount: 2,
    });

    useUpdateColumnConfigMock.mockReset();
    useCastColumnMock.mockReset();
    useCastColumnMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it("hides a visible column and tracks it as excluded", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ok: true,
      columns: [
        {
          name: "id",
          dtype: "numeric",
          original_dtype: "int64",
          missing_count: 0,
          unique_count: 3,
        },
      ],
    });
    useUpdateColumnConfigMock.mockReturnValue({ mutateAsync, isPending: false });

    render(<VariableList />);

    await userEvent.click(screen.getByRole("button", { name: /hide column name/i }));

    expect(mutateAsync).toHaveBeenCalledWith([{ name: "name", excluded: true }]);

    await waitFor(() => {
      expect(useDatasetStore.getState().columns.map((column) => column.name)).toEqual(["id"]);
      expect(Array.from(useDatasetStore.getState().excludedColumns)).toEqual(["name"]);
    });

    expect(screen.getByText("name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /re-include column name/i })).toBeTruthy();
  });

  it("re-includes a hidden column", async () => {
    useDatasetStore.getState().toggleColumnExclusion("name");
    useDatasetStore.getState().updateColumns([
      {
        name: "id",
        dtype: "numeric",
        original_dtype: "int64",
        missing_count: 0,
        unique_count: 3,
      },
    ]);

    const mutateAsync = vi.fn().mockResolvedValue({
      ok: true,
      columns: [
        {
          name: "id",
          dtype: "numeric",
          original_dtype: "int64",
          missing_count: 0,
          unique_count: 3,
        },
        {
          name: "name",
          dtype: "text",
          original_dtype: "object",
          missing_count: 0,
          unique_count: 3,
        },
      ],
    });
    useUpdateColumnConfigMock.mockReturnValue({ mutateAsync, isPending: false });

    render(<VariableList />);

    await userEvent.click(screen.getByRole("button", { name: /re-include column name/i }));

    expect(mutateAsync).toHaveBeenCalledWith([{ name: "name", excluded: false }]);

    await waitFor(() => {
      expect(useDatasetStore.getState().columns.map((column) => column.name)).toEqual(["id", "name"]);
      expect(Array.from(useDatasetStore.getState().excludedColumns)).toEqual([]);
    });
  });

  it("renders cast controls and applies a type override", async () => {
    const updateColumnConfig = vi.fn().mockResolvedValue({ ok: true, columns: useDatasetStore.getState().columns });
    const castColumn = vi.fn().mockResolvedValue({
      ok: true,
      columns: [
        {
          name: "id",
          dtype: "numeric",
          original_dtype: "int64",
          missing_count: 0,
          unique_count: 3,
        },
        {
          name: "name",
          dtype: "categorical",
          original_dtype: "category",
          missing_count: 0,
          unique_count: 3,
        },
      ],
    });

    useUpdateColumnConfigMock.mockReturnValue({ mutateAsync: updateColumnConfig, isPending: false });
    useCastColumnMock.mockReturnValue({ mutateAsync: castColumn, isPending: false });

    render(<VariableList />);

    await userEvent.click(screen.getByRole("button", { name: /cast column name/i }));

    const castSelect = screen.getByRole("combobox", { name: /cast name to/i });
    await userEvent.selectOptions(castSelect, "categorical");
    await userEvent.click(screen.getByRole("button", { name: /apply cast for name/i }));

    expect(castColumn).toHaveBeenCalledWith({ column: "name", target_dtype: "categorical" });

    await waitFor(() => {
      expect(useDatasetStore.getState().columns.find((column) => column.name === "name")?.dtype).toBe("categorical");
    });
  });
});
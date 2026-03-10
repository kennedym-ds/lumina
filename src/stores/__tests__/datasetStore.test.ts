import { describe, expect, it } from "vitest";
import { useDatasetStore } from "../datasetStore";
import type { UploadResponse } from "@/types/data";

describe("datasetStore", () => {
  const mockUpload: UploadResponse = {
    dataset_id: "ds_123",
    file_path: "C:\\data\\sales.csv",
    file_name: "sales.csv",
    file_format: "csv",
    row_count: 100,
    column_count: 3,
    columns: [
      {
        name: "id",
        dtype: "numeric",
        original_dtype: "int64",
        missing_count: 0,
        unique_count: 100,
      },
    ],
  };

  it("sets dataset metadata from upload response", () => {
    useDatasetStore.getState().clearDataset();

    useDatasetStore.getState().setDataset(mockUpload);

    const state = useDatasetStore.getState();
    expect(state.datasetId).toBe("ds_123");
    expect(state.filePath).toBe("C:\\data\\sales.csv");
    expect(state.fileName).toBe("sales.csv");
    expect(state.fileFormat).toBe("csv");
    expect(state.rowCount).toBe(100);
    expect(state.columnCount).toBe(3);
    expect(state.columns).toHaveLength(1);
  });

  it("updates columns and clears dataset", () => {
    useDatasetStore.getState().setDataset(mockUpload);

    useDatasetStore.getState().updateColumns([
      {
        name: "value",
        dtype: "numeric",
        original_dtype: "float64",
        missing_count: 2,
        unique_count: 50,
      },
    ]);

    expect(useDatasetStore.getState().columns[0]?.name).toBe("value");

    useDatasetStore.getState().clearDataset();

    const state = useDatasetStore.getState();
    expect(state.datasetId).toBeNull();
    expect(state.filePath).toBeNull();
    expect(state.fileName).toBeNull();
    expect(state.columns).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("sets loading and error flags", () => {
    useDatasetStore.getState().setLoading(true);
    useDatasetStore.getState().setError("boom");

    expect(useDatasetStore.getState().isLoading).toBe(true);
    expect(useDatasetStore.getState().error).toBe("boom");
  });

  it("hydrates dataset state in one call", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "ds_hydrated",
      fileName: "hydrated.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 42,
      columnCount: 7,
      filePath: "C:\\data\\hydrated.csv",
    });

    const state = useDatasetStore.getState();
    expect(state.datasetId).toBe("ds_hydrated");
    expect(state.filePath).toBe("C:\\data\\hydrated.csv");
    expect(state.fileName).toBe("hydrated.csv");
    expect(state.rowCount).toBe(42);
    expect(state.columnCount).toBe(7);
  });
});

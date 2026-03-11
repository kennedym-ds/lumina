import { describe, expect, it } from "vitest";
import { useDatasetStore } from "../datasetStore";
import type { UploadResponse } from "@/types/data";

describe("datasetStore", () => {
  const mockUpload: UploadResponse = {
    dataset_id: "ds_123",
    file_path: "C:\\data\\sales.csv",
    file_name: "sales.csv",
    file_format: "csv",
    sheet_name: null,
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
    expect(state.sheetName).toBeNull();
    expect(state.rowCount).toBe(100);
    expect(state.columnCount).toBe(3);
    expect(state.columns).toHaveLength(1);
    expect(Array.from(state.excludedColumns)).toEqual([]);
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
    useDatasetStore.getState().toggleColumnExclusion("value");

    expect(useDatasetStore.getState().columns[0]?.name).toBe("value");
    expect(Array.from(useDatasetStore.getState().excludedColumns)).toEqual(["value"]);

    useDatasetStore.getState().clearDataset();

    const state = useDatasetStore.getState();
    expect(state.datasetId).toBeNull();
    expect(state.filePath).toBeNull();
    expect(state.fileName).toBeNull();
    expect(state.columns).toEqual([]);
    expect(Array.from(state.excludedColumns)).toEqual([]);
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
      sheetName: "Sheet1",
      excludedColumns: ["category"],
    });

    const state = useDatasetStore.getState();
    expect(state.datasetId).toBe("ds_hydrated");
    expect(state.filePath).toBe("C:\\data\\hydrated.csv");
    expect(state.fileName).toBe("hydrated.csv");
    expect(state.sheetName).toBe("Sheet1");
    expect(Array.from(state.excludedColumns)).toEqual(["category"]);
    expect(state.rowCount).toBe(42);
    expect(state.columnCount).toBe(7);
  });

  it("stores selected sheet name from upload responses", () => {
    useDatasetStore.getState().clearDataset();

    useDatasetStore.getState().setDataset({
      ...mockUpload,
      file_name: "workbook.xlsx",
      file_format: "excel",
      sheet_name: "Sheet2",
      sheets: ["Sheet1", "Sheet2"],
    });

    expect(useDatasetStore.getState().sheetName).toBe("Sheet2");
  });

  it("toggles column exclusion membership", () => {
    useDatasetStore.getState().setDataset(mockUpload);

    useDatasetStore.getState().toggleColumnExclusion("id");
    expect(Array.from(useDatasetStore.getState().excludedColumns)).toEqual(["id"]);

    useDatasetStore.getState().toggleColumnExclusion("id");
    expect(Array.from(useDatasetStore.getState().excludedColumns)).toEqual([]);
  });
});

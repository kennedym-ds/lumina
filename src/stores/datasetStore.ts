import { create } from "zustand";
import type { ColumnInfo, UploadResponse } from "@/types/data";

interface DatasetState {
  datasetId: string | null;
  filePath: string | null;
  fileName: string | null;
  fileFormat: string | null;
  sheetName: string | null;
  columns: ColumnInfo[];
  excludedColumns: Set<string>;
  rowCount: number;
  columnCount: number;
  isLoading: boolean;
  error: string | null;
  setDataset: (response: UploadResponse) => void;
  hydrate: (data: {
    datasetId: string;
    fileName: string;
    fileFormat: string;
    columns: ColumnInfo[];
    rowCount: number;
    columnCount: number;
    sheetName?: string | null;
    filePath?: string | null;
    excludedColumns?: Iterable<string>;
  }) => void;
  updateColumns: (columns: ColumnInfo[]) => void;
  toggleColumnExclusion: (columnName: string) => void;
  clearDataset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialState = {
  datasetId: null,
  filePath: null,
  fileName: null,
  fileFormat: null,
  sheetName: null,
  columns: [] as ColumnInfo[],
  excludedColumns: new Set<string>(),
  rowCount: 0,
  columnCount: 0,
  isLoading: false,
  error: null,
};

export const useDatasetStore = create<DatasetState>((set) => ({
  ...initialState,
  setDataset: (response) =>
    set({
      datasetId: response.dataset_id,
      filePath: response.file_path ?? null,
      fileName: response.file_name,
      fileFormat: response.file_format,
      sheetName: response.sheet_name ?? null,
      columns: response.columns,
      excludedColumns: new Set<string>(),
      rowCount: response.row_count,
      columnCount: response.column_count,
      error: null,
    }),
  hydrate: (data) =>
    set({
      datasetId: data.datasetId,
      filePath: data.filePath ?? null,
      fileName: data.fileName,
      fileFormat: data.fileFormat,
      sheetName: data.sheetName ?? null,
      columns: data.columns,
      excludedColumns: new Set(data.excludedColumns ?? []),
      rowCount: data.rowCount,
      columnCount: data.columnCount,
      error: null,
      isLoading: false,
    }),
  updateColumns: (columns) => set({ columns, columnCount: columns.length }),
  toggleColumnExclusion: (columnName) =>
    set((state) => {
      const excludedColumns = new Set(state.excludedColumns);
      if (excludedColumns.has(columnName)) {
        excludedColumns.delete(columnName);
      } else {
        excludedColumns.add(columnName);
      }

      return { excludedColumns };
    }),
  clearDataset: () => set({ ...initialState }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

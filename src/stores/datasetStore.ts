import { create } from "zustand";
import type { ColumnInfo, UploadResponse } from "@/types/data";

interface DatasetState {
  datasetId: string | null;
  filePath: string | null;
  fileName: string | null;
  fileFormat: string | null;
  columns: ColumnInfo[];
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
    filePath?: string | null;
  }) => void;
  updateColumns: (columns: ColumnInfo[]) => void;
  clearDataset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialState = {
  datasetId: null,
  filePath: null,
  fileName: null,
  fileFormat: null,
  columns: [] as ColumnInfo[],
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
      columns: response.columns,
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
      columns: data.columns,
      rowCount: data.rowCount,
      columnCount: data.columnCount,
      error: null,
      isLoading: false,
    }),
  updateColumns: (columns) => set({ columns }),
  clearDataset: () => set({ ...initialState }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

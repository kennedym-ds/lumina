export interface ColumnInfo {
  name: string;
  dtype: "numeric" | "categorical" | "datetime" | "text" | "boolean";
  original_dtype: string;
  missing_count: number;
  unique_count: number;
}

export interface UploadResponse {
  dataset_id: string;
  file_path?: string;
  file_name: string;
  file_format: string;
  sheet_name?: string | null;
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  sheets?: string[];
}

export interface PreviewResponse {
  columns: string[];
  dtypes: string[];
  data: unknown[][];
  row_count: number;
  total_rows: number;
}

export interface RowsResponse {
  columns: string[];
  data: unknown[][];
  offset: number;
  limit: number;
  total: number;
}

export interface ColumnSummary {
  name: string;
  dtype: string;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
  top_value?: string;
  top_freq?: number;
}

export interface SummaryResponse {
  dataset_id: string;
  row_count: number;
  column_count: number;
  columns: ColumnSummary[];
}

export interface ColumnConfigItem {
  name: string;
  dtype?: string;
  excluded?: boolean;
  rename?: string;
}

export type CastTargetDtype = "numeric" | "categorical" | "datetime" | "text";

export interface CastColumnRequest {
  column: string;
  target_dtype: CastTargetDtype;
}

export interface ColumnConfigResponse {
  ok: boolean;
  columns: ColumnInfo[];
}

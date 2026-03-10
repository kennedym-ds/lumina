export interface ChartState {
  chart_id: string;
  chart_type: string;
  x: string | null;
  y: string | null;
  color: string | null;
  facet: string | null;
  nbins?: number | null;
}

export interface RegressionState {
  model_type: "ols" | "logistic";
  dependent: string | null;
  independents: string[];
  train_test_split: number;
  missing_strategy: "listwise" | "mean_imputation";
}

export interface CrossFilterState {
  selected_indices: number[];
  selection_source: string | null;
}

export interface ProjectSchema {
  version: string;
  file_path: string;
  file_name: string;
  file_format: string;
  sheet_name: string | null;
  column_config: Record<string, unknown>[];
  charts: ChartState[];
  active_chart_id: string | null;
  regression: RegressionState | null;
  cross_filter: CrossFilterState | null;
}

export interface SaveRequest {
  file_path: string;
  project: ProjectSchema;
}

export interface LoadRequest {
  file_path: string;
}

export interface LoadResponse {
  dataset_id: string;
  file_name: string;
  file_format: string;
  row_count: number;
  column_count: number;
  columns: Record<string, unknown>[];
  project: ProjectSchema;
}

export interface ExportRequest {
  figure: Record<string, unknown>;
  format: "png" | "svg";
  width?: number;
  height?: number;
  scale?: number;
}
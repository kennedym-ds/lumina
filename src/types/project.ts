import type { RegressionMissingStrategy, RegressionModelType } from "@/types/regression";
import type { ModelComparisonEntry, RegressionResponse } from "@/types/regression";

export interface ChartState {
  chart_id: string;
  chart_type: string;
  x: string | null;
  y: string | null;
  color: string | null;
  facet: string | null;
  aggregation?: string | null;
  values?: string | null;
  nbins?: number | null;
}

export interface RegressionState {
  model_type: RegressionModelType;
  dependent: string | null;
  independents: string[];
  interaction_terms?: string[][];
  train_test_split: number;
  missing_strategy: RegressionMissingStrategy;
  alpha: number;
  l1_ratio: number;
  polynomial_degree: number;
  max_depth: number | null;
  n_estimators: number;
  learning_rate: number;
  model_blob?: string;
  model_result?: RegressionResponse | null;
  model_history?: ModelComparisonEntry[] | null;
}

export interface CrossFilterState {
  selected_indices: number[];
  selection_source: string | null;
}

export interface DashboardPanelState {
  id: string;
  chart_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectSchema {
  version: string;
  file_path: string;
  file_name: string;
  file_format: string;
  sheet_name: string | null;
  column_config: Record<string, unknown>[];
  saved_views: Record<string, unknown>[];
  excluded_columns: string[];
  charts: ChartState[];
  active_chart_id: string | null;
  dashboard_panels: DashboardPanelState[];
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
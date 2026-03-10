export interface CoefficientRow {
  variable: string;
  coefficient: number;
  std_error: number;
  t_stat: number | null;
  z_stat: number | null;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
}

export interface RegressionRequest {
  model_type: "ols" | "logistic";
  dependent: string;
  independents: string[];
  train_test_split: number;
  missing_strategy: "listwise" | "mean_imputation";
}

export interface RegressionResponse {
  model_id: string;
  model_type: string;
  dependent: string;
  independents: string[];
  coefficients: CoefficientRow[];
  r_squared: number | null;
  adj_r_squared: number | null;
  f_statistic: number | null;
  f_pvalue: number | null;
  aic: number | null;
  bic: number | null;
  n_observations: number;
  n_train: number | null;
  n_test: number | null;
  warnings: string[];
}

export interface DiagnosticsResponse {
  residuals_vs_fitted: Record<string, unknown>;
  qq_plot: Record<string, unknown>;
}

export interface ConfusionMatrixResponse {
  matrix: number[][];
  labels: string[];
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  heatmap_figure: Record<string, unknown>;
}

export interface RocResponse {
  fpr: number[];
  tpr: number[];
  auc: number;
  roc_figure: Record<string, unknown>;
}

export interface MissingCheckRequest {
  dependent: string;
  independents: string[];
}

export interface MissingValueReport {
  has_missing: boolean;
  columns_with_missing: { name: string; count: number; pct: number }[];
  total_rows_affected: number;
  recommendation: string;
}

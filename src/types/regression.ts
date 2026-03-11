export type RegressionModelType =
  | "ols"
  | "logistic"
  | "ridge"
  | "lasso"
  | "elastic_net"
  | "decision_tree"
  | "random_forest";
export type RegressionMissingStrategy = "listwise" | "mean_imputation";

export interface CoefficientRow {
  variable: string;
  coefficient: number;
  std_error: number | null;
  t_stat: number | null;
  z_stat: number | null;
  p_value: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface RegressionRequest {
  model_type: RegressionModelType;
  dependent: string;
  independents: string[];
  train_test_split: number;
  missing_strategy: RegressionMissingStrategy;
  alpha: number;
  l1_ratio: number;
  polynomial_degree: number;
  max_depth: number | null;
  n_estimators: number;
}

export interface FeatureImportanceRow {
  feature: string;
  importance: number;
}

export interface RegressionResponse {
  model_id: string;
  model_type: RegressionModelType;
  dependent: string;
  independents: string[];
  coefficients: CoefficientRow[];
  feature_importances: FeatureImportanceRow[] | null;
  r_squared: number | null;
  adj_r_squared: number | null;
  f_statistic: number | null;
  f_pvalue: number | null;
  aic: number | null;
  bic: number | null;
  rmse: number | null;
  mae: number | null;
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

export interface ModelComparisonEntry {
  model_id: string;
  model_type: RegressionModelType;
  r_squared: number | null;
  rmse: number | null;
  mae: number | null;
  aic: number | null;
  bic: number | null;
  accuracy: number | null;
  f1: number | null;
  n_observations: number;
}

export interface ModelComparisonResponse {
  models: ModelComparisonEntry[];
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

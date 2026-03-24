export type RegressionModelType =
  | "ols"
  | "logistic"
  | "ridge"
  | "lasso"
  | "elastic_net"
  | "decision_tree"
  | "random_forest"
  | "decision_tree_classifier"
  | "random_forest_classifier"
  | "gradient_boosting"
  | "gradient_boosting_classifier";
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
  interaction_terms?: string[][];
  train_test_split: number;
  missing_strategy: RegressionMissingStrategy;
  alpha: number;
  l1_ratio: number;
  polynomial_degree: number;
  max_depth: number | null;
  n_estimators: number;
  learning_rate: number;
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
  accuracy?: number;
  f1?: number;
  n_observations: number;
  n_train: number | null;
  n_test: number | null;
  warnings: string[];
}

export interface DiagnosticsResponse {
  residuals_vs_fitted: Record<string, unknown>;
  qq_plot: Record<string, unknown>;
}

export interface PredictionRequest {
  values: Record<string, number | string>;
}

export interface PredictionResponse {
  predicted_value: number;
  prediction_interval: [number, number] | null;
  probabilities: Record<string, number> | null;
}

export interface FeatureImportanceEntry {
  feature: string;
  importance: number;
}

export interface CoefficientPath {
  alphas: number[];
  paths: Record<string, number[]>;
}

export interface PartialDependenceEntry {
  feature: string;
  grid: number[];
  pd_values: number[];
}

export interface ExtendedDiagnosticsResponse {
  feature_importances: FeatureImportanceEntry[] | null;
  coefficient_path: CoefficientPath | null;
  partial_dependence: PartialDependenceEntry[] | null;
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

export interface CrossValidationRequest {
  model_type: RegressionModelType;
  dependent: string;
  independents: string[];
  k: number;
  scoring: string;
  missing_strategy: RegressionMissingStrategy;
  alpha: number;
  l1_ratio: number;
  polynomial_degree: number;
  max_depth: number | null;
  n_estimators: number;
  learning_rate?: number;
}

export interface CrossValidationResponse {
  model_type: RegressionModelType;
  k: number;
  scoring: string;
  fold_scores: number[];
  mean_score: number;
  std_score: number;
  warnings: string[];
}

export interface DataValidationWarning {
  column: string;
  warning_type: string;
  message: string;
  severity: string;
}

export interface DataValidationRequest {
  dependent: string;
  independents: string[];
  model_type: RegressionModelType;
}

export interface DataValidationResponse {
  warnings: DataValidationWarning[];
  can_proceed: boolean;
}

export interface VIFEntry {
  feature: string;
  vif: number;
  is_high: boolean;
}

export interface VIFResponse {
  entries: VIFEntry[];
  n_observations: number;
}

// --- Stepwise Selection ---

export interface StepwiseSelectionRequest {
  dependent: string;
  candidates: string[];
  criterion?: "aic" | "bic";
  max_steps?: number;
}

export interface StepwiseStep {
  step: number;
  variable_added: string;
  criterion_value: number;
}

export interface StepwiseSelectionResponse {
  selected_variables: string[];
  steps: StepwiseStep[];
  final_criterion: number;
  criterion: string;
  n_observations: number;
}

// --- Bayesian Regression ---

export interface BayesianRegressionRequest {
  dependent: string;
  independents: string[];
  prior_mu?: number;
  prior_kappa?: number;
  prior_alpha?: number;
  prior_beta?: number;
  credible_level?: number;
  missing_strategy?: string;
}

export interface BayesianCoefficientRow {
  variable: string;
  posterior_mean: number;
  posterior_std: number;
  ci_lower: number;
  ci_upper: number;
}

export interface BayesianRegressionResponse {
  coefficients: BayesianCoefficientRow[];
  sigma_squared_mean: number;
  sigma_squared_std: number;
  r_squared: number;
  n_observations: number;
  credible_level: number;
}

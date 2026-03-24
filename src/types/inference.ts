export type TTestType = "independent" | "paired" | "one_sample";
export type AlternativeHypothesis = "two-sided" | "less" | "greater";

export interface TTestRequest {
  test_type: TTestType;
  column_a: string;
  column_b?: string | null;
  group_column?: string | null;
  group_a?: string | null;
  group_b?: string | null;
  mu?: number;
  alternative?: AlternativeHypothesis;
}

export interface TTestResponse {
  test_type: TTestType;
  statistic: number;
  p_value: number;
  df: number;
  mean_a: number;
  mean_b: number | null;
  n_a: number;
  n_b: number | null;
  alternative: AlternativeHypothesis;
  ci_lower: number | null;
  ci_upper: number | null;
  ci_level: number;
  effect_size: number | null;
  effect_size_label: string;
}

export interface ChiSquareRequest {
  column_a: string;
  column_b: string;
}

export interface ChiSquareResponse {
  statistic: number;
  p_value: number;
  df: number;
  contingency_table: Record<string, Record<string, number>>;
  expected_frequencies: Record<string, Record<string, number>>;
  cramers_v: number | null;
  n_total: number | null;
}

export interface AnovaRequest {
  numeric_column: string;
  group_column: string;
}

export interface AnovaResponse {
  statistic: number;
  p_value: number;
  df_between: number;
  df_within: number;
  group_means: Record<string, number>;
  group_sizes: Record<string, number>;
  eta_squared: number | null;
}

export interface CIRequest {
  column: string;
  confidence_level?: number;
}

export interface CIResponse {
  column: string;
  mean: number;
  ci_lower: number;
  ci_upper: number;
  confidence_level: number;
  n: number;
  std_error: number;
}

export interface TukeyHSDRequest {
  numeric_column: string;
  group_column: string;
  alpha?: number;
}

export interface TukeyHSDComparison {
  group_a: string;
  group_b: string;
  mean_difference: number;
  adjusted_p_value: number;
  ci_lower: number;
  ci_upper: number;
  reject_null: boolean;
}

export interface TukeyHSDResponse {
  alpha: number;
  group_means: Record<string, number>;
  group_sizes: Record<string, number>;
  comparisons: TukeyHSDComparison[];
}

export interface MannWhitneyRequest {
  numeric_column: string;
  group_column: string;
  group_a?: string | null;
  group_b?: string | null;
  alternative?: AlternativeHypothesis;
}

export interface MannWhitneyResponse {
  statistic: number;
  p_value: number;
  group_a: string;
  group_b: string;
  median_a: number;
  median_b: number;
  n_a: number;
  n_b: number;
  alternative: AlternativeHypothesis;
}

export interface WilcoxonRequest {
  column_a: string;
  column_b: string;
  alternative?: AlternativeHypothesis;
}

export interface WilcoxonResponse {
  statistic: number;
  p_value: number;
  n_pairs: number;
  median_difference: number;
  alternative: AlternativeHypothesis;
}

export interface KruskalRequest {
  numeric_column: string;
  group_column: string;
}

export interface KruskalResponse {
  statistic: number;
  p_value: number;
  df: number;
  group_medians: Record<string, number>;
  group_sizes: Record<string, number>;
}

export interface NormalityRequest {
  column: string;
  alpha?: number;
}

export interface NormalityTestResult {
  statistic: number | null;
  p_value: number | null;
  reject_null: boolean | null;
  ran: boolean;
  reason: string | null;
}

export interface AndersonDarlingResult {
  statistic: number;
  critical_values: Record<string, number>;
  reject_null: boolean;
  significance_level: number;
}

export interface NormalityResponse {
  column: string;
  n: number;
  alpha: number;
  shapiro: NormalityTestResult;
  anderson_darling: AndersonDarlingResult;
  lilliefors: NormalityTestResult;
}

export interface BayesianOneSampleRequest {
  column: string;
  prior_mu?: number;
  prior_sigma?: number;
  credible_level?: number;
}

export interface BayesianOneSampleResponse {
  posterior_mean: number;
  posterior_std: number;
  ci_lower: number;
  ci_upper: number;
  credible_level: number;
  bayes_factor_10: number;
  n: number;
  sample_mean: number;
  sample_std: number;
}

export interface BayesianTwoSampleRequest {
  column_a: string;
  column_b: string;
  credible_level?: number;
}

export interface BayesianTwoSampleResponse {
  difference_mean: number;
  difference_std: number;
  ci_lower: number;
  ci_upper: number;
  credible_level: number;
  prob_greater_than_zero: number;
  group_a: BayesianOneSampleResponse;
  group_b: BayesianOneSampleResponse;
}

export interface PowerAnalysisRequest {
  analysis_type: "ttest" | "anova";
  solve_for: "sample_size" | "power";
  effect_size: number;
  alpha?: number;
  power?: number;
  sample_size_per_group?: number;
  ratio?: number;
  k_groups?: number;
  alternative?: AlternativeHypothesis;
}

export interface PowerAnalysisResponse {
  analysis_type: "ttest" | "anova";
  solve_for: "sample_size" | "power";
  effect_size: number;
  alpha: number;
  power: number;
  sample_size_per_group: number;
  total_sample_size: number;
  ratio: number | null;
  k_groups: number | null;
  alternative: AlternativeHypothesis | null;
}

// --- Repeated-Measures ANOVA ---

export interface RepeatedMeasuresAnovaRequest {
  subject_column: string;
  within_column: string;
  dependent_column: string;
}

export interface RepeatedMeasuresAnovaResponse {
  f_statistic: number;
  p_value: number;
  df_num: number;
  df_den: number;
  n_subjects: number;
  n_conditions: number;
  reject_null: boolean;
}

// --- Factorial ANOVA ---

export interface FactorialAnovaRequest {
  dependent_column: string;
  factors: string[];
}

export interface FactorialAnovaFactor {
  source: string;
  sum_sq: number;
  df: number;
  f_statistic: number;
  p_value: number;
}

export interface FactorialAnovaResponse {
  table: FactorialAnovaFactor[];
  n_observations: number;
  reject_any: boolean;
}

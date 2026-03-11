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

export interface TopValueProfile {
  value: string;
  count: number;
  pct: number;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  total_count: number;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  skewness: number | null;
  kurtosis: number | null;
  zeros_count: number | null;
  histogram_bins: number[] | null;
  histogram_counts: number[] | null;
  top_values: TopValueProfile[] | null;
  memory_bytes: number;
}

export interface DatasetProfile {
  dataset_id: string;
  row_count: number;
  column_count: number;
  total_memory_bytes: number;
  duplicate_row_count: number;
  columns: ColumnProfile[];
}

export interface CorrelationResponse {
  method: string;
  columns: string[];
  matrix: Array<Array<number | null>>;
}

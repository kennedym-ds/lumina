export interface Factor {
  name: string;
  low: number;
  high: number;
}

export interface DesignRequest {
  factors: Factor[];
  design_type: "full_factorial" | "fractional_factorial" | "plackett_burman";
  levels?: number;
  fraction?: number;
  n_center?: number;
}

export interface DesignResponse {
  design_type: string;
  factor_names: string[];
  n_runs: number;
  runs: Record<string, number>[];
  resolution: number | null;
  generators: string[] | null;
  notes: string[];
}

export interface ControlChartRequest {
  column: string;
  subgroup_size?: number;
}

export interface ControlChartSeries {
  name: string;
  points: number[];
  center_line: number;
  ucl: number;
  lcl: number;
}

export interface ControlChartViolation {
  index: number;
  point: number;
  rules: number[];
}

export interface ControlChartResponse {
  chart_kind: "imr" | "xbar_r" | "xbar_s";
  column: string;
  subgroup_size: number;
  primary: ControlChartSeries;
  secondary: ControlChartSeries;
  violations: ControlChartViolation[];
  sigma: number;
}

export interface CapabilityRequest {
  column: string;
  lsl?: number | null;
  usl?: number | null;
  target?: number | null;
  subgroup_size?: number;
}

export interface CapabilityHistogram {
  counts: number[];
  bin_edges: number[];
}

export interface CapabilityResponse {
  column: string;
  n: number;
  mean: number;
  std_overall: number;
  std_within: number;
  lsl: number | null;
  usl: number | null;
  target: number | null;
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  ppm_below: number;
  ppm_above: number;
  ppm_total: number;
  observed_out_of_spec: number;
  histogram: CapabilityHistogram;
}

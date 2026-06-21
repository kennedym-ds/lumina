export interface ModelInfo {
  name: string;
  param_names: string[];
}

export interface CurveFitRequest {
  x_column: string;
  y_column: string;
  model_name: string;
}

export interface CurveFitResponse {
  model_name: string;
  param_names: string[];
  params: number[];
  param_std_errors: (number | null)[];
  r_squared: number;
  rmse: number;
  n: number;
  x_data: number[];
  y_data: number[];
  curve_x: number[];
  curve_y: number[];
}

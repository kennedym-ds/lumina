export type TransformType =
  | "bin"
  | "recode"
  | "date_part"
  | "log"
  | "sqrt"
  | "zscore"
  | "arithmetic";

export interface TransformRequest {
  transform_type: TransformType;
  output_column: string;
  source_column: string;
  params: Record<string, unknown>;
}

export interface TransformResponse {
  output_column: string;
  row_count: number;
  null_count: number;
  dtype: string;
  preview: Array<string | number | boolean | null>;
}

export interface TransformTypeOption {
  type: TransformType;
  label: string;
}

export interface TransformListResponse {
  transforms: TransformTypeOption[];
}

export interface DeleteTransformResponse {
  ok: boolean;
  column_name: string;
}

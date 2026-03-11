export type FilterOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not_in"
  | "is_null"
  | "not_null"
  | "contains"
  | "not_contains";

export interface FilterRule {
  id: string;
  column: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterRequest {
  filters: Array<{
    column: string;
    operator: FilterOperator;
    value: unknown;
  }>;
  logic: "and";
}

export interface FilterResponse {
  applied_count: number;
  matched_rows: number;
  total_rows: number;
}

import type * as Plotly from "plotly.js";

export type ChartType =
  | "histogram"
  | "scatter"
  | "box"
  | "bar"
  | "line"
  | "violin"
  | "heatmap"
  | "density"
  | "pie"
  | "area"
  | "qq_plot";
export type LuminaDtype = "numeric" | "categorical" | "datetime" | "text" | "boolean";

export interface ChartConfig {
  chartId: string;
  chartType: ChartType;
  x: string | null;
  y: string | null;
  color: string | null;
  facet: string | null;
  aggregation?: string | null;
  values?: string | null;
  nbins?: number;
}

export interface ChartRequest {
  chart_type: ChartType;
  x?: string | null;
  y?: string | null;
  color?: string | null;
  facet?: string | null;
  aggregation?: string | null;
  values?: string | null;
  nbins?: number;
}

export interface ChartResponse {
  chart_id: string;
  chart_type: ChartType;
  plotly_figure: {
    data: Plotly.Data[];
    layout: Partial<Plotly.Layout>;
  };
  row_count: number;
  webgl: boolean;
  warnings: string[];
  downsampled: boolean;
  displayed_row_count: number | null;
}

export interface ShelfAssignment {
  shelf: "x" | "y" | "color" | "facet";
  columnName: string;
}

export interface DistributionRequest {
  column: string;
  group_by?: string | null;
  n_points?: number;
}

export interface KDETrace {
  group: string;
  x: number[];
  y: number[];
}

export interface DistributionResponse {
  column: string;
  group_by: string | null;
  traces: KDETrace[];
}

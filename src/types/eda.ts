import type * as Plotly from "plotly.js";

export type ChartType = "histogram" | "scatter" | "box" | "bar" | "line";
export type LuminaDtype = "numeric" | "categorical" | "datetime" | "text" | "boolean";

export interface ChartConfig {
  chartId: string;
  chartType: ChartType;
  x: string | null;
  y: string | null;
  color: string | null;
  facet: string | null;
  nbins?: number;
}

export interface ChartRequest {
  chart_type: ChartType;
  x?: string | null;
  y?: string | null;
  color?: string | null;
  facet?: string | null;
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
}

export interface ShelfAssignment {
  shelf: "x" | "y" | "color" | "facet";
  columnName: string;
}

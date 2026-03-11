import { describe, expect, it } from "vitest";
import { createChartRequest, hasRequiredFields } from "@/api/eda";
import type { ChartConfig, ChartType } from "@/types/eda";

function makeConfig(chartType: ChartType, overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    chartId: `chart-${chartType}`,
    chartType,
    x: null,
    y: null,
    color: null,
    facet: null,
    aggregation: null,
    values: null,
    ...overrides,
  };
}

describe("eda api helpers", () => {
  it.each([
    ["violin", makeConfig("violin", { y: "value" }), true],
    ["violin missing y", makeConfig("violin"), false],
    ["heatmap", makeConfig("heatmap", { x: "segment", y: "region" }), true],
    ["heatmap missing y", makeConfig("heatmap", { x: "segment" }), false],
    ["density", makeConfig("density", { x: "height", y: "weight" }), true],
    ["density missing x", makeConfig("density", { y: "weight" }), false],
    ["pie", makeConfig("pie", { x: "category" }), true],
    ["pie missing x", makeConfig("pie"), false],
    ["area", makeConfig("area", { x: "date", y: "sales" }), true],
    ["area missing y", makeConfig("area", { x: "date" }), false],
    ["qq_plot", makeConfig("qq_plot", { x: "residual" }), true],
    ["qq_plot missing x", makeConfig("qq_plot"), false],
  ])("hasRequiredFields(%s)", (_label, config, expected) => {
    expect(hasRequiredFields(config)).toBe(expected);
  });

  it("includes aggregation and values when building chart requests", () => {
    const request = createChartRequest(
      makeConfig("heatmap", {
        x: "segment",
        y: "region",
        aggregation: "mean",
        values: "revenue",
      }),
    );

    expect(request).toMatchObject({
      chart_type: "heatmap",
      x: "segment",
      y: "region",
      aggregation: "mean",
      values: "revenue",
    });
  });
});

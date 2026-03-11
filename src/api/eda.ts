import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ChartConfig, ChartRequest, ChartResponse, DistributionResponse } from "@/types/eda";

function getAggregation(config: ChartConfig): string {
  return config.aggregation ?? "count";
}

export function hasRequiredFields(config: ChartConfig): boolean {
  switch (config.chartType) {
    case "histogram":
      return Boolean(config.x);
    case "scatter":
      return Boolean(config.x && config.y);
    case "box":
      return Boolean(config.y);
    case "bar":
      return Boolean(config.x);
    case "line":
      return Boolean(config.x && config.y);
    case "violin":
      return Boolean(config.y);
    case "heatmap":
      return Boolean(config.x && config.y);
    case "density":
      return Boolean(config.x && config.y);
    case "pie":
      return Boolean(config.x);
    case "area":
      return Boolean(config.x && config.y);
    case "qq_plot":
      return Boolean(config.x);
    default:
      return false;
  }
}

export function createChartRequest(config: ChartConfig): ChartRequest {
  const request: ChartRequest = {
    chart_type: config.chartType,
    x: config.x,
    y: config.y,
    color: config.color,
    facet: config.facet,
    nbins: config.nbins,
  };

  if (config.chartType === "heatmap" && config.aggregation) {
    request.aggregation = config.aggregation;
  }

  if (config.chartType === "pie" && config.values) {
    request.values = config.values;
  }

  if (config.chartType === "heatmap" && getAggregation(config) !== "count" && config.values) {
    request.values = config.values;
  }

  return request;
}

function getConfigKey(config: ChartConfig | null): string {
  if (config === null) {
    return "none";
  }

  return JSON.stringify({
    chartType: config.chartType,
    x: config.x,
    y: config.y,
    color: config.color,
    facet: config.facet,
    aggregation: config.aggregation,
    values: config.values,
    nbins: config.nbins,
  });
}

export const useChartData = (
  datasetId: string | null,
  chartConfig: ChartConfig | null,
): UseQueryResult<ChartResponse, Error> => {
  return useQuery({
    queryKey: ["eda", "chart", datasetId, getConfigKey(chartConfig)],
    queryFn: () => {
      if (!datasetId || !chartConfig) {
        throw new Error("Dataset and chart config are required.");
      }

      return apiClient.post<ChartResponse>(`/api/eda/${datasetId}/chart`, createChartRequest(chartConfig));
    },
    enabled: Boolean(datasetId && chartConfig && hasRequiredFields(chartConfig)),
  });
};

export const useDistribution = (
  datasetId: string | null,
  column: string | null,
  groupBy: string | null,
): UseQueryResult<DistributionResponse, Error> => {
  return useQuery({
    queryKey: ["eda", "distribution", datasetId, column, groupBy],
    queryFn: () => {
      if (!datasetId || !column) {
        throw new Error("Dataset and numeric column are required.");
      }

      return apiClient.post<DistributionResponse>(`/api/eda/${datasetId}/distribution`, {
        column,
        group_by: groupBy,
      });
    },
    enabled: Boolean(datasetId && column),
  });
};

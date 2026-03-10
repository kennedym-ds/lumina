import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ChartConfig, ChartRequest, ChartResponse } from "@/types/eda";

function hasRequiredFields(config: ChartConfig): boolean {
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
    default:
      return false;
  }
}

function createChartRequest(config: ChartConfig): ChartRequest {
  return {
    chart_type: config.chartType,
    x: config.x,
    y: config.y,
    color: config.color,
    facet: config.facet,
    nbins: config.nbins,
  };
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

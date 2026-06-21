import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type {
  CapabilityRequest,
  CapabilityResponse,
  ControlChartRequest,
  ControlChartResponse,
} from "@/types/spc";

export function useControlChart(datasetId: string | null | undefined) {
  return useMutation<ControlChartResponse, Error, ControlChartRequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/spc/${datasetId}/control-chart`, payload);
    },
  });
}

export function useCapability(datasetId: string | null | undefined) {
  return useMutation<CapabilityResponse, Error, CapabilityRequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/spc/${datasetId}/capability`, payload);
    },
  });
}

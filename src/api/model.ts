import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type {
  ConfusionMatrixResponse,
  DiagnosticsResponse,
  MissingCheckRequest,
  MissingValueReport,
  RegressionRequest,
  RegressionResponse,
  RocResponse,
} from "@/types/regression";

export function useFitRegression(datasetId: string | null) {
  return useMutation<RegressionResponse, Error, RegressionRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/regression`, request);
    },
  });
}

export function useDiagnostics(datasetId: string | null, enabled: boolean) {
  return useQuery<DiagnosticsResponse>({
    queryKey: ["diagnostics", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/diagnostics`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useConfusionMatrix(datasetId: string | null, enabled: boolean) {
  return useQuery<ConfusionMatrixResponse>({
    queryKey: ["confusion", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/confusion`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useRoc(datasetId: string | null, enabled: boolean) {
  return useQuery<RocResponse>({
    queryKey: ["roc", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.get(`/api/model/${datasetId}/roc`);
    },
    enabled: enabled && !!datasetId,
  });
}

export function useCheckMissing(datasetId: string | null) {
  return useMutation<MissingValueReport, Error, MissingCheckRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/model/${datasetId}/check-missing`, request);
    },
  });
}

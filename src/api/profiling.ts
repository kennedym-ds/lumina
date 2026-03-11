import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { CorrelationResponse, DatasetProfile } from "@/types/profiling";

export function useDatasetProfile(datasetId: string | null): UseQueryResult<DatasetProfile, Error> {
  return useQuery({
    queryKey: ["eda", "profile", datasetId],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("No dataset loaded");
      }

      return apiClient.get<DatasetProfile>(`/api/eda/${datasetId}/profile`);
    },
    enabled: Boolean(datasetId),
  });
}

export function useCorrelation(
  datasetId: string | null,
  method: string,
): UseQueryResult<CorrelationResponse, Error> {
  return useQuery({
    queryKey: ["eda", "correlation", datasetId, method],
    queryFn: () => {
      if (!datasetId) {
        throw new Error("No dataset loaded");
      }

      return apiClient.post<CorrelationResponse>(`/api/eda/${datasetId}/correlation`, { method });
    },
    enabled: Boolean(datasetId),
  });
}

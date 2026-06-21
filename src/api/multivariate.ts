import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ClusterRequest, ClusterResponse, PCARequest, PCAResponse } from "@/types/multivariate";

export function usePca(datasetId: string | null | undefined) {
  return useMutation<PCAResponse, Error, PCARequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/multivariate/${datasetId}/pca`, payload);
    },
  });
}

export function useClustering(datasetId: string | null | undefined) {
  return useMutation<ClusterResponse, Error, ClusterRequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/multivariate/${datasetId}/cluster`, payload);
    },
  });
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { CurveFitRequest, CurveFitResponse, ModelInfo } from "@/types/curve_fit";

export function useCurveFitModels() {
  return useQuery<ModelInfo[]>({
    queryKey: ["curvefit", "models"],
    queryFn: () => apiClient.get<ModelInfo[]>("/api/curvefit/models"),
    staleTime: Infinity,
  });
}

export function useFitCurve(datasetId: string | null | undefined) {
  return useMutation<CurveFitResponse, Error, CurveFitRequest>({
    mutationFn: (payload) => {
      if (!datasetId) {
        throw new Error("Dataset is required.");
      }

      return apiClient.post(`/api/curvefit/${datasetId}/fit`, payload);
    },
  });
}

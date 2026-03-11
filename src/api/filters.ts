import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryClient } from "@/api/queryClient";
import { useRegressionStore } from "@/stores/regressionStore";
import type { FilterRequest, FilterResponse } from "@/types/filters";

export function useApplyFilters(datasetId: string | null) {
  return useMutation<FilterResponse, Error, FilterRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("No dataset loaded");
      }

      return apiClient.post<FilterResponse>(`/api/data/${datasetId}/filters`, request);
    },
    onSuccess: async () => {
      useRegressionStore.getState().clearResult();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["eda"] }),
        queryClient.invalidateQueries({ queryKey: ["data"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostics"] }),
        queryClient.invalidateQueries({ queryKey: ["confusion"] }),
        queryClient.invalidateQueries({ queryKey: ["roc"] }),
      ]);
    },
  });
}

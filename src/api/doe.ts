import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { DesignRequest, DesignResponse } from "@/types/doe";

export function useGenerateDesign() {
  return useMutation<DesignResponse, Error, DesignRequest>({
    mutationFn: (payload) => apiClient.post("/api/doe/design", payload),
  });
}

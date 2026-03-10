import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { UploadResponse } from "@/types/data";

export interface SampleDataset {
  name: string;
  display_name: string;
  description: string;
}

export function useSamplesList() {
  return useQuery<SampleDataset[]>({
    queryKey: ["samples"],
    queryFn: () => apiClient.get<SampleDataset[]>("/api/data/samples"),
  });
}

export function useLoadSample() {
  return useMutation<UploadResponse, Error, string>({
    mutationFn: (name: string) => apiClient.post<UploadResponse>(`/api/data/samples/${name}`),
  });
}

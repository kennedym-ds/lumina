import {
  keepPreviousData,
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type {
  ColumnConfigItem,
  ColumnConfigResponse,
  PreviewResponse,
  RowsResponse,
  SummaryResponse,
  UploadResponse,
} from "@/types/data";

export interface UploadFileParams {
  file: File;
  sheet?: string;
}

export const useUploadFile = (): UseMutationResult<UploadResponse, Error, UploadFileParams> => {
  return useMutation({
    mutationFn: async ({ file, sheet }) => {
      const formData = new FormData();
      formData.append("file", file);

      const query = sheet ? `?sheet=${encodeURIComponent(sheet)}` : "";
      return apiClient.post<UploadResponse>(`/api/data/upload${query}`, formData);
    },
  });
};

export const usePreview = (datasetId: string | null): UseQueryResult<PreviewResponse, Error> => {
  return useQuery({
    queryKey: ["data", "preview", datasetId],
    queryFn: () => apiClient.get<PreviewResponse>(`/api/data/${datasetId}/preview?rows=100`),
    enabled: Boolean(datasetId),
  });
};

export const useRows = (
  datasetId: string | null,
  offset = 0,
  limit = 1000,
  sortBy: string | null = null,
  sortDesc = false,
): UseQueryResult<RowsResponse, Error> => {
  return useQuery({
    queryKey: ["data", "rows", datasetId, offset, limit, sortBy, sortDesc],
    queryFn: () => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });

      if (sortBy) {
        params.set("sort_by", sortBy);
        params.set("sort_desc", String(sortDesc));
      }

      return apiClient.get<RowsResponse>(`/api/data/${datasetId}/rows?${params.toString()}`);
    },
    enabled: Boolean(datasetId),
    placeholderData: keepPreviousData,
  });
};

export const useSummary = (datasetId: string | null): UseQueryResult<SummaryResponse, Error> => {
  return useQuery({
    queryKey: ["data", "summary", datasetId],
    queryFn: () => apiClient.get<SummaryResponse>(`/api/data/${datasetId}/summary`),
    enabled: Boolean(datasetId),
  });
};

export const useUpdateColumnConfig = (
  datasetId: string | null,
): UseMutationResult<ColumnConfigResponse, Error, ColumnConfigItem[]> => {
  return useMutation({
    mutationFn: (columns) =>
      apiClient.post<ColumnConfigResponse>(`/api/data/${datasetId}/column-config`, {
        columns,
      }),
  });
};

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface ViewSchema {
  view_id: string;
  name: string;
  charts: Record<string, unknown>[];
  active_chart_id: string | null;
  cross_filter: Record<string, unknown> | null;
  created_at: string;
}

interface SaveViewBody {
  name: string;
  charts: Record<string, unknown>[];
  active_chart_id?: string | null;
  cross_filter?: Record<string, unknown> | null;
}

interface RenameViewBody {
  viewId: string;
  name: string;
}

function ensureDatasetId(datasetId: string | null): string {
  if (!datasetId) {
    throw new Error("A dataset must be loaded first.");
  }

  return datasetId;
}

export function useViewsList(datasetId: string | null): UseQueryResult<ViewSchema[], Error> {
  return useQuery({
    queryKey: ["views", datasetId],
    queryFn: () => apiClient.get<ViewSchema[]>(`/api/views/${ensureDatasetId(datasetId)}`),
    enabled: Boolean(datasetId),
  });
}

export function useSaveView(
  datasetId: string | null,
): UseMutationResult<ViewSchema, Error, SaveViewBody> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body) => apiClient.post<ViewSchema>(`/api/views/${ensureDatasetId(datasetId)}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["views", datasetId] });
    },
  });
}

export function useRenameView(
  datasetId: string | null,
): UseMutationResult<ViewSchema, Error, RenameViewBody> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ viewId, name }) =>
      apiClient.put<ViewSchema>(`/api/views/${ensureDatasetId(datasetId)}/${viewId}`, {
        name,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["views", datasetId] });
    },
  });
}

export function useDeleteView(
  datasetId: string | null,
): UseMutationResult<{ ok: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (viewId) => apiClient.delete<{ ok: boolean }>(`/api/views/${ensureDatasetId(datasetId)}/${viewId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["views", datasetId] });
    },
  });
}
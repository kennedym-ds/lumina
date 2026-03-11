import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryClient } from "@/api/queryClient";
import { useDatasetStore } from "@/stores/datasetStore";
import { useRegressionStore } from "@/stores/regressionStore";
import type { ColumnInfo, SummaryResponse } from "@/types/data";
import type {
  DeleteTransformResponse,
  TransformListResponse,
  TransformRequest,
  TransformResponse,
} from "@/types/transforms";

const COLUMN_DTYPES: ReadonlyArray<ColumnInfo["dtype"]> = [
  "numeric",
  "categorical",
  "datetime",
  "text",
  "boolean",
];

function normalizeColumnDtype(dtype: string): ColumnInfo["dtype"] {
  return COLUMN_DTYPES.includes(dtype as ColumnInfo["dtype"])
    ? (dtype as ColumnInfo["dtype"])
    : "text";
}

function mapSummaryColumns(summary: SummaryResponse): ColumnInfo[] {
  return summary.columns.map((column) => ({
    name: column.name,
    dtype: normalizeColumnDtype(column.dtype),
    original_dtype: column.dtype,
    missing_count: column.missing_count,
    unique_count: column.unique_count,
  }));
}

async function refreshDatasetColumns(datasetId: string): Promise<void> {
  const summary = await apiClient.get<SummaryResponse>(`/api/data/${datasetId}/summary`);
  useDatasetStore.getState().updateColumns(mapSummaryColumns(summary));
}

async function invalidateTransformQueries(datasetId: string): Promise<void> {
  useRegressionStore.getState().clearResult();
  await Promise.all([
    refreshDatasetColumns(datasetId),
    queryClient.invalidateQueries({ queryKey: ["data"] }),
    queryClient.invalidateQueries({ queryKey: ["eda"] }),
    queryClient.invalidateQueries({ queryKey: ["diagnostics"] }),
    queryClient.invalidateQueries({ queryKey: ["confusion"] }),
    queryClient.invalidateQueries({ queryKey: ["roc"] }),
  ]);
}

export function useTransformTypes() {
  return useQuery<TransformListResponse, Error>({
    queryKey: ["transforms", "types"],
    queryFn: () => apiClient.get<TransformListResponse>("/api/transforms/types"),
  });
}

export function useApplyTransform(datasetId: string | null) {
  return useMutation<TransformResponse, Error, TransformRequest>({
    mutationFn: (request) => {
      if (!datasetId) {
        throw new Error("No dataset loaded");
      }

      return apiClient.post<TransformResponse>(`/api/transforms/${datasetId}/apply`, request);
    },
    onSuccess: async () => {
      if (!datasetId) {
        return;
      }

      await invalidateTransformQueries(datasetId);
    },
  });
}

export function useDeleteTransformColumn(datasetId: string | null) {
  return useMutation<DeleteTransformResponse, Error, string>({
    mutationFn: (columnName) => {
      if (!datasetId) {
        throw new Error("No dataset loaded");
      }

      return apiClient.delete<DeleteTransformResponse>(
        `/api/transforms/${datasetId}/column/${encodeURIComponent(columnName)}`,
      );
    },
    onSuccess: async () => {
      if (!datasetId) {
        return;
      }

      await invalidateTransformQueries(datasetId);
    },
  });
}

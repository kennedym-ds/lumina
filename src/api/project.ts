import { useMutation } from "@tanstack/react-query";
import { apiClient, getAuthToken, getBackendPort } from "@/api/client";
import type { ExportRequest, LoadRequest, LoadResponse, SaveRequest } from "@/types/project";

export function useSaveProject() {
  return useMutation<{ status: string; file_path: string }, Error, SaveRequest>({
    mutationFn: (request) => apiClient.post("/api/project/save", request),
  });
}

export function useLoadProject() {
  return useMutation<LoadResponse, Error, LoadRequest>({
    mutationFn: (request) => apiClient.post("/api/project/load", request),
  });
}

function getBaseUrl(): string {
  return `http://127.0.0.1:${getBackendPort()}`;
}

function getToken(): string {
  return getAuthToken();
}

export async function exportChart(request: ExportRequest): Promise<Blob> {
  const response = await fetch(`${getBaseUrl()}/api/project/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Export failed");
  }

  return response.blob();
}
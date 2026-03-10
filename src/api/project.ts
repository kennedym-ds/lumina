import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
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
  const port = window.__LUMINA_API_PORT__ ?? 8089;
  return `http://127.0.0.1:${port}`;
}

function getToken(): string {
  return window.__LUMINA_API_TOKEN__ ?? "dev-token";
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
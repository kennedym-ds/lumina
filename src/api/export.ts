export type ExportFormat = "csv" | "excel" | "report";

const endpointMap: Record<ExportFormat, string> = {
  csv: "csv",
  excel: "excel",
  report: "report",
};

const extensionMap: Record<ExportFormat, string> = {
  csv: "csv",
  excel: "xlsx",
  report: "md",
};

function getBaseUrl(): string {
  const port = window.__LUMINA_API_PORT__ ?? 8089;
  return `http://127.0.0.1:${port}`;
}

function getToken(): string {
  return window.__LUMINA_API_TOKEN__ ?? "dev-token";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export async function downloadExport(datasetId: string, format: ExportFormat): Promise<void> {
  const response = await fetch(`${getBaseUrl()}/api/export/${datasetId}/${endpointMap[format]}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to export ${format}.`);
  }

  const blob = await response.blob();
  const filename = getFilename(
    response.headers.get("Content-Disposition"),
    `lumina-export.${extensionMap[format]}`,
  );

  triggerDownload(blob, filename);
}
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { ApiError, getBackendPort } from "@/api/client";
import { useUploadFile } from "@/api/data";
import { AppLayout } from "@/components/Layout/AppLayout";
import { FileDropZone } from "@/components/Import/FileDropZone";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { useBackendReady } from "@/hooks/useBackendReady";
import type { UploadResponse } from "@/types/data";

function MainRoute() {
  const uploadMutation = useUploadFile();
  const setDataset = useDatasetStore((state) => state.setDataset);
  const setLoading = useDatasetStore((state) => state.setLoading);
  const setError = useDatasetStore((state) => state.setError);

  const handleUpload = async (file: File, sheet?: string): Promise<UploadResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await uploadMutation.mutateAsync({ file, sheet });
      useDashboardStore.getState().clearDashboard();
      setDataset(response);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.userMessage ?? error.message);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Upload failed.");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <FileDropZone onUpload={handleUpload}>
      <AppLayout onUpload={handleUpload} isUploading={uploadMutation.isPending} />
    </FileDropZone>
  );
}

function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

function startupMessage(elapsed: number): string {
  if (elapsed < 8) return "Starting Lumina…";
  if (elapsed < 25) return "Starting the analysis engine…";
  return "Almost ready — your antivirus may be scanning the engine, please wait…";
}

export default function App() {
  const { ready, timedOut } = useBackendReady(getBackendPort());
  const elapsed = useElapsedSeconds();

  if (timedOut) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Engine failed to start</h1>
        <p className="max-w-md text-sm text-slate-600">
          The Lumina analysis engine did not respond after 90 seconds.
        </p>
        <ul className="max-w-md list-inside list-disc text-left text-sm text-slate-600">
          <li>Try restarting the application — the engine caches after first launch</li>
          <li>
            Check Windows Security to ensure{" "}
            <code className="rounded bg-slate-100 px-1 font-mono">lumina-backend.exe</code>{" "}
            is not quarantined
          </li>
          <li>Add the Lumina install folder to your antivirus exclusion list</li>
        </ul>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
        <p>{startupMessage(elapsed)}</p>
        {elapsed >= 8 ? (
          <p className="text-xs text-slate-400">({elapsed}s elapsed)</p>
        ) : null}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
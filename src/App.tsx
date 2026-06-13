import { BrowserRouter, Route, Routes } from "react-router-dom";
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

export default function App() {
  const { ready, timedOut } = useBackendReady(getBackendPort());

  if (timedOut) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Backend failed to start</h1>
        <p className="max-w-md text-sm text-slate-600">
          The Lumina analysis engine did not respond within 30 seconds. Try restarting
          the application. If the problem persists, check that your antivirus is not
          blocking <code className="rounded bg-slate-100 px-1 font-mono">lumina-backend.exe</code>.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
        Starting Lumina…
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
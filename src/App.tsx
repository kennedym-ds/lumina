import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useUploadFile } from "@/api/data";
import { AppLayout } from "@/components/Layout/AppLayout";
import { FileDropZone } from "@/components/Import/FileDropZone";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
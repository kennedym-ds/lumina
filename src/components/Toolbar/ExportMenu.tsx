import { useState } from "react";
import { downloadExport, type ExportFormat } from "@/api/export";
import { useDatasetStore } from "@/stores/datasetStore";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to export dataset.";
}

export function ExportMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const datasetId = useDatasetStore((state) => state.datasetId);

  const handleExport = async (format: ExportFormat) => {
    if (!datasetId) {
      return;
    }

    try {
      setIsExporting(true);
      await downloadExport(datasetId, format);
      setIsMenuOpen(false);
    } catch (error) {
      window.alert(`Export failed: ${getErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((previous) => !previous)}
        disabled={!datasetId || isExporting}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export Data
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              void handleExport("csv");
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExport("excel");
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExport("report");
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Export Report
          </button>
        </div>
      ) : null}
    </div>
  );
}
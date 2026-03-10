import { useState } from "react";
import { useChartData } from "@/api/eda";
import { exportChart } from "@/api/project";
import { useChartStore } from "@/stores/chartStore";
import { useDatasetStore } from "@/stores/datasetStore";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to export chart.";
}

export function ExportChartButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const datasetId = useDatasetStore((state) => state.datasetId);
  const { activeChartId, activeChart } = useChartStore((state) => ({
    activeChartId: state.activeChartId,
    activeChart: state.charts.find((chart) => chart.chartId === state.activeChartId) ?? null,
  }));

  const chartQuery = useChartData(datasetId, activeChart);

  const handleExport = async (format: "png" | "svg") => {
    if (!chartQuery.data?.plotly_figure) {
      window.alert("Build an active chart before exporting.");
      return;
    }

    try {
      const blob = await exportChart({
        figure: chartQuery.data.plotly_figure as Record<string, unknown>,
        format,
        width: 1200,
        height: 800,
        scale: 2,
      });

      const baseName = activeChartId ?? "chart";
      downloadBlob(blob, `${baseName}.${format}`);
      setIsMenuOpen(false);
    } catch (error) {
      window.alert(`Export failed: ${getErrorMessage(error)}`);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((previous) => !previous)}
        disabled={!activeChart || chartQuery.isLoading}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              void handleExport("png");
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Export PNG
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExport("svg");
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Export SVG
          </button>
        </div>
      ) : null}
    </div>
  );
}
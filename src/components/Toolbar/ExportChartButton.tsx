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

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, filename);
}

function buildStandaloneHtml(figure: Record<string, unknown>): string {
  const json = JSON.stringify(figure);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumina Chart Export</title>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js" crossorigin="anonymous"></script>
  <style>body{margin:0;background:#fff}#chart{width:100vw;height:100vh}</style>
</head>
<body>
  <div id="chart"></div>
  <script>
    const figure = ${json};
    Plotly.react("chart", figure.data, figure.layout, { responsive: true });
  </script>
</body>
</html>`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to export chart.";
}

export function ExportChartButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scale, setScale] = useState(2);
  const datasetId = useDatasetStore((state) => state.datasetId);
  const { activeChartId, activeChart } = useChartStore((state) => ({
    activeChartId: state.activeChartId,
    activeChart: state.charts.find((chart) => chart.chartId === state.activeChartId) ?? null,
  }));

  const chartQuery = useChartData(datasetId, activeChart);

  const handleImageExport = async (format: "png" | "svg") => {
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
        scale,
      });
      downloadBlob(blob, `${activeChartId ?? "chart"}.${format}`);
      setIsMenuOpen(false);
    } catch (error) {
      window.alert(`Export failed: ${getErrorMessage(error)}`);
    }
  };

  const handleHtmlExport = () => {
    if (!chartQuery.data?.plotly_figure) {
      window.alert("Build an active chart before exporting.");
      return;
    }
    const html = buildStandaloneHtml(chartQuery.data.plotly_figure as Record<string, unknown>);
    downloadText(html, `${activeChartId ?? "chart"}.html`);
    setIsMenuOpen(false);
  };

  const handlePrint = () => {
    window.print();
    setIsMenuOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((previous) => !previous)}
        disabled={!activeChart || chartQuery.isLoading}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export Chart
      </button>

      {isMenuOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-slate-200 bg-white p-2 shadow-md">
            <label className="mb-2 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resolution ({scale}×)
              </span>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="mt-1 w-full accent-lumina-500"
              />
              <span className="flex justify-between text-xs text-slate-400">
                <span>1×</span><span>2×</span><span>3×</span><span>4×</span>
              </span>
            </label>

            <div className="border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => { void handleImageExport("png"); }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Export PNG
              </button>
              <button
                type="button"
                onClick={() => { void handleImageExport("svg"); }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Export SVG
              </button>
              <button
                type="button"
                onClick={handleHtmlExport}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Export Standalone HTML
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

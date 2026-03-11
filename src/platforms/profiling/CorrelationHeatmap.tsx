import { useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type { PlotData } from "plotly.js";
import { useCorrelation } from "@/api/profiling";

const Plot = createPlotlyComponent(Plotly);
const CORRELATION_METHODS = ["pearson", "spearman", "kendall"] as const;

interface HeatmapAnnotation {
  x: string;
  y: string;
  text: string;
  showarrow: false;
  font: {
    size: number;
    color: string;
  };
}

type CorrelationHeatmapTrace = Partial<PlotData> & {
  type: "heatmap";
  z: Array<Array<number | null>>;
  x: string[];
  y: string[];
  colorscale: string;
  zmid: number;
  zmin: number;
  zmax: number;
  showscale: boolean;
  hovertemplate: string;
};

export function CorrelationHeatmap({ datasetId }: { datasetId: string }) {
  const [method, setMethod] = useState<string>("pearson");
  const correlation = useCorrelation(datasetId, method);

  const annotations = useMemo<HeatmapAnnotation[]>(() => {
    const data = correlation.data;
    if (!data || data.columns.length === 0) {
      return [];
    }

    const fontSize = data.columns.length > 10 ? 8 : 11;
    return data.columns.flatMap((rowColumn, rowIndex) =>
      data.columns.map((column, columnIndex) => {
        const value = data.matrix[rowIndex]?.[columnIndex];

        return {
          x: column,
          y: rowColumn,
          text: value !== null ? value.toFixed(2) : "",
          showarrow: false,
          font: {
            size: fontSize,
            color: Math.abs(value ?? 0) > 0.5 ? "white" : "#334155",
          },
        };
      }),
    );
  }, [correlation.data]);

  const heatmapTrace = useMemo<CorrelationHeatmapTrace | null>(() => {
    if (!correlation.data || correlation.data.columns.length === 0) {
      return null;
    }

    return {
      type: "heatmap",
      z: correlation.data.matrix,
      x: correlation.data.columns,
      y: correlation.data.columns,
      colorscale: "RdBu",
      zmid: 0,
      zmin: -1,
      zmax: 1,
      showscale: true,
      hovertemplate: "%{y} ↔ %{x}<br>Correlation: %{z}<extra></extra>",
    };
  }, [correlation.data]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-800">Correlation Matrix</h3>
          <p className="text-xs text-slate-500">Pairwise rank and linear relationships across numeric columns.</p>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span>Method</span>
          <select
            aria-label="Correlation method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            {CORRELATION_METHODS.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {correlation.isLoading ? <div className="text-sm text-slate-500">Computing correlations…</div> : null}

      {correlation.error ? <div className="text-sm text-red-600">Failed to compute correlations: {correlation.error.message}</div> : null}

      {!correlation.isLoading && !correlation.error && (!correlation.data || correlation.data.columns.length === 0) ? (
        <div className="text-xs text-slate-400">No numeric columns for correlation.</div>
      ) : null}

      {correlation.data && correlation.data.columns.length > 0 && heatmapTrace ? (
        <div className="min-h-[300px] w-full">
          <Plot
            data={[heatmapTrace]}
            layout={{
              annotations,
              autosize: true,
              height: Math.max(300, 40 * correlation.data.columns.length + 100),
              margin: { l: 100, r: 20, t: 10, b: 80 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              xaxis: { tickangle: -45 },
              yaxis: { autorange: "reversed" },
            }}
            config={{ responsive: true, displayModeBar: false }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      ) : null}
    </section>
  );
}

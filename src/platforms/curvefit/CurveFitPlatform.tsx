import { useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { ApiError } from "@/api/client";
import { useCurveFitModels, useFitCurve } from "@/api/curve_fit";
import { useDatasetStore } from "@/stores/datasetStore";

const Plot = createPlotlyComponent(Plotly);

const FALLBACK_MODELS = [
  "linear",
  "quadratic",
  "exponential",
  "logarithmic",
  "power",
  "logistic_4pl",
  "michaelis_menten",
  "gaussian",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage ?? error.detail ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please check your inputs and try again.";
}

export function CurveFitPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);
  const numericColumns = useMemo(
    () => columns.filter((column) => column.dtype === "numeric").map((column) => column.name),
    [columns],
  );

  const { data: modelsData } = useCurveFitModels();
  const modelNames = useMemo(
    () => (modelsData ? modelsData.map((m) => m.name) : FALLBACK_MODELS),
    [modelsData],
  );

  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [modelName, setModelName] = useState("linear");

  const fitMutation = useFitCurve(datasetId);

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to run curve fitting analysis.
      </div>
    );
  }

  if (numericColumns.length < 2) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        This dataset has no numeric columns for curve fitting.
      </div>
    );
  }

  const activeX = xColumn || numericColumns[0];
  const activeY = yColumn || numericColumns[1];

  const handleFit = () => {
    fitMutation.mutate({ x_column: activeX, y_column: activeY, model_name: modelName });
  };

  const result = fitMutation.data;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto">
      {/* Controls */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Curve Fitting</h3>
        <p className="mt-1 text-xs text-slate-500">
          Fit a nonlinear model to two numeric columns and overlay the fitted curve.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">X (predictor)</span>
            <select
              aria-label="X column"
              value={activeX}
              onChange={(e) => setXColumn(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Y (response)</span>
            <select
              aria-label="Y column"
              value={activeY}
              onChange={(e) => setYColumn(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Model</span>
            <select
              aria-label="Model"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {modelNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleFit}
            disabled={fitMutation.isPending}
            className="rounded-md bg-lumina-700 px-4 py-2 text-sm font-medium text-white hover:bg-lumina-800 disabled:opacity-60"
          >
            {fitMutation.isPending ? "Fitting…" : "Fit"}
          </button>
        </div>

        {fitMutation.isError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {getErrorMessage(fitMutation.error)}
          </p>
        ) : null}
      </section>

      {/* Results */}
      {result ? (
        <>
          {/* Fit metrics */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Fit Quality</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">R²</p>
                <p className="text-lg font-bold text-slate-900">{result.r_squared.toFixed(4)}</p>
              </div>
              <div className="rounded-lg border border-lumina-200 bg-lumina-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-lumina-700">RMSE</p>
                <p className="text-lg font-bold text-slate-900">{result.rmse.toFixed(4)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">n</p>
                <p className="text-lg font-bold text-slate-900">{result.n}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model</p>
                <p className="text-lg font-bold text-slate-900">{result.model_name}</p>
              </div>
            </div>
          </section>

          {/* Scatter + fitted curve plot */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Data &amp; Fitted Curve</h3>
            <div className="mt-2 rounded border border-slate-200 p-2">
              <Plot
                data={[
                  {
                    x: result.x_data,
                    y: result.y_data,
                    type: "scatter",
                    mode: "markers",
                    name: "Data",
                    marker: { color: "#2563eb", size: 5, opacity: 0.6 },
                    hovertemplate: `${activeX}: %{x:.3f}<br>${activeY}: %{y:.3f}<extra></extra>`,
                  },
                  {
                    x: result.curve_x,
                    y: result.curve_y,
                    type: "scatter",
                    mode: "lines",
                    name: result.model_name,
                    line: { color: "#dc2626", width: 2 },
                    hovertemplate: "Fit: %{y:.3f}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 48, r: 12, t: 8, b: 36 },
                  showlegend: true,
                  legend: { font: { size: 10 } },
                  xaxis: { title: { text: activeX, font: { size: 11 } } },
                  yaxis: { title: { text: activeY, font: { size: 11 } } },
                }}
                useResizeHandler
                style={{ width: "100%", height: "280px" }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </section>

          {/* Parameters table */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Fitted Parameters</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-1 pr-4 text-left font-semibold text-slate-700">Parameter</th>
                    <th className="py-1 pr-4 text-right font-semibold text-slate-700">Value</th>
                    <th className="py-1 text-right font-semibold text-slate-700">Std Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.param_names.map((name, i) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="py-1 pr-4 font-medium text-slate-800">{name}</td>
                      <td className="py-1 pr-4 text-right tabular-nums text-slate-600">
                        {result.params[i].toFixed(5)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-slate-600">
                        {result.param_std_errors[i] != null
                          ? result.param_std_errors[i]!.toFixed(5)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

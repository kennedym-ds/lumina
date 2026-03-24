import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import { useExtendedDiagnostics } from "@/api/model";
import { OKABE_ITO_COLORWAY } from "@/constants/palette";

const Plot = createPlotlyComponent(Plotly);

interface ExtendedDiagnosticsProps {
  datasetId: string;
  modelType: string;
}

function formatMetric(value: number, digits = 4): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function buildFeatureImportanceFigure(featureImportances: Array<{ feature: string; importance: number }>): {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
} {
  const sorted = [...featureImportances].sort((left, right) => right.importance - left.importance);

  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: sorted.map((row) => row.importance),
        y: sorted.map((row) => row.feature),
        marker: { color: OKABE_ITO_COLORWAY[1] },
      },
    ],
    layout: {
      autosize: true,
      colorway: [...OKABE_ITO_COLORWAY],
      margin: { l: 100, r: 24, t: 24, b: 40 },
      xaxis: { title: { text: "Importance" } },
      yaxis: { autorange: "reversed" },
    },
  };
}

function buildCoefficientPathFigure(alphas: number[], paths: Record<string, number[]>): {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
} {
  return {
    data: Object.entries(paths).map(([feature, coefficients], index) => ({
      type: "scatter",
      mode: "lines",
      name: feature,
      x: alphas,
      y: coefficients,
      line: { color: OKABE_ITO_COLORWAY[index % OKABE_ITO_COLORWAY.length] },
    })),
    layout: {
      autosize: true,
      colorway: [...OKABE_ITO_COLORWAY],
      margin: { l: 56, r: 24, t: 24, b: 48 },
      xaxis: { title: { text: "Alpha" }, type: "log" },
      yaxis: { title: { text: "Coefficient" } },
      legend: { orientation: "h", y: -0.2 },
    },
  };
}

function buildPartialDependenceFigure(grid: number[], pdValues: number[], feature: string): {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
} {
  return {
    data: [
      {
        type: "scatter",
        mode: "lines",
        x: grid,
        y: pdValues,
        line: { color: OKABE_ITO_COLORWAY[0], width: 2 },
        name: feature,
      },
    ],
    layout: {
      autosize: true,
      colorway: [...OKABE_ITO_COLORWAY],
      margin: { l: 56, r: 16, t: 24, b: 48 },
      xaxis: { title: { text: feature } },
      yaxis: { title: { text: "Partial dependence" } },
    },
  };
}

export function ExtendedDiagnostics({ datasetId, modelType }: ExtendedDiagnosticsProps) {
  const diagnosticsQuery = useExtendedDiagnostics(datasetId, modelType);

  if (diagnosticsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading extended diagnostics...</p>;
  }

  if (diagnosticsQuery.isError || !diagnosticsQuery.data) {
    return <p className="text-sm text-slate-500">Extended diagnostics are not available for the current model yet.</p>;
  }

  const { feature_importances, coefficient_path, partial_dependence } = diagnosticsQuery.data;
  const hasAnyDiagnostics = Boolean(
    (feature_importances && feature_importances.length > 0) ||
      coefficient_path ||
      (partial_dependence && partial_dependence.length > 0),
  );

  if (!hasAnyDiagnostics) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        No extended diagnostics are available for the fitted {modelType} model.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {feature_importances && feature_importances.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Feature Importance</h3>
            <p className="text-xs text-slate-500">Sorted descending by relative contribution.</p>
          </div>
          <Plot
            data={buildFeatureImportanceFigure(feature_importances).data}
            layout={buildFeatureImportanceFigure(feature_importances).layout}
            useResizeHandler
            style={{ width: "100%", height: "320px" }}
            config={{ responsive: true }}
          />
        </section>
      ) : null}

      {coefficient_path ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Coefficient Path</h3>
            <p className="text-xs text-slate-500">Regularization path across {coefficient_path.alphas.length} alpha values.</p>
          </div>
          <Plot
            data={buildCoefficientPathFigure(coefficient_path.alphas, coefficient_path.paths).data}
            layout={buildCoefficientPathFigure(coefficient_path.alphas, coefficient_path.paths).layout}
            useResizeHandler
            style={{ width: "100%", height: "360px" }}
            config={{ responsive: true }}
          />
        </section>
      ) : null}

      {partial_dependence && partial_dependence.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Partial Dependence</h3>
            <p className="text-xs text-slate-500">Top features only, capped to keep the UI snappy.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {partial_dependence.map((entry) => {
              const figure = buildPartialDependenceFigure(entry.grid, entry.pd_values, entry.feature);

              return (
                <div key={entry.feature} className="rounded border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{entry.feature}</p>
                    <p className="text-xs text-slate-500">{formatMetric(entry.pd_values[entry.pd_values.length - 1] ?? 0)}</p>
                  </div>
                  <Plot
                    data={figure.data}
                    layout={figure.layout}
                    useResizeHandler
                    style={{ width: "100%", height: "280px" }}
                    config={{ responsive: true }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
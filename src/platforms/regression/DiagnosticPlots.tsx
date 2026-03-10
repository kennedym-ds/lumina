import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import type { DiagnosticsResponse } from "@/types/regression";

const Plot = createPlotlyComponent(Plotly);

type PlotlyFigure = {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
};

interface DiagnosticPlotsProps {
  diagnostics?: DiagnosticsResponse;
  isLoading: boolean;
  isError: boolean;
}

function toFigure(value: Record<string, unknown>): PlotlyFigure {
  const figure = value as { data?: PlotlyTypes.Data[]; layout?: Partial<PlotlyTypes.Layout> };

  return {
    data: figure.data ?? [],
    layout: figure.layout ?? {},
  };
}

export function DiagnosticPlots({ diagnostics, isLoading, isError }: DiagnosticPlotsProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading OLS diagnostics...</p>;
  }

  if (isError || !diagnostics) {
    return <p className="text-sm text-slate-500">Diagnostic plots are not available yet.</p>;
  }

  const residualsFigure = toFigure(diagnostics.residuals_vs_fitted);
  const qqFigure = toFigure(diagnostics.qq_plot);

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">OLS Diagnostics</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Residuals vs Fitted</p>
          <Plot
            data={residualsFigure.data}
            layout={{ ...residualsFigure.layout, autosize: true }}
            useResizeHandler
            style={{ width: "100%", height: "300px" }}
            config={{ responsive: true }}
          />
        </div>
        <div className="rounded border border-slate-200 p-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Q-Q Plot</p>
          <Plot
            data={qqFigure.data}
            layout={{ ...qqFigure.layout, autosize: true }}
            useResizeHandler
            style={{ width: "100%", height: "300px" }}
            config={{ responsive: true }}
          />
        </div>
      </div>
    </section>
  );
}

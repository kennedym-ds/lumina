import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import type { RocResponse } from "@/types/regression";

const Plot = createPlotlyComponent(Plotly);

type PlotlyFigure = {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
};

interface RocCurveProps {
  roc?: RocResponse;
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

export function RocCurve({ roc, isLoading, isError }: RocCurveProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading ROC curve...</p>;
  }

  if (isError || !roc) {
    return <p className="text-sm text-slate-500">ROC curve is not available yet.</p>;
  }

  const figure = toFigure(roc.roc_figure);

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">ROC Curve</h3>
        <p className="rounded bg-lumina-50 px-2 py-1 text-sm font-semibold text-lumina-700">
          AUC: {roc.auc.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </p>
      </div>

      <Plot
        data={figure.data}
        layout={{ ...figure.layout, autosize: true }}
        useResizeHandler
        style={{ width: "100%", height: "320px" }}
        config={{ responsive: true }}
      />
    </section>
  );
}

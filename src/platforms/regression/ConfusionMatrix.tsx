import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type * as PlotlyTypes from "plotly.js";
import type { ConfusionMatrixResponse } from "@/types/regression";

const Plot = createPlotlyComponent(Plotly);

type PlotlyFigure = {
  data: PlotlyTypes.Data[];
  layout: Partial<PlotlyTypes.Layout>;
};

interface ConfusionMatrixProps {
  confusion?: ConfusionMatrixResponse;
  isLoading: boolean;
  isError: boolean;
}

function formatMetric(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function toFigure(value: Record<string, unknown>): PlotlyFigure {
  const figure = value as { data?: PlotlyTypes.Data[]; layout?: Partial<PlotlyTypes.Layout> };

  return {
    data: figure.data ?? [],
    layout: figure.layout ?? {},
  };
}

export function ConfusionMatrix({ confusion, isLoading, isError }: ConfusionMatrixProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading confusion matrix...</p>;
  }

  if (isError || !confusion) {
    return <p className="text-sm text-slate-500">Confusion matrix is not available yet.</p>;
  }

  const figure = toFigure(confusion.heatmap_figure);

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Confusion Matrix</h3>

      <Plot
        data={figure.data}
        layout={{ ...figure.layout, autosize: true }}
        useResizeHandler
        style={{ width: "100%", height: "320px" }}
        config={{ responsive: true }}
      />

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 md:grid-cols-4">
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-600">Accuracy</p>
          <p>{formatMetric(confusion.accuracy)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-600">Precision</p>
          <p>{formatMetric(confusion.precision)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-600">Recall</p>
          <p>{formatMetric(confusion.recall)}</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-600">F1</p>
          <p>{formatMetric(confusion.f1)}</p>
        </div>
      </div>
    </section>
  );
}

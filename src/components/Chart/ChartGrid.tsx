import { ChartPanel } from "@/components/ChartBuilder/ChartPanel";
import { EmptyChartState } from "@/components/ChartBuilder/EmptyChartState";
import { useChartClipboard } from "@/hooks/useChartClipboard";
import type { ChartConfig, ChartType } from "@/types/eda";

interface ChartGridProps {
  charts: ChartConfig[];
  activeChartId: string | null;
  onSetActiveChart: (chartId: string) => void;
  onAddChart: () => void;
  onRemoveChart: (chartId: string) => void;
  onAddPreset?: (chartType: ChartType) => void;
  datasetId?: string | null;
}

const CHART_TYPE_LABEL: Record<ChartType, string> = {
  histogram: "Histogram",
  scatter: "Scatter",
  box: "Box",
  bar: "Bar",
  line: "Line",
  violin: "Violin",
  heatmap: "Heatmap",
  density: "Density",
  pie: "Pie",
  area: "Area",
  qq_plot: "Q-Q",
  bubble: "Bubble",
  strip: "Strip",
  error_bar: "Error Bar",
  treemap: "Treemap",
  parallel_coords: "Parallel",
};

const MAX_CHARTS = 8;

export function ChartGrid({
  charts,
  activeChartId,
  onSetActiveChart,
  onAddChart,
  onRemoveChart,
  onAddPreset,
  datasetId = null,
}: ChartGridProps) {
  const { copyChart } = useChartClipboard();

  if (charts.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col gap-3">
        <EmptyChartState onAddChart={onAddChart} onAddPreset={onAddPreset} />
      </section>
    );
  }

  const activeId = charts.some((chart) => chart.chartId === activeChartId) ? activeChartId : charts[0].chartId;
  const activeChart = charts.find((chart) => chart.chartId === activeId) ?? charts[0];

  const handleCopy = async () => {
    const element = document.querySelector<HTMLElement>(
      `[data-chart-panel="${activeChart.chartId}"] .js-plotly-plot`,
    );
    if (element) {
      await copyChart(element);
    }
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      {/* Tabs — one per chart, swap between plots */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {charts.map((chart, index) => {
            const isActive = chart.chartId === activeId;
            return (
              <div
                key={chart.chartId}
                className={`group flex shrink-0 items-center gap-1 border-b-2 px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "border-lumina-500 font-medium text-lumina-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSetActiveChart(chart.chartId)}
                  className="whitespace-nowrap"
                >
                  {index + 1}. {CHART_TYPE_LABEL[chart.chartType]}
                </button>
                {charts.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remove chart"
                    onClick={() => onRemoveChart(chart.chartId)}
                    className="rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {charts.length < MAX_CHARTS ? (
          <button
            type="button"
            onClick={onAddChart}
            aria-label="Add chart"
            title="Add chart"
            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-lumina-700 transition hover:bg-lumina-50"
          >
            <span aria-hidden="true">＋</span>
            <span>Add</span>
          </button>
        ) : null}
      </div>

      {/* Active chart — fills the available area */}
      <div className="relative min-h-0 min-w-0 flex-1" data-chart-panel={activeChart.chartId}>
        <button
          type="button"
          aria-label="Copy chart image"
          title="Copy chart to clipboard"
          onClick={() => {
            void handleCopy();
          }}
          className="absolute right-2 top-2 z-10 rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          ⎘
        </button>
        <ChartPanel chartId={activeChart.chartId} datasetId={datasetId} />
      </div>
    </section>
  );
}

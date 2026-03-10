import type { KeyboardEvent } from "react";
import { ChartPanel } from "@/components/ChartBuilder/ChartPanel";
import { EmptyChartState } from "@/components/ChartBuilder/EmptyChartState";
import { useChartClipboard } from "@/hooks/useChartClipboard";
import type { ChartConfig } from "@/types/eda";

interface ChartGridProps {
  charts: ChartConfig[];
  activeChartId: string | null;
  onSetActiveChart: (chartId: string) => void;
  onAddChart: () => void;
  onRemoveChart: (chartId: string) => void;
  datasetId?: string | null;
}

function getGridClassName(chartCount: number): string {
  if (chartCount <= 1) {
    return "grid-cols-1";
  }

  if (chartCount === 2) {
    return "grid-cols-1 xl:grid-cols-2";
  }

  return "grid-cols-1 xl:grid-cols-2";
}

export function ChartGrid({
  charts,
  activeChartId,
  onSetActiveChart,
  onAddChart,
  onRemoveChart,
  datasetId = null,
}: ChartGridProps) {
  const { copyChart } = useChartClipboard();

  const handleChartKeyDown = async (event: KeyboardEvent<HTMLElement>, chartId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSetActiveChart(chartId);
      return;
    }

    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") {
      return;
    }

    const host = event.currentTarget;
    const plotlyElement = host.querySelector<HTMLElement>(".js-plotly-plot");
    if (!plotlyElement) {
      return;
    }

    event.preventDefault();
    await copyChart(plotlyElement);
  };

  if (charts.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col gap-3">
        <EmptyChartState onAddChart={onAddChart} />
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className={`grid min-h-0 gap-3 ${getGridClassName(charts.length)}`}>
        {charts.map((chart) => {
          const isActive = activeChartId === chart.chartId;

          return (
            <article
              key={chart.chartId}
              className={`relative min-h-[420px] rounded-lg ${isActive ? "ring-2 ring-lumina-200" : ""}`}
              onClick={() => onSetActiveChart(chart.chartId)}
              onFocus={() => onSetActiveChart(chart.chartId)}
              onKeyDown={(event) => {
                void handleChartKeyDown(event, chart.chartId);
              }}
              tabIndex={0}
            >
              <button
                type="button"
                aria-label="Remove chart"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveChart(chart.chartId);
                }}
                className="absolute right-2 top-2 z-10 rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                ✕
              </button>

              <ChartPanel chartId={chart.chartId} datasetId={datasetId} />
            </article>
          );
        })}
      </div>

      {charts.length < 8 ? (
        <button
          type="button"
          onClick={onAddChart}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-lumina-300 bg-white px-3 py-2 text-sm font-medium text-lumina-700 hover:bg-lumina-50"
        >
          <span aria-hidden="true">＋</span>
          <span>Add Chart</span>
        </button>
      ) : null}
    </section>
  );
}

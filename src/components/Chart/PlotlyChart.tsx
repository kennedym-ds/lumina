import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { OKABE_ITO_COLORWAY } from "@/constants/palette";
import type { ChartResponse } from "@/types/eda";

const Plot = createPlotlyComponent(Plotly);

interface PlotlyChartProps {
  chartResponse: ChartResponse | undefined;
  isLoading: boolean;
  error?: string;
  selectedIndices?: number[];
  isSelectionSource?: boolean;
  onSelected?: (indices: number[]) => void;
  onDeselect?: () => void;
}

export function PlotlyChart({
  chartResponse,
  isLoading,
  error,
  selectedIndices = [],
  isSelectionSource = false,
  onSelected,
  onDeselect,
}: PlotlyChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-lumina-500" />
          Loading chart...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-sm text-red-600">
        Failed to load chart: {error}
      </div>
    );
  }

  const hasSelection = selectedIndices.length > 0;
  const selectionSet = useMemo(() => new Set(selectedIndices), [selectedIndices]);

  const displayData = useMemo(() => {
    if (!chartResponse) return [];
    const traces = chartResponse.plotly_figure.data;

    if (!hasSelection || isSelectionSource) {
      // Source chart uses Plotly's native selection highlighting
      if (hasSelection && isSelectionSource) {
        return traces.map((trace: Record<string, unknown>) => ({
          ...trace,
          selectedpoints: selectedIndices,
        }));
      }
      return traces;
    }

    // Non-source charts: apply opacity dimming
    return traces.map((trace: Record<string, unknown>) => {
      const xArr = trace.x as unknown[] | undefined;
      const yArr = trace.y as unknown[] | undefined;
      const pointCount = xArr?.length ?? yArr?.length ?? 0;

      if (pointCount === 0) return trace;

      const opacityArray = Array.from({ length: pointCount }, (_, i) =>
        selectionSet.has(i) ? 1.0 : 0.15,
      );

      return {
        ...trace,
        marker: {
          ...(trace.marker as Record<string, unknown> | undefined),
          opacity: opacityArray,
        },
        selectedpoints: selectedIndices,
      };
    });
  }, [chartResponse, hasSelection, isSelectionSource, selectedIndices, selectionSet]);

  if (!chartResponse) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-sm text-slate-500">
        Assign variables to render a chart.
      </div>
    );
  }

  const handleSelected = (event: { points: Array<{ pointIndex: number }> }) => {
    if (onSelected && event.points?.length > 0) {
      const indices = event.points.map((p) => p.pointIndex);
      onSelected(indices);
    }
  };

  const handleDeselect = () => {
    onDeselect?.();
  };

  return (
    <div className="h-full min-h-[260px] w-full">
      <Plot
        data={displayData}
        layout={{
          ...chartResponse.plotly_figure.layout,
          autosize: true,
          colorway: [...OKABE_ITO_COLORWAY],
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          dragmode: "select",
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToAdd: ["lasso2d", "select2d"],
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
        onSelected={handleSelected}
        onDeselect={handleDeselect}
      />
    </div>
  );
}

import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { OKABE_ITO_COLORWAY } from "@/constants/palette";
import type { ChartResponse } from "@/types/eda";

const Plot = createPlotlyComponent(Plotly);
const EMPTY_SELECTED_ROW_IDS = new Set<number>();

type PlotlyTrace = Record<string, unknown>;

function toRowId(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTraceCustomdata(trace: PlotlyTrace): number[] | null {
  if (!Array.isArray(trace.customdata)) {
    return null;
  }

  const rowIds = trace.customdata.map(toRowId);
  return rowIds.every((rowId): rowId is number => rowId !== null) ? rowIds : null;
}

function getSelectedPoints(trace: PlotlyTrace, selectedRowIds: ReadonlySet<number>): number[] {
  const customdata = getTraceCustomdata(trace);
  if (customdata) {
    return customdata
      .map((rowId, index) => (selectedRowIds.has(rowId) ? index : -1))
      .filter((index) => index >= 0);
  }

  return Array.from(selectedRowIds).filter((index) => Number.isInteger(index) && index >= 0);
}

interface PlotlyChartProps {
  chartResponse: ChartResponse | undefined;
  isLoading: boolean;
  error?: string;
  selectedRowIds?: ReadonlySet<number>;
  isSelectionSource?: boolean;
  onSelected?: (rowIds: number[]) => void;
  onDeselect?: () => void;
}

export function PlotlyChart({
  chartResponse,
  isLoading,
  error,
  selectedRowIds = EMPTY_SELECTED_ROW_IDS,
  isSelectionSource = false,
  onSelected,
  onDeselect,
}: PlotlyChartProps) {
  const hasSelection = selectedRowIds.size > 0;

  const displayData = useMemo(() => {
    if (!chartResponse) return [];
    const traces = chartResponse.plotly_figure.data as PlotlyTrace[];

    if (!hasSelection) {
      return traces;
    }

    if (isSelectionSource) {
      return traces.map((trace) => {
        const selectedPoints = getSelectedPoints(trace, selectedRowIds);
        return selectedPoints.length > 0 ? { ...trace, selectedpoints: selectedPoints } : trace;
      });
    }

    return traces.map((trace) => {
      const customdata = getTraceCustomdata(trace);
      const xArr = Array.isArray(trace.x) ? trace.x : undefined;
      const yArr = Array.isArray(trace.y) ? trace.y : undefined;
      const pointCount = xArr?.length ?? yArr?.length ?? 0;

      if (!customdata || pointCount === 0 || customdata.length !== pointCount) {
        return trace;
      }

      const opacityArray = customdata.map((rowId) => (selectedRowIds.has(rowId) ? 1 : 0.15));
      const selectedPoints = getSelectedPoints(trace, selectedRowIds);

      return {
        ...trace,
        marker: {
          ...(trace.marker as Record<string, unknown> | undefined),
          opacity: opacityArray,
        },
        selectedpoints: selectedPoints,
      };
    });
  }, [chartResponse, hasSelection, isSelectionSource, selectedRowIds]);

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

  if (!chartResponse) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-sm text-slate-500">
        Assign variables to render a chart.
      </div>
    );
  }

  const handleSelected = (event: { points: Array<{ pointIndex: number; customdata?: unknown }> }) => {
    if (onSelected && event.points?.length > 0) {
      const rowIds = event.points
        .map((point) => toRowId(point.customdata) ?? point.pointIndex)
        .filter((rowId): rowId is number => Number.isInteger(rowId) && rowId >= 0);
      onSelected(rowIds);
    }
  };

  const handleDeselect = () => {
    onDeselect?.();
  };

  return (
    <div className="h-full min-h-[260px] w-full">
      {chartResponse?.downsampled && (
        <div className="mb-2 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
          <span>⚡</span>
          <span>
            Showing {chartResponse.displayed_row_count?.toLocaleString()} of{" "}
            {chartResponse.row_count.toLocaleString()} points (downsampled)
          </span>
        </div>
      )}
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

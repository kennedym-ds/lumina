import { useCallback, useMemo, useRef } from "react";
import { useChartData } from "@/api/eda";
import { PlotlyChart } from "@/components/Chart/PlotlyChart";
import { ChartTypeSelector } from "@/components/ChartBuilder/ChartTypeSelector";
import { VariableShelf, type ShelfType } from "@/components/ChartBuilder/VariableShelf";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ChartConfig, ChartType } from "@/types/eda";
import type { ColumnInfo } from "@/types/data";

interface ChartPanelProps {
  chartId: string;
  datasetId: string | null;
}

const DEBOUNCE_MS = 150;

const visibleShelvesByChartType: Record<ChartType, ShelfType[]> = {
  histogram: ["x", "color", "facet"],
  scatter: ["x", "y", "color", "facet"],
  box: ["y", "color", "facet"],
  bar: ["x", "y", "color", "facet"],
  line: ["x", "y", "color", "facet"],
  violin: ["x", "y", "color", "facet"],
  heatmap: ["x", "y", "facet"],
  density: ["x", "y", "facet"],
  pie: ["x"],
  area: ["x", "y", "color", "facet"],
  qq_plot: ["x"],
  bubble: ["x", "y", "size", "color", "facet"],
  strip: ["x", "y", "color", "facet"],
  error_bar: ["x", "y", "color", "facet"],
  treemap: ["x", "y"],
  parallel_coords: ["color"],
};

function getVisibleShelves(chartType: ChartType): Set<ShelfType> {
  return new Set(visibleShelvesByChartType[chartType]);
}

function getHeatmapAggregation(chart: ChartConfig): string {
  return chart.aggregation ?? "count";
}

function suggestChartTypes(config: ChartConfig, columns: readonly ColumnInfo[]): ReadonlySet<ChartType> {
  const dtype = (name: string | null) => name ? (columns.find((c) => c.name === name)?.dtype ?? null) : null;
  const xDtype = dtype(config.x);
  const yDtype = dtype(config.y);

  if (xDtype === "numeric" && yDtype === "numeric") return new Set<ChartType>(["scatter", "bubble", "density"]);
  if (xDtype === "categorical" && yDtype === "numeric") return new Set<ChartType>(["box", "violin", "bar", "strip"]);
  if (xDtype === "datetime" && yDtype === "numeric") return new Set<ChartType>(["line", "area"]);
  if (xDtype === "categorical" && yDtype === "categorical") return new Set<ChartType>(["heatmap"]);
  if (xDtype === "numeric" && !config.y) return new Set<ChartType>(["histogram", "qq_plot"]);
  if (xDtype === "categorical" && !config.y) return new Set<ChartType>(["pie", "bar"]);
  return new Set<ChartType>();
}

function supportsValuesField(chart: ChartConfig): boolean {
  if (chart.chartType === "pie") {
    return true;
  }

  return chart.chartType === "heatmap" && getHeatmapAggregation(chart) !== "count";
}

export function ChartPanel({ chartId, datasetId }: ChartPanelProps) {
  const chart = useChartStore((state) => state.charts.find((item) => item.chartId === chartId) ?? null);
  const updateChart = useChartStore((state) => state.updateChart);
  const columns = useDatasetStore((state) => state.columns);

  const selectedRowIds = useCrossFilterStore((state) => state.selectedRowIds);
  const selectionSource = useCrossFilterStore((state) => state.selectionSource);
  const setSelection = useCrossFilterStore((state) => state.setSelection);
  const clearSelection = useCrossFilterStore((state) => state.clearSelection);

  const chartQuery = useChartData(datasetId, chart);
  const visibleShelves = useMemo(() => (chart ? getVisibleShelves(chart.chartType) : new Set<ShelfType>()), [chart]);
  const numericColumns = useMemo(
    () => [...columns].filter((column) => column.dtype === "numeric").sort((left, right) => left.name.localeCompare(right.name)),
    [columns],
  );

  const suggestedTypes = useMemo(() => (chart ? suggestChartTypes(chart, columns) : new Set<ChartType>()), [chart, columns]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelected = useCallback(
    (rowIds: number[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSelection(chartId, rowIds);
      }, DEBOUNCE_MS);
    },
    [chartId, setSelection],
  );

  const handleDeselect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectionSource === chartId) {
      clearSelection();
    }
  }, [chartId, selectionSource, clearSelection]);

  if (!chart) {
    return null;
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <ChartTypeSelector
        value={chart.chartType}
        onChange={(chartType) => updateChart(chart.chartId, { chartType })}
        suggestedTypes={suggestedTypes}
      />

      <div className="grid gap-2 md:grid-cols-2">
        {visibleShelves.has("x") ? (
          <VariableShelf
            chartId={chart.chartId}
            shelfType="x"
            value={chart.x}
            onDrop={(columnName) => updateChart(chart.chartId, { x: columnName })}
            onRemove={() => updateChart(chart.chartId, { x: null })}
          />
        ) : null}
        {visibleShelves.has("y") ? (
          <VariableShelf
            chartId={chart.chartId}
            shelfType="y"
            value={chart.y}
            onDrop={(columnName) => updateChart(chart.chartId, { y: columnName })}
            onRemove={() => updateChart(chart.chartId, { y: null })}
          />
        ) : null}
        {visibleShelves.has("color") ? (
          <VariableShelf
            chartId={chart.chartId}
            shelfType="color"
            value={chart.color}
            onDrop={(columnName) => updateChart(chart.chartId, { color: columnName })}
            onRemove={() => updateChart(chart.chartId, { color: null })}
          />
        ) : null}
        {visibleShelves.has("facet") ? (
          <VariableShelf
            chartId={chart.chartId}
            shelfType="facet"
            value={chart.facet}
            onDrop={(columnName) => updateChart(chart.chartId, { facet: columnName })}
            onRemove={() => updateChart(chart.chartId, { facet: null })}
          />
        ) : null}
        {visibleShelves.has("size") ? (
          <VariableShelf
            chartId={chart.chartId}
            shelfType="size"
            value={chart.size ?? null}
            onDrop={(columnName) => updateChart(chart.chartId, { size: columnName })}
            onRemove={() => updateChart(chart.chartId, { size: null })}
          />
        ) : null}

        {(chart.chartType === "scatter" || chart.chartType === "bubble") ? (
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trend line</span>
            <select
              aria-label="Trend line"
              value={chart.trendline ?? ""}
              onChange={(event) => updateChart(chart.chartId, { trendline: event.target.value || null })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="">None</option>
              <option value="linear">Linear + 95% CI</option>
              <option value="lowess">LOWESS (smooth)</option>
            </select>
          </label>
        ) : null}

        {chart.chartType === "histogram" ? (
          <label className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={chart.show_kde ?? false}
              onChange={(event) => updateChart(chart.chartId, { show_kde: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Overlay KDE curve</span>
          </label>
        ) : null}

        {chart.chartType === "heatmap" ? (
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Heatmap aggregation</span>
            <select
              aria-label="Heatmap aggregation"
              value={getHeatmapAggregation(chart)}
              onChange={(event) => updateChart(chart.chartId, { aggregation: event.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="mean">Mean</option>
            </select>
          </label>
        ) : null}

        {supportsValuesField(chart) ? (
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Values column</span>
            <select
              aria-label="Values column"
              value={chart.values ?? ""}
              onChange={(event) => updateChart(chart.chartId, { values: event.target.value || null })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="">None</option>
              {numericColumns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 rounded-md border border-slate-200 bg-slate-50">
        <PlotlyChart
          chartResponse={chartQuery.data}
          isLoading={chartQuery.isLoading}
          error={chartQuery.error?.message}
          selectedRowIds={selectedRowIds}
          isSelectionSource={selectionSource === chartId}
          onSelected={handleSelected}
          onDeselect={handleDeselect}
        />
      </div>
    </div>
  );
}

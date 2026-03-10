import { useCallback, useRef } from "react";
import { useChartData } from "@/api/eda";
import { PlotlyChart } from "@/components/Chart/PlotlyChart";
import { ChartTypeSelector } from "@/components/ChartBuilder/ChartTypeSelector";
import { VariableShelf } from "@/components/ChartBuilder/VariableShelf";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";

interface ChartPanelProps {
  chartId: string;
  datasetId: string | null;
}

const DEBOUNCE_MS = 150;

export function ChartPanel({ chartId, datasetId }: ChartPanelProps) {
  const chart = useChartStore((state) => state.charts.find((item) => item.chartId === chartId) ?? null);
  const updateChart = useChartStore((state) => state.updateChart);

  const selectedIndices = useCrossFilterStore((state) => state.selectedIndices);
  const selectionSource = useCrossFilterStore((state) => state.selectionSource);
  const setSelection = useCrossFilterStore((state) => state.setSelection);
  const clearSelection = useCrossFilterStore((state) => state.clearSelection);

  const chartQuery = useChartData(datasetId, chart);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelected = useCallback(
    (indices: number[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSelection(chartId, indices);
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
      <ChartTypeSelector value={chart.chartType} onChange={(chartType) => updateChart(chart.chartId, { chartType })} />

      <div className="grid gap-2 md:grid-cols-2">
        <VariableShelf
          chartId={chart.chartId}
          shelfType="x"
          value={chart.x}
          onDrop={(columnName) => updateChart(chart.chartId, { x: columnName })}
          onRemove={() => updateChart(chart.chartId, { x: null })}
        />
        <VariableShelf
          chartId={chart.chartId}
          shelfType="y"
          value={chart.y}
          onDrop={(columnName) => updateChart(chart.chartId, { y: columnName })}
          onRemove={() => updateChart(chart.chartId, { y: null })}
        />
        <VariableShelf
          chartId={chart.chartId}
          shelfType="color"
          value={chart.color}
          onDrop={(columnName) => updateChart(chart.chartId, { color: columnName })}
          onRemove={() => updateChart(chart.chartId, { color: null })}
        />
        <VariableShelf
          chartId={chart.chartId}
          shelfType="facet"
          value={chart.facet}
          onDrop={(columnName) => updateChart(chart.chartId, { facet: columnName })}
          onRemove={() => updateChart(chart.chartId, { facet: null })}
        />
      </div>

      <div className="min-h-0 flex-1 rounded-md border border-slate-200 bg-slate-50">
        <PlotlyChart
          chartResponse={chartQuery.data}
          isLoading={chartQuery.isLoading}
          error={chartQuery.error?.message}
          selectedIndices={selectedIndices}
          isSelectionSource={selectionSource === chartId}
          onSelected={handleSelected}
          onDeselect={handleDeselect}
        />
      </div>
    </div>
  );
}

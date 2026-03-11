import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChartData } from "@/api/eda";
import { PlotlyChart } from "@/components/Chart/PlotlyChart";
import { useChartStore } from "@/stores/chartStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { type DashboardPanel, useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import type { ChartConfig } from "@/types/eda";

const DEBOUNCE_MS = 150;
const PANEL_SIZE_PRESETS = {
  small: { w: 2, h: 1 },
  medium: { w: 3, h: 2 },
  large: { w: 6, h: 2 },
} as const;

function getChartLabel(chart: ChartConfig | null): string {
  if (!chart) {
    return "Unavailable chart";
  }

  const axisParts = [chart.x, chart.y].filter((value): value is string => Boolean(value));
  return axisParts.length > 0 ? `${chart.chartType} · ${axisParts.join(" vs ")}` : `${chart.chartType} chart`;
}

function getChartDescription(chart: ChartConfig | null): string {
  if (!chart) {
    return "This panel references a chart that is no longer available.";
  }

  const parts = [chart.color ? `Color: ${chart.color}` : null, chart.facet ? `Facet: ${chart.facet}` : null].filter(
    (value): value is string => value !== null,
  );
  return parts.length > 0 ? parts.join(" • ") : "Cross-filter interactions stay in sync across dashboard panels.";
}

interface DashboardTileProps {
  panel: DashboardPanel;
  chart: ChartConfig | null;
  datasetId: string | null;
  onRemove: (panelId: string) => void;
  onResize: (panelId: string, size: { w: number; h: number }) => void;
}

function DashboardTile({ panel, chart, datasetId, onRemove, onResize }: DashboardTileProps) {
  const selectedRowIds = useCrossFilterStore((state) => state.selectedRowIds);
  const selectionSource = useCrossFilterStore((state) => state.selectionSource);
  const setSelection = useCrossFilterStore((state) => state.setSelection);
  const clearSelection = useCrossFilterStore((state) => state.clearSelection);
  const chartQuery = useChartData(datasetId, chart);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelected = useCallback(
    (rowIds: number[]) => {
      if (!chart) {
        return;
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setSelection(chart.chartId, rowIds);
      }, DEBOUNCE_MS);
    },
    [chart, setSelection],
  );

  const handleDeselect = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (chart && selectionSource === chart.chartId) {
      clearSelection();
    }
  }, [chart, clearSelection, selectionSource]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <article
      data-testid={`dashboard-panel-${panel.id}`}
      className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{
        gridColumn: `${panel.x + 1} / span ${panel.w}`,
        gridRow: `${panel.y + 1} / span ${panel.h}`,
      }}
    >
      <div data-testid="dashboard-panel" className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-800">{getChartLabel(chart)}</h2>
          <p className="mt-1 text-xs text-slate-500">{getChartDescription(chart)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {Object.entries(PANEL_SIZE_PRESETS).map(([key, size]) => (
              <button
                key={key}
                type="button"
                onClick={() => onResize(panel.id, size)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  panel.w === size.w && panel.h === size.h
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {key[0]?.toUpperCase()}
                {key.slice(1)}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Remove panel"
            onClick={() => onRemove(panel.id)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-slate-50 p-3">
        {chart ? (
          <PlotlyChart
            chartResponse={chartQuery.data}
            isLoading={chartQuery.isLoading}
            error={chartQuery.error?.message}
            selectedRowIds={selectedRowIds}
            isSelectionSource={selectionSource === chart.chartId}
            onSelected={handleSelected}
            onDeselect={handleDeselect}
          />
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-sm text-slate-500">
            Recreate or remove this chart panel to continue.
          </div>
        )}
      </div>
    </article>
  );
}

export function DashboardPlatform() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const charts = useChartStore((state) => state.charts);
  const panels = useDashboardStore((state) => state.panels);
  const addPanel = useDashboardStore((state) => state.addPanel);
  const removePanel = useDashboardStore((state) => state.removePanel);
  const updatePanelLayout = useDashboardStore((state) => state.updatePanelLayout);
  const [selectedChartId, setSelectedChartId] = useState<string>("");

  const chartsById = useMemo(() => new Map(charts.map((chart) => [chart.chartId, chart])), [charts]);

  useEffect(() => {
    if (selectedChartId && charts.some((chart) => chart.chartId === selectedChartId)) {
      return;
    }

    setSelectedChartId(charts[0]?.chartId ?? "");
  }, [charts, selectedChartId]);

  const handleAddPanel = () => {
    if (!selectedChartId) {
      return;
    }

    addPanel(selectedChartId);
  };

  if (!datasetId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Import a dataset to build a dashboard.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-sm font-semibold text-slate-800">Dashboard builder</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pin chart configurations side-by-side and keep cross-filter selections synchronized.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Chart</span>
            <select
              aria-label="Dashboard chart selection"
              value={selectedChartId}
              onChange={(event) => setSelectedChartId(event.target.value)}
              disabled={charts.length === 0}
              className="min-w-[220px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {charts.length === 0 ? <option value="">Create a chart in Charts first</option> : null}
              {charts.map((chart) => (
                <option key={chart.chartId} value={chart.chartId}>
                  {getChartLabel(chart)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleAddPanel}
            disabled={!selectedChartId}
            className="inline-flex h-[42px] items-center gap-2 rounded-md border border-lumina-300 bg-white px-3 py-2 text-sm font-medium text-lumina-700 hover:bg-lumina-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true">＋</span>
            <span>Add Chart</span>
          </button>
        </div>
      </section>

      {panels.length === 0 ? (
        <section className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <div className="max-w-md space-y-3">
            <div className="text-4xl">🧩</div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">No charts on this dashboard yet.</h2>
              <p className="mt-2 text-sm text-slate-500">
                Choose an existing chart configuration, then add it here to compare visuals side-by-side.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPanel}
              disabled={!selectedChartId}
              className="inline-flex items-center gap-2 rounded-md border border-lumina-300 bg-white px-4 py-2 text-sm font-medium text-lumina-700 hover:bg-lumina-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true">＋</span>
              <span>Add your first chart</span>
            </button>
          </div>
        </section>
      ) : (
        <section
          className="grid min-h-0 flex-1 auto-rows-[180px] gap-3 overflow-auto rounded-xl border border-slate-200 bg-slate-100/60 p-3"
          style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
        >
          {panels.map((panel) => (
            <DashboardTile
              key={panel.id}
              panel={panel}
              chart={chartsById.get(panel.chartId) ?? null}
              datasetId={datasetId}
              onRemove={removePanel}
              onResize={(panelId, size) => updatePanelLayout(panelId, size)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

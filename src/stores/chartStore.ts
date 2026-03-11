import { create } from "zustand";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import type { ChartConfig, ChartType } from "@/types/eda";

const MAX_CHARTS = 8;

const generateChartId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `chart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyChart = (chartType: ChartType = "histogram"): ChartConfig => ({
  chartId: generateChartId(),
  chartType,
  x: null,
  y: null,
  color: null,
  facet: null,
  aggregation: null,
  values: null,
});

function cloneCharts(charts: ChartConfig[]): ChartConfig[] {
  return charts.map((chart) => ({ ...chart }));
}

function getUpdateLabel(updates: Partial<ChartConfig>): string {
  if ("chartType" in updates) {
    return "Change Chart Type";
  }

  if ("x" in updates) {
    return "Change X axis";
  }

  if ("y" in updates) {
    return "Change Y axis";
  }

  if ("color" in updates) {
    return "Change Color";
  }

  if ("facet" in updates) {
    return "Change Facet";
  }

  if ("aggregation" in updates) {
    return "Change Aggregation";
  }

  if ("values" in updates) {
    return "Change Values";
  }

  return "Update Chart";
}

interface ChartStoreState {
  charts: ChartConfig[];
  activeChartId: string | null;
  addChart: () => string;
  removeChart: (chartId: string) => void;
  updateChart: (chartId: string, updates: Partial<ChartConfig>) => void;
  setActiveChart: (chartId: string) => void;
  hydrateCharts: (charts: ChartConfig[], activeChartId: string | null) => void;
  clearCharts: () => void;
}

export const useChartStore = create<ChartStoreState>((set, get) => ({
  charts: [],
  activeChartId: null,
  addChart: () => {
    const state = get();

    if (state.charts.length >= MAX_CHARTS) {
      return state.activeChartId ?? state.charts[0]?.chartId ?? "";
    }

    useUndoRedoStore.getState().pushSnapshot({
      charts: cloneCharts(state.charts),
      activeChartId: state.activeChartId,
      label: "Add Chart",
    });

    const newChart = createEmptyChart();
    set({
      charts: [...state.charts, newChart],
      activeChartId: newChart.chartId,
    });

    return newChart.chartId;
  },
  removeChart: (chartId) => {
    const state = get();
    const exists = state.charts.some((chart) => chart.chartId === chartId);
    if (!exists) {
      return;
    }

    useUndoRedoStore.getState().pushSnapshot({
      charts: cloneCharts(state.charts),
      activeChartId: state.activeChartId,
      label: "Remove Chart",
    });

    const nextCharts = state.charts.filter((chart) => chart.chartId !== chartId);

    if (state.activeChartId !== chartId) {
      set({ charts: nextCharts });
      return;
    }

    set({
      charts: nextCharts,
      activeChartId: nextCharts[0]?.chartId ?? null,
    });
  },
  updateChart: (chartId, updates) => {
    const state = get();
    const existing = state.charts.find((chart) => chart.chartId === chartId);
    if (!existing) {
      return;
    }

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      return existing[key as keyof ChartConfig] !== value;
    });

    if (!hasChanges) {
      return;
    }

    useUndoRedoStore.getState().pushSnapshot({
      charts: cloneCharts(state.charts),
      activeChartId: state.activeChartId,
      label: getUpdateLabel(updates),
    });

    set((state) => ({
      charts: state.charts.map((chart) =>
        chart.chartId === chartId
          ? {
              ...chart,
              ...updates,
              chartId,
            }
          : chart,
      ),
    }));
  },
  setActiveChart: (chartId) => {
    const exists = get().charts.some((chart) => chart.chartId === chartId);
    if (!exists) {
      return;
    }

    set({ activeChartId: chartId });
  },
  hydrateCharts: (charts, activeChartId) => {
    const nextActive = activeChartId && charts.some((chart) => chart.chartId === activeChartId)
      ? activeChartId
      : charts[0]?.chartId ?? null;

    set({
      charts,
      activeChartId: nextActive,
    });
  },
  clearCharts: () => {
    const state = get();
    if (state.charts.length > 0 || state.activeChartId !== null) {
      useUndoRedoStore.getState().pushSnapshot({
        charts: cloneCharts(state.charts),
        activeChartId: state.activeChartId,
        label: "Clear Charts",
      });
    }

    set({ charts: [], activeChartId: null });
  },
}));

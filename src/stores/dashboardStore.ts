import { create } from "zustand";

const GRID_COLUMNS = 6;
const DEFAULT_PANEL_WIDTH = 3;
const DEFAULT_PANEL_HEIGHT = 2;
const MIN_PANEL_WIDTH = 1;
const MAX_PANEL_WIDTH = GRID_COLUMNS;
const MIN_PANEL_HEIGHT = 1;
const MAX_PANEL_HEIGHT = 4;

export interface DashboardPanel {
  id: string;
  chartId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardState {
  panels: DashboardPanel[];
  isActive: boolean;
  addPanel: (chartId: string) => void;
  removePanel: (panelId: string) => void;
  updatePanelLayout: (
    panelId: string,
    layout: Partial<Pick<DashboardPanel, "x" | "y" | "w" | "h">>,
  ) => void;
  toggleDashboard: () => void;
  clearDashboard: () => void;
  hydrate: (panels: DashboardPanel[]) => void;
}

function generatePanelId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePanel(panel: DashboardPanel): DashboardPanel {
  const width = clamp(Math.round(panel.w), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
  const height = clamp(Math.round(panel.h), MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT);
  const x = clamp(Math.round(panel.x), 0, GRID_COLUMNS - width);
  const y = Math.max(0, Math.round(panel.y));

  return {
    ...panel,
    x,
    y,
    w: width,
    h: height,
  };
}

function panelsOverlap(left: DashboardPanel, right: DashboardPanel): boolean {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}

function canPlacePanel(panels: DashboardPanel[], candidate: DashboardPanel, panelId?: string): boolean {
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + candidate.w > GRID_COLUMNS) {
    return false;
  }

  return panels.every((panel) => {
    if (panel.id === panelId) {
      return true;
    }

    return !panelsOverlap(panel, candidate);
  });
}

function findNextAvailableSlot(
  panels: DashboardPanel[],
  width = DEFAULT_PANEL_WIDTH,
  height = DEFAULT_PANEL_HEIGHT,
): Pick<DashboardPanel, "x" | "y"> {
  for (let y = 0; y < 500; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
      const candidate = normalizePanel({
        id: "candidate",
        chartId: "candidate",
        x,
        y,
        w: width,
        h: height,
      });

      if (canPlacePanel(panels, candidate)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return { x: 0, y: panels.length * DEFAULT_PANEL_HEIGHT };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  panels: [],
  isActive: false,
  addPanel: (chartId) => {
    const state = get();
    const { x, y } = findNextAvailableSlot(state.panels);

    set({
      panels: [
        ...state.panels,
        {
          id: generatePanelId(),
          chartId,
          x,
          y,
          w: DEFAULT_PANEL_WIDTH,
          h: DEFAULT_PANEL_HEIGHT,
        },
      ],
      isActive: true,
    });
  },
  removePanel: (panelId) => {
    const panels = get().panels.filter((panel) => panel.id !== panelId);
    set({ panels, isActive: panels.length > 0 });
  },
  updatePanelLayout: (panelId, layout) => {
    const state = get();

    set({
      panels: state.panels.map((panel) => {
        if (panel.id !== panelId) {
          return panel;
        }

        const candidate = normalizePanel({
          ...panel,
          ...layout,
        });

        if (!canPlacePanel(state.panels, candidate, panelId)) {
          return {
            ...panel,
            w: candidate.w,
            h: candidate.h,
            x: clamp(candidate.x, 0, GRID_COLUMNS - candidate.w),
            y: candidate.y,
          };
        }

        return candidate;
      }),
    });
  },
  toggleDashboard: () => {
    set((state) => ({ isActive: !state.isActive }));
  },
  clearDashboard: () => {
    set({ panels: [], isActive: false });
  },
  hydrate: (panels) => {
    const normalizedPanels = panels.map(normalizePanel);
    set({
      panels: normalizedPanels,
      isActive: normalizedPanels.length > 0,
    });
  },
}));

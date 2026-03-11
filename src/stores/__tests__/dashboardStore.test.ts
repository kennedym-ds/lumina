import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardStore } from "@/stores/dashboardStore";

describe("dashboardStore", () => {
  beforeEach(() => {
    useDashboardStore.getState().clearDashboard();
  });

  it("addPanel creates a dashboard panel in the next grid slot", () => {
    useDashboardStore.getState().addPanel("chart-1");

    const state = useDashboardStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.panels).toHaveLength(1);
    expect(state.panels[0]).toMatchObject({
      chartId: "chart-1",
      x: 0,
      y: 0,
      w: 3,
      h: 2,
    });
  });

  it("removePanel removes a panel", () => {
    useDashboardStore.getState().hydrate([
      {
        id: "panel-1",
        chartId: "chart-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
    ]);

    useDashboardStore.getState().removePanel("panel-1");

    const state = useDashboardStore.getState();
    expect(state.panels).toEqual([]);
    expect(state.isActive).toBe(false);
  });

  it("updatePanelLayout changes panel position and size", () => {
    useDashboardStore.getState().hydrate([
      {
        id: "panel-1",
        chartId: "chart-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
    ]);

    useDashboardStore.getState().updatePanelLayout("panel-1", {
      x: 1,
      y: 2,
      w: 5,
      h: 3,
    });

    expect(useDashboardStore.getState().panels[0]).toMatchObject({
      id: "panel-1",
      chartId: "chart-1",
      x: 1,
      y: 2,
      w: 5,
      h: 3,
    });
  });

  it("hydrate restores panels", () => {
    const panels = [
      {
        id: "panel-1",
        chartId: "chart-1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
      {
        id: "panel-2",
        chartId: "chart-2",
        x: 3,
        y: 0,
        w: 3,
        h: 2,
      },
    ];

    useDashboardStore.getState().hydrate(panels);

    const state = useDashboardStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.panels).toEqual(panels);
  });
});

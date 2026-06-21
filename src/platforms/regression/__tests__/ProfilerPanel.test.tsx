// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfilerPanel } from "@/platforms/regression/ProfilerPanel";
import type { ProfilerResponse } from "@/types/regression";

const profilerMutateAsync = vi.fn();

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => () => <div data-testid="plotly-mock" />,
}));
vi.mock("@/api/model", () => ({
  useProfiler: () => ({ mutateAsync: profilerMutateAsync, isPending: false }),
}));

function makeResponse(x1: number): ProfilerResponse {
  return {
    dependent: "y",
    predicted_value: x1 * 2,
    response_kind: "value",
    class_labels: null,
    target_class: null,
    current_values: { x1, x2: 1 },
    profiles: [
      {
        feature: "x1",
        is_numeric: true,
        current: x1,
        grid_x: [0, 1, 2],
        grid_y: [0, 2, 4],
        min: 0,
        max: 10,
        categories: null,
      },
      {
        feature: "x2",
        is_numeric: true,
        current: 1,
        grid_x: [0, 1, 2],
        grid_y: [1, 2, 3],
        min: 0,
        max: 5,
        categories: null,
      },
    ],
  };
}

describe("ProfilerPanel", () => {
  beforeEach(() => {
    profilerMutateAsync.mockReset();
    profilerMutateAsync.mockResolvedValue(makeResponse(3));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a slider per factor after loading defaults", async () => {
    render(<ProfilerPanel datasetId="ds-1" dependent="y" />);

    await waitFor(() => expect(screen.getByLabelText("x1 slider")).toBeTruthy());
    expect(screen.getByLabelText("x2 slider")).toBeTruthy();
    // Initial defaults call posts empty values.
    expect(profilerMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ values: {}, target_class: null }),
    );
  });

  it("re-posts with updated values when a slider moves", async () => {
    render(<ProfilerPanel datasetId="ds-1" dependent="y" />);
    await waitFor(() => expect(screen.getByLabelText("x1 slider")).toBeTruthy());

    profilerMutateAsync.mockClear();
    profilerMutateAsync.mockResolvedValue(makeResponse(7));
    fireEvent.change(screen.getByLabelText("x1 slider"), { target: { value: "7" } });

    await waitFor(() =>
      expect(profilerMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ x1: 7 }) }),
      ),
    );
  });
});

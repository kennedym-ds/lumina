// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetSelectionButton } from "@/components/Toolbar/ResetSelectionButton";
import { useCrossFilterStore } from "@/stores/crossFilterStore";

describe("ResetSelectionButton", () => {
  beforeEach(() => {
    useCrossFilterStore.getState().clearSelection();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden when no selection active", () => {
    const { container } = render(<ResetSelectionButton />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows count when selection active", () => {
    useCrossFilterStore.getState().setSelection("chart-1", [0, 1, 2]);
    render(<ResetSelectionButton />);
    expect(screen.getByRole("button").textContent).toContain("Reset Selection (3)");
  });

  it("clears selection on click", async () => {
    useCrossFilterStore.getState().setSelection("chart-1", [0, 1]);
    render(<ResetSelectionButton />);

    const button = screen.getByRole("button");
    await userEvent.click(button);

    const state = useCrossFilterStore.getState();
    expect(state.selectedIndices).toEqual([]);
    expect(state.selectionSource).toBeNull();
  });
});

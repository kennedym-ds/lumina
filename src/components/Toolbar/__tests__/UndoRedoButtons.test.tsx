// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UndoRedoButtons } from "@/components/Toolbar/UndoRedoButtons";
import { useChartStore } from "@/stores/chartStore";
import { useUndoRedoStore } from "@/stores/undoRedoStore";

describe("UndoRedoButtons", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useChartStore.getState().clearCharts();
    useUndoRedoStore.getState().resetHistory();
  });

  it("undo button disabled when stack empty", () => {
    render(<UndoRedoButtons />);

    const undoButton = screen.getByRole("button", { name: /undo/i }) as HTMLButtonElement;
    expect(undoButton.disabled).toBe(true);
  });

  it("redo button disabled when stack empty", () => {
    render(<UndoRedoButtons />);

    const redoButton = screen.getByRole("button", { name: /redo/i }) as HTMLButtonElement;
    expect(redoButton.disabled).toBe(true);
  });
});
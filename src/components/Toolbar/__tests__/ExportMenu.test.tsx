// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportMenu } from "@/components/Toolbar/ExportMenu";
import { useDatasetStore } from "@/stores/datasetStore";

const downloadExport = vi.fn();

vi.mock("@/api/export", () => ({
  downloadExport: (...args: unknown[]) => downloadExport(...args),
}));

describe("ExportMenu", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    downloadExport.mockReset();
  });

  it("disables export actions when no dataset is selected", () => {
    render(<ExportMenu />);

    const button = screen.getByRole("button", { name: /export data/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows CSV, Excel, and report options", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "dataset-123",
      fileName: "sample.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 100,
      columnCount: 5,
    });

    render(<ExportMenu />);

    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /export excel/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /export report/i })).toBeTruthy();
  });

  it("downloads the requested format for the active dataset", () => {
    useDatasetStore.getState().hydrate({
      datasetId: "dataset-123",
      fileName: "sample.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 100,
      columnCount: 5,
    });

    render(<ExportMenu />);

    fireEvent.click(screen.getByRole("button", { name: /export data/i }));
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(downloadExport).toHaveBeenCalledWith("dataset-123", "csv");
  });
});
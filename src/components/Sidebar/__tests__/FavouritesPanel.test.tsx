// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavouritesPanel } from "@/components/Sidebar/FavouritesPanel";
import { useDatasetStore } from "@/stores/datasetStore";

const useViewsListMock = vi.fn();
const useSaveViewMock = vi.fn();
const useRenameViewMock = vi.fn();
const useDeleteViewMock = vi.fn();

vi.mock("@/api/views", () => ({
  useViewsList: (datasetId: string | null) => useViewsListMock(datasetId),
  useSaveView: (datasetId: string | null) => useSaveViewMock(datasetId),
  useRenameView: (datasetId: string | null) => useRenameViewMock(datasetId),
  useDeleteView: (datasetId: string | null) => useDeleteViewMock(datasetId),
}));

describe("FavouritesPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useDatasetStore.getState().hydrate({
      datasetId: "dataset-1",
      fileName: "demo.csv",
      fileFormat: "csv",
      columns: [],
      rowCount: 10,
      columnCount: 2,
    });

    useViewsListMock.mockReset();
    useSaveViewMock.mockReset();
    useRenameViewMock.mockReset();
    useDeleteViewMock.mockReset();

    useViewsListMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    useSaveViewMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useRenameViewMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useDeleteViewMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it("renders save view button", () => {
    render(<FavouritesPanel />);

    expect(screen.getByRole("button", { name: /save current view/i })).toBeTruthy();
  });

  it("shows empty state when no views", () => {
    render(<FavouritesPanel />);

    expect(screen.getByText(/no saved views yet/i)).toBeTruthy();
  });
});
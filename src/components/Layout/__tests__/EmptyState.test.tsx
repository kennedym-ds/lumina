// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/Layout/EmptyState";
import { useDatasetStore } from "@/stores/datasetStore";
import type { UploadResponse } from "@/types/data";

const useSamplesListMock = vi.fn();
const useLoadSampleMock = vi.fn();

vi.mock("@/api/samples", () => ({
  useSamplesList: () => useSamplesListMock(),
  useLoadSample: () => useLoadSampleMock(),
}));

vi.mock("@/components/Import/ImportDialog", () => ({
  ImportDialog: ({ isUploading }: { isUploading: boolean }) => (
    <button type="button" disabled={isUploading}>
      Browse Files
    </button>
  ),
}));

const mockSamples = [
  {
    name: "palmer_penguins",
    display_name: "Palmer Penguins",
    description: "Penguin measurements from Palmer Station, Antarctica",
  },
  {
    name: "iris",
    display_name: "Iris",
    description: "Classic Fisher iris flower measurements",
  },
  {
    name: "titanic",
    display_name: "Titanic",
    description: "Passenger survival data from RMS Titanic",
  },
];

const sampleUploadResponse: UploadResponse = {
  dataset_id: "sample_ds_1",
  file_name: "palmer_penguins.csv",
  file_format: "csv",
  row_count: 50,
  column_count: 5,
  columns: [],
};

describe("EmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDatasetStore.getState().clearDataset();
    useSamplesListMock.mockReset();
    useLoadSampleMock.mockReset();

    useSamplesListMock.mockReturnValue({
      data: mockSamples,
      isLoading: false,
    });

    useLoadSampleMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });
  });

  it("renders drop zone and sample cards", () => {
    render(<EmptyState onUpload={vi.fn()} isUploading={false} />);

    expect(screen.getByText(/import a dataset to get started/i)).toBeTruthy();
    expect(screen.getByText(/or try a sample dataset/i)).toBeTruthy();
    expect(screen.getByText("Palmer Penguins")).toBeTruthy();
    expect(screen.getByText("Iris")).toBeTruthy();
    expect(screen.getByText("Titanic")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse Files" })).toBeTruthy();
  });

  it("loads sample dataset on card click", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(sampleUploadResponse);
    useLoadSampleMock.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });

    render(<EmptyState onUpload={vi.fn()} isUploading={false} />);

    const penguinsCard = screen.getByText("Palmer Penguins").closest("article");
    if (!penguinsCard) {
      throw new Error("Palmer Penguins card not found");
    }

    fireEvent.click(within(penguinsCard).getByRole("button", { name: /load/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("palmer_penguins");
      expect(useDatasetStore.getState().datasetId).toBe("sample_ds_1");
    });
  });

  it("shows loading state during sample load", () => {
    useLoadSampleMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
      variables: "iris",
    });

    render(<EmptyState onUpload={vi.fn()} isUploading={false} />);

    const irisCard = screen.getByText("Iris").closest("article");
    if (!irisCard) {
      throw new Error("Iris card not found");
    }

    const loadingButton = within(irisCard).getByRole("button", { name: /loading/i }) as HTMLButtonElement;
    expect(loadingButton.disabled).toBe(true);
  });
});
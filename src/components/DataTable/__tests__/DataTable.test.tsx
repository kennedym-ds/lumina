// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../DataTable";

vi.mock("@/api/data", () => {
  return {
    useRows: () => ({
      data: {
        columns: ["id", "name"],
        data: [
          [1, "Alice"],
          [2, "Bob"],
        ],
        offset: 0,
        limit: 1000,
        total: 2,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
  };
});

describe("DataTable", () => {
  it("renders empty state when no dataset is loaded", () => {
    render(<DataTable datasetId={null} />);

    expect(screen.getByText(/import a dataset to begin exploring your data/i)).toBeTruthy();
  });

  it("renders virtualization container and table headers", () => {
    render(<DataTable datasetId="ds_123" />);

    expect(screen.getByTestId("data-table-virtual-container")).toBeTruthy();
    expect(screen.getByText("id")).toBeTruthy();
    expect(screen.getByText("name")).toBeTruthy();
  });
});

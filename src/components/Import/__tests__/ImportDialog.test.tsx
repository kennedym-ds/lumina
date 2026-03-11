// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportDialog } from "@/components/Import/ImportDialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("ImportDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the expanded set of supported file types", () => {
    const onUpload = vi.fn();
    const { container } = render(<ImportDialog onUpload={onUpload} isUploading={false} />);

    const fileInput = container.querySelector('input[type="file"]');

    expect(fileInput?.getAttribute("accept")).toBe(
      ".csv,.tsv,.tab,.json,.xlsx,.xls,.parquet,.db,.sqlite,.sqlite3,.feather,.arrow",
    );
    expect(screen.getByText(/supports .csv, .tsv, .tab, .json/i)).toBeTruthy();
    expect(screen.getByText(/\.sqlite3/i)).toBeTruthy();
    expect(screen.getByText(/\.feather, and \.arrow/i)).toBeTruthy();
  });
});
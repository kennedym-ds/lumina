// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChartClipboard } from "@/hooks/useChartClipboard";

const toImageMock = vi.fn();

vi.mock("plotly.js-dist-min", () => ({
  default: {
    toImage: (...args: unknown[]) => toImageMock(...args),
  },
}));

describe("useChartClipboard", () => {
  beforeEach(() => {
    toImageMock.mockReset();
    toImageMock.mockResolvedValue("data:image/png;base64,aGVsbG8=");

    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });

    const clipboardItemMock = vi.fn((payload: Record<string, Blob>) => payload);
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: clipboardItemMock,
      configurable: true,
    });
  });

  it("copyChart resolves without error", async () => {
    const { result } = renderHook(() => useChartClipboard());
    const plotlyElement = document.createElement("div");

    await expect(result.current.copyChart(plotlyElement)).resolves.toBe(true);
    expect(toImageMock).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
  });
});
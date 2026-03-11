import { describe, expect, it } from "vitest";
import { platforms } from "@/platforms/registry";

describe("platform registry", () => {
  it("registry exposes tabs in the expected order", () => {
    expect(platforms.map((entry) => entry.id)).toEqual([
      "eda",
      "profiling",
      "distribution",
      "inference",
      "regression",
      "dashboard",
    ]);
  });

  it("all entries have required fields", () => {
    for (const entry of platforms) {
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(entry.component).toBeTruthy();
    }
  });
});
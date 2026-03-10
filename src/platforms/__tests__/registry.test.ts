import { describe, expect, it } from "vitest";
import { platforms } from "@/platforms/registry";

describe("platform registry", () => {
  it("registry has eda and regression entries", () => {
    expect(platforms.map((entry) => entry.id)).toEqual(expect.arrayContaining(["eda", "regression"]));
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
import { beforeEach, describe, expect, it } from "vitest";
import { useFilterStore } from "@/stores/filterStore";

describe("filterStore", () => {
  beforeEach(() => {
    useFilterStore.getState().clearFilters();
  });

  it("adds, updates, and removes filters", () => {
    useFilterStore.getState().addFilter("age", ">", 30);

    const created = useFilterStore.getState().filters[0];
    expect(created).toBeDefined();
    expect(created?.column).toBe("age");
    expect(created?.operator).toBe(">");
    expect(created?.value).toBe(30);

    useFilterStore.getState().updateFilter(created!.id, { operator: ">=", value: 35 });

    const updated = useFilterStore.getState().filters[0];
    expect(updated?.operator).toBe(">=");
    expect(updated?.value).toBe(35);

    useFilterStore.getState().removeFilter(created!.id);
    expect(useFilterStore.getState().filters).toEqual([]);
  });

  it("hydrates and clears filters", () => {
    useFilterStore.getState().hydrateFilters([
      {
        id: "filter-1",
        column: "species",
        operator: "==",
        value: "Adelie",
      },
    ]);

    expect(useFilterStore.getState().filters).toHaveLength(1);
    expect(useFilterStore.getState().filters[0]?.column).toBe("species");

    useFilterStore.getState().clearFilters();
    expect(useFilterStore.getState().filters).toEqual([]);
  });
});

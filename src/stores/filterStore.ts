import { create } from "zustand";
import type { FilterOperator, FilterRule } from "@/types/filters";

interface FilterStoreState {
  filters: FilterRule[];
  addFilter: (column: string, operator: FilterOperator, value: unknown) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<Omit<FilterRule, "id">>) => void;
  clearFilters: () => void;
  hydrateFilters: (filters: FilterRule[]) => void;
}

function generateId(): string {
  return `filter-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const useFilterStore = create<FilterStoreState>((set) => ({
  filters: [],
  addFilter: (column, operator, value) => {
    const newFilter: FilterRule = { id: generateId(), column, operator, value };
    set((state) => ({ filters: [...state.filters, newFilter] }));
  },
  removeFilter: (id) => {
    set((state) => ({ filters: state.filters.filter((filter) => filter.id !== id) }));
  },
  updateFilter: (id, updates) => {
    set((state) => ({
      filters: state.filters.map((filter) => (filter.id === id ? { ...filter, ...updates } : filter)),
    }));
  },
  clearFilters: () => set({ filters: [] }),
  hydrateFilters: (filters) => set({ filters }),
}));

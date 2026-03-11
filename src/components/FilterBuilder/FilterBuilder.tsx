import { useEffect, useRef, useState } from "react";
import { useApplyFilters } from "@/api/filters";
import { useDatasetStore } from "@/stores/datasetStore";
import { useFilterStore } from "@/stores/filterStore";
import type { FilterOperator, FilterRequest } from "@/types/filters";

const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "==", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: ">=", label: "greater or equal" },
  { value: "<", label: "less than" },
  { value: "<=", label: "less or equal" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "is_null", label: "is null" },
  { value: "not_null", label: "is not null" },
];

const NO_VALUE_OPERATORS = new Set<FilterOperator>(["is_null", "not_null"]);
const MULTI_VALUE_OPERATORS = new Set<FilterOperator>(["in", "not_in"]);

function serializeValue(operator: FilterOperator, value: unknown): unknown {
  if (NO_VALUE_OPERATORS.has(operator)) {
    return null;
  }

  if (MULTI_VALUE_OPERATORS.has(operator)) {
    return String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}

export function FilterBuilder() {
  const columns = useDatasetStore((state) => state.columns);
  const datasetId = useDatasetStore((state) => state.datasetId);
  const filters = useFilterStore((state) => state.filters);
  const addFilter = useFilterStore((state) => state.addFilter);
  const removeFilter = useFilterStore((state) => state.removeFilter);
  const updateFilter = useFilterStore((state) => state.updateFilter);
  const clearFilters = useFilterStore((state) => state.clearFilters);

  const [isOpen, setIsOpen] = useState(false);
  const previousDatasetId = useRef<string | null | undefined>(undefined);
  const applyMutation = useApplyFilters(datasetId);

  useEffect(() => {
    if (previousDatasetId.current !== undefined && previousDatasetId.current !== datasetId) {
      clearFilters();
    }

    previousDatasetId.current = datasetId;
  }, [clearFilters, datasetId]);

  const handleAddFilter = () => {
    const firstColumn = columns[0]?.name;
    if (!firstColumn) {
      return;
    }

    addFilter(firstColumn, "==", "");
  };

  const handleApply = () => {
    const request: FilterRequest = {
      filters: filters.map(({ column, operator, value }) => ({
        column,
        operator,
        value: serializeValue(operator, value),
      })),
      logic: "and",
    };

    applyMutation.mutate(request);
  };

  const handleClear = () => {
    clearFilters();
    applyMutation.mutate({ filters: [], logic: "and" });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
        <span>Filters</span>
        {filters.length > 0 ? (
          <span className="rounded-full bg-lumina-100 px-1.5 py-0.5 text-xs text-lumina-700">
            {filters.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-3">
          {filters.length === 0 ? <p className="text-xs text-slate-500">No active row filters.</p> : null}

          {filters.map((filter, index) => (
            <div key={filter.id} className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={filter.column}
                onChange={(event) => updateFilter(filter.id, { column: event.target.value })}
                className="min-w-28 rounded border border-slate-300 px-2 py-1"
                aria-label={`Filter column ${index + 1}`}
              >
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>

              <select
                value={filter.operator}
                onChange={(event) =>
                  updateFilter(filter.id, { operator: event.target.value as FilterOperator })
                }
                className="min-w-28 rounded border border-slate-300 px-2 py-1"
                aria-label={`Filter operator ${index + 1}`}
              >
                {OPERATORS.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>

              {!NO_VALUE_OPERATORS.has(filter.operator) ? (
                <input
                  type="text"
                  value={String(filter.value ?? "")}
                  onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                  placeholder={MULTI_VALUE_OPERATORS.has(filter.operator) ? "value1, value2" : "value"}
                  className="min-w-24 rounded border border-slate-300 px-2 py-1"
                  aria-label={`Filter value ${index + 1}`}
                />
              ) : null}

              <button
                type="button"
                onClick={() => removeFilter(filter.id)}
                className="text-slate-400 hover:text-red-500"
                aria-label="Remove filter"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddFilter}
              disabled={columns.length === 0}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add filter
            </button>

            {filters.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applyMutation.isPending}
                  className="rounded bg-lumina-600 px-2 py-1 text-xs text-white hover:bg-lumina-700 disabled:opacity-50"
                >
                  {applyMutation.isPending ? "Applying…" : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-slate-500 hover:text-red-500"
                >
                  Clear all
                </button>
              </>
            ) : null}
          </div>

          {applyMutation.data ? (
            <div className="text-xs text-slate-500">
              {applyMutation.data.matched_rows.toLocaleString()} of {" "}
              {applyMutation.data.total_rows.toLocaleString()} rows match
            </div>
          ) : null}

          {applyMutation.error ? (
            <p className="text-xs text-red-600">{applyMutation.error.message}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

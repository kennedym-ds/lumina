import { useMemo } from "react";
import { useDatasetStore } from "@/stores/datasetStore";

const iconByDtype: Record<string, string> = {
  numeric: "📏",
  categorical: "🏷️",
  datetime: "📅",
  text: "📝",
  boolean: "✓",
};

interface VariableListProps {
  onSelectColumn?: (columnName: string) => void;
}

export function VariableList({ onSelectColumn }: VariableListProps) {
  const columns = useDatasetStore((state) => state.columns);

  const sortedColumns = useMemo(
    () => [...columns].sort((left, right) => left.name.localeCompare(right.name)),
    [columns],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Variables</h2>

      {sortedColumns.length === 0 ? (
        <p className="text-xs text-slate-500">No variables yet.</p>
      ) : (
        <ul className="space-y-1">
          {sortedColumns.map((column) => (
            <li key={column.name}>
              <button
                type="button"
                onClick={() => onSelectColumn?.(column.name)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-lumina-50"
                title={column.name}
              >
                <span className="w-5 text-center">{iconByDtype[column.dtype] ?? "•"}</span>
                <span className="truncate">{column.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

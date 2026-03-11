import { useMemo, useState } from "react";
import { useCastColumn, useUpdateColumnConfig } from "@/api/data";
import { useDatasetStore } from "@/stores/datasetStore";
import type { CastTargetDtype, ColumnInfo } from "@/types/data";

const iconByDtype: Record<string, string> = {
  numeric: "📏",
  categorical: "🏷️",
  datetime: "📅",
  text: "📝",
  boolean: "✓",
};

const castTargetOptions: CastTargetDtype[] = ["numeric", "categorical", "datetime", "text"];

interface VariableListProps {
  onSelectColumn?: (columnName: string) => void;
}

export function VariableList({ onSelectColumn }: VariableListProps) {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const columns = useDatasetStore((state) => state.columns);
  const excludedColumns = useDatasetStore((state) => state.excludedColumns);
  const updateColumns = useDatasetStore((state) => state.updateColumns);
  const toggleColumnExclusion = useDatasetStore((state) => state.toggleColumnExclusion);
  const setError = useDatasetStore((state) => state.setError);
  const [pendingColumn, setPendingColumn] = useState<string | null>(null);
  const [castingColumn, setCastingColumn] = useState<string | null>(null);
  const [castSelections, setCastSelections] = useState<Record<string, CastTargetDtype>>({});
  const updateColumnConfig = useUpdateColumnConfig(datasetId);
  const castColumnMutation = useCastColumn(datasetId);

  const sortedColumns = useMemo(
    () => [...columns].sort((left, right) => left.name.localeCompare(right.name)),
    [columns],
  );

  const sortedExcludedColumns = useMemo(
    () => Array.from(excludedColumns).sort((left, right) => left.localeCompare(right)),
    [excludedColumns],
  );

  const resolveCastTarget = (column: ColumnInfo): CastTargetDtype => {
    if (castTargetOptions.includes(column.dtype as CastTargetDtype)) {
      return column.dtype as CastTargetDtype;
    }

    return "text";
  };

  const openCastControls = (column: ColumnInfo) => {
    setCastingColumn((current) => (current === column.name ? null : column.name));
    setCastSelections((current) => ({
      ...current,
      [column.name]: current[column.name] ?? resolveCastTarget(column),
    }));
  };

  const handleCastSelectionChange = (columnName: string, nextValue: string) => {
    if (!castTargetOptions.includes(nextValue as CastTargetDtype)) {
      return;
    }

    setCastSelections((current) => ({
      ...current,
      [columnName]: nextValue as CastTargetDtype,
    }));
  };

  const handleCastColumn = async (column: ColumnInfo) => {
    const target_dtype = castSelections[column.name] ?? resolveCastTarget(column);
    setPendingColumn(column.name);
    setError(null);

    try {
      const response = await castColumnMutation.mutateAsync({
        column: column.name,
        target_dtype,
      });
      updateColumns(response.columns);
      setCastingColumn(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cast column.";
      setError(message);
    } finally {
      setPendingColumn(null);
    }
  };

  const handleToggleExclusion = async (columnName: string) => {
    const isCurrentlyExcluded = excludedColumns.has(columnName);
    const nextExcluded = new Set(excludedColumns);

    if (isCurrentlyExcluded) {
      nextExcluded.delete(columnName);
    } else {
      nextExcluded.add(columnName);
    }

    const payload = Array.from(nextExcluded, (name) => ({ name, excluded: true }));
    if (isCurrentlyExcluded) {
      payload.push({ name: columnName, excluded: false });
    }

    setPendingColumn(columnName);
    setError(null);

    try {
      const response = await updateColumnConfig.mutateAsync(payload);
      updateColumns(response.columns);
      toggleColumnExclusion(columnName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update column visibility.";
      setError(message);
    } finally {
      setPendingColumn(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Variables</h2>

      {sortedColumns.length === 0 ? (
        <p className="text-xs text-slate-500">No variables yet.</p>
      ) : (
        <ul className="space-y-1">
          {sortedColumns.map((column) => (
            <li key={column.name} className="space-y-2 rounded-md border border-transparent px-1 py-1 hover:border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectColumn?.(column.name)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-lumina-50"
                  title={column.name}
                >
                  <span className="w-5 text-center">{iconByDtype[column.dtype] ?? "•"}</span>
                  <span className="truncate">{column.name}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openCastControls(column)}
                  disabled={pendingColumn === column.name || castColumnMutation.isPending}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Cast column ${column.name}`}
                >
                  Cast
                </button>

                <button
                  type="button"
                  onClick={() => void handleToggleExclusion(column.name)}
                  disabled={pendingColumn === column.name || updateColumnConfig.isPending}
                  className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Hide column ${column.name}`}
                  title={`Hide ${column.name}`}
                >
                  👁
                </button>
              </div>

              {castingColumn === column.name ? (
                <div className="ml-7 flex items-center gap-2">
                  <label htmlFor={`cast-${column.name}`} className="sr-only">
                    {`Cast ${column.name} to`}
                  </label>
                  <select
                    id={`cast-${column.name}`}
                    aria-label={`Cast ${column.name} to`}
                    value={castSelections[column.name] ?? resolveCastTarget(column)}
                    onChange={(event) => handleCastSelectionChange(column.name, event.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-lumina-500 focus:outline-none"
                  >
                    {castTargetOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCastColumn(column)}
                    disabled={pendingColumn === column.name || castColumnMutation.isPending}
                    className="rounded-md bg-lumina-700 px-2 py-1 text-xs font-medium text-white transition hover:bg-lumina-800 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Apply cast for ${column.name}`}
                  >
                    Apply
                  </button>
                </div>
              ) : null}
            </li>
          ))}

          {sortedExcludedColumns.map((columnName) => (
            <li key={columnName} className="flex items-center gap-2 opacity-60">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500">
                <span className="w-5 text-center">👁‍🗨</span>
                <span className="truncate line-through">{columnName}</span>
              </div>

              <button
                type="button"
                onClick={() => void handleToggleExclusion(columnName)}
                disabled={pendingColumn === columnName || updateColumnConfig.isPending}
                className="rounded-md px-2 py-1 text-sm text-lumina-700 transition hover:bg-lumina-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Re-include column ${columnName}`}
                title={`Re-include ${columnName}`}
              >
                👁
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

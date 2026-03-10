import { useState } from "react";
import { useSummary } from "@/api/data";
import { useDatasetStore } from "@/stores/datasetStore";

const typeBadgeMap: Record<string, string> = {
  numeric: "bg-blue-100 text-blue-700",
  categorical: "bg-violet-100 text-violet-700",
  datetime: "bg-amber-100 text-amber-700",
  text: "bg-slate-100 text-slate-700",
  boolean: "bg-emerald-100 text-emerald-700",
};

function formatNumber(value?: number): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function SummaryPanel() {
  const datasetId = useDatasetStore((state) => state.datasetId);
  const fileName = useDatasetStore((state) => state.fileName);
  const rowCount = useDatasetStore((state) => state.rowCount);
  const columnCount = useDatasetStore((state) => state.columnCount);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});

  const summaryQuery = useSummary(datasetId);

  const toggleExpanded = (name: string) => {
    setExpandedColumns((previous) => ({
      ...previous,
      [name]: !previous[name],
    }));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">Dataset Summary</h2>
      <p className="truncate text-xs text-slate-500" title={fileName ?? "No file selected"}>
        {fileName ?? "No file selected"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
        <div className="rounded bg-slate-50 px-2 py-1">Rows: {rowCount.toLocaleString()}</div>
        <div className="rounded bg-slate-50 px-2 py-1">Columns: {columnCount.toLocaleString()}</div>
      </div>

      {!datasetId ? (
        <p className="mt-3 text-xs text-slate-500">Import a file to view summary stats.</p>
      ) : null}

      {summaryQuery.isLoading ? <p className="mt-3 text-xs text-slate-500">Loading summary...</p> : null}
      {summaryQuery.isError ? (
        <p className="mt-3 text-xs text-red-600">Failed to load summary.</p>
      ) : null}

      <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto pr-1">
        {summaryQuery.data?.columns.map((column) => {
          const isExpanded = expandedColumns[column.name] ?? false;

          return (
            <article key={column.name} className="rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => toggleExpanded(column.name)}
                className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-slate-50"
              >
                <span className="truncate text-xs font-medium text-slate-800" title={column.name}>
                  {column.name}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${typeBadgeMap[column.dtype] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {column.dtype}
                </span>
              </button>

              {isExpanded ? (
                <div className="space-y-1 border-t border-slate-200 px-2 py-2 text-[11px] text-slate-700">
                  <p>Missing: {column.missing_count.toLocaleString()} ({column.missing_pct.toFixed(2)}%)</p>
                  <p>Unique: {column.unique_count.toLocaleString()}</p>

                  {column.dtype === "numeric" ? (
                    <>
                      <p>Mean: {formatNumber(column.mean)}</p>
                      <p>Std: {formatNumber(column.std)}</p>
                      <p>Min: {formatNumber(column.min)}</p>
                      <p>Max: {formatNumber(column.max)}</p>
                      <p>Median: {formatNumber(column.median)}</p>
                    </>
                  ) : null}

                  {column.dtype === "categorical" ? (
                    <>
                      <p>Top: {column.top_value ?? "—"}</p>
                      <p>Top Freq: {formatNumber(column.top_freq)}</p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

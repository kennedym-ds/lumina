import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRows } from "@/api/data";
import { useDatasetStore } from "@/stores/datasetStore";
import { useCrossFilterStore } from "@/stores/crossFilterStore";
import { EmptyTableState } from "./EmptyTableState";
import { SortableHeader } from "./SortableHeader";

interface DataTableProps {
  datasetId: string | null;
}

const PAGE_SIZE = 1000;
const ROW_HEIGHT = 36;

export function DataTable({ datasetId }: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const totalRowsFromStore = useDatasetStore((state) => state.rowCount);
  const columnsFromStore = useDatasetStore((state) => state.columns);

  const crossFilterIndices = useCrossFilterStore((state) => state.selectedIndices);
  const crossFilterSet = useMemo(() => new Set(crossFilterIndices), [crossFilterIndices]);
  const hasCrossFilter = crossFilterIndices.length > 0;

  const estimatedFirstVisibleRow =
    scrollRef.current !== null
      ? Math.max(0, Math.floor(scrollRef.current.scrollTop / ROW_HEIGHT) - 20)
      : 0;
  const pageOffset = Math.floor(estimatedFirstVisibleRow / PAGE_SIZE) * PAGE_SIZE;

  const rowsQuery = useRows(
    datasetId,
    pageOffset,
    PAGE_SIZE,
    sortColumn,
    sortDirection === "desc",
  );

  const tableColumns = rowsQuery.data?.columns ?? columnsFromStore.map((column) => column.name);
  const totalRows = rowsQuery.data?.total ?? totalRowsFromStore;

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const handleSort = (column: string) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    if (sortDirection === "desc") {
      setSortColumn(null);
      setSortDirection(null);
      return;
    }

    setSortDirection("asc");
  };

  const shouldShowEmptyState = !datasetId;

  const virtualItems = rowVirtualizer.getVirtualItems();

  const topSpacerHeight = useMemo(() => {
    if (virtualItems.length === 0) {
      return 0;
    }
    return virtualItems[0]?.start ?? 0;
  }, [virtualItems]);

  const bottomSpacerHeight = useMemo(() => {
    if (virtualItems.length === 0) {
      return 0;
    }

    const lastItem = virtualItems[virtualItems.length - 1];
    return Math.max(0, rowVirtualizer.getTotalSize() - (lastItem?.end ?? 0));
  }, [rowVirtualizer, virtualItems]);

  if (shouldShowEmptyState) {
    return <EmptyTableState />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tableColumns.length || 1}, minmax(180px, 1fr))` }}>
          {tableColumns.map((column) => (
            <SortableHeader
              key={column}
              column={column}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        data-testid="data-table-virtual-container"
        className="min-h-0 flex-1 overflow-auto"
      >
        <div style={{ height: topSpacerHeight }} />

        {virtualItems.map((virtualRow) => {
          const absoluteIndex = virtualRow.index;
          const pageIndex = absoluteIndex - pageOffset;
          const row = rowsQuery.data?.data[pageIndex];

          return (
            <div
              key={virtualRow.key}
              className={
                hasCrossFilter && crossFilterSet.has(absoluteIndex)
                  ? "grid border-b border-lumina-200 bg-lumina-100"
                  : hasCrossFilter
                    ? "grid border-b border-slate-100 bg-white opacity-40"
                    : absoluteIndex % 2 === 0
                      ? "grid border-b border-slate-100 bg-white"
                      : "grid border-b border-slate-100 bg-slate-50/50"
              }
              style={{
                height: ROW_HEIGHT,
                gridTemplateColumns: `repeat(${tableColumns.length || 1}, minmax(180px, 1fr))`,
              }}
            >
              {tableColumns.map((column, columnIndex) => {
                const value = row ? row[columnIndex] : "";
                return (
                  <div
                    key={`${column}-${absoluteIndex}`}
                    className="truncate border-r border-slate-100 px-3 py-2 text-xs text-slate-700 last:border-r-0"
                    title={value == null ? "" : String(value)}
                  >
                    {value == null ? "" : String(value)}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ height: bottomSpacerHeight }} />
      </div>

      {rowsQuery.isFetching ? (
        <div className="border-t border-slate-200 px-3 py-1 text-right text-xs text-slate-500">Loading...</div>
      ) : null}
    </div>
  );
}

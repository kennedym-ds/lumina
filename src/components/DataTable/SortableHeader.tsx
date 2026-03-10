interface SortableHeaderProps {
  column: string;
  sortColumn: string | null;
  sortDirection: "asc" | "desc" | null;
  onSort: (column: string) => void;
}

export function SortableHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  const isActive = sortColumn === column;
  const directionIcon = !isActive
    ? ""
    : sortDirection === "asc"
      ? "▲"
      : sortDirection === "desc"
        ? "▼"
        : "";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="group flex w-full items-center justify-between gap-2 truncate px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-lumina-50"
      title={column}
    >
      <span className="truncate">{column}</span>
      <span
        className={
          isActive
            ? "text-lumina-700"
            : "text-slate-300 group-hover:text-slate-500"
        }
        aria-hidden="true"
      >
        {directionIcon || "↕"}
      </span>
    </button>
  );
}

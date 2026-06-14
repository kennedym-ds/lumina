import { useDndMonitor, useDroppable } from "@dnd-kit/core";

export type ShelfType = "x" | "y" | "color" | "facet" | "size";

interface VariableShelfProps {
  shelfType: ShelfType;
  value: string | null;
  onDrop: (columnName: string) => void;
  onRemove: () => void;
  chartId?: string;
}

const shelfLabelByType: Record<ShelfType, string> = {
  x: "X Axis",
  y: "Y Axis",
  color: "Color",
  facet: "Facet",
  size: "Size",
};

export function getShelfDropId(shelfType: ShelfType, chartId?: string): string {
  return chartId ? `shelf:${chartId}:${shelfType}` : `shelf:${shelfType}`;
}

export function VariableShelf({ shelfType, value, onDrop, onRemove, chartId }: VariableShelfProps) {
  const dropId = getShelfDropId(shelfType, chartId);
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: {
      shelfType,
      chartId,
    },
  });

  useDndMonitor({
    onDragEnd: (event) => {
      if (event.over?.id !== dropId) {
        return;
      }

      const draggedName = event.active.data.current?.columnName;
      const columnName = typeof draggedName === "string" ? draggedName : String(event.active.id);
      onDrop(columnName);
    },
  });

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{shelfLabelByType[shelfType]}</p>

      <div
        ref={setNodeRef}
        className={`flex min-h-[46px] items-center rounded-lg border p-2 transition ${
          isOver
            ? "border-lumina-400 bg-lumina-50 ring-2 ring-lumina-200"
            : value
              ? "border-slate-200 bg-white"
              : "border-dashed border-slate-300 bg-slate-50/60"
        }`}
      >
        {value ? (
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-lumina-200 bg-lumina-50 px-2.5 py-1.5 text-sm font-medium text-lumina-800">
            <span className="truncate">{value}</span>
            <button
              type="button"
              aria-label={`Remove ${value} from ${shelfLabelByType[shelfType]}`}
              onClick={onRemove}
              className="rounded p-0.5 text-lumina-500 transition hover:bg-lumina-100 hover:text-lumina-700"
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="w-full text-center text-xs text-slate-400">{isOver ? "Release to add" : "Drop a variable here"}</p>
        )}
      </div>
    </div>
  );
}

import { useDndMonitor, useDroppable } from "@dnd-kit/core";

type ShelfType = "x" | "y" | "color" | "facet";

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
        className={`min-h-[44px] rounded-md border p-2 transition ${
          isOver
            ? "border-lumina-400 bg-lumina-50"
            : value
              ? "border-slate-300 bg-white"
              : "border-dashed border-slate-300 bg-slate-50"
        }`}
      >
        {value ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">
            <span className="truncate">{value}</span>
            <button
              type="button"
              aria-label={`Remove ${value} from ${shelfLabelByType[shelfType]}`}
              onClick={onRemove}
              className="rounded px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Drop variable here</p>
        )}
      </div>
    </div>
  );
}

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { LuminaDtype } from "@/types/eda";

interface DraggableVariableProps {
  columnName: string;
  dtype: LuminaDtype;
}

const iconByDtype: Record<LuminaDtype, string> = {
  numeric: "📏",
  categorical: "🏷️",
  datetime: "📅",
  text: "📝",
  boolean: "✅",
};

export function DraggableVariable({ columnName, dtype }: DraggableVariableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `column:${columnName}`,
    data: {
      columnName,
      dtype,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className="group flex w-full cursor-grab items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-lumina-300 hover:bg-lumina-50 hover:shadow active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span className="w-5 text-center">{iconByDtype[dtype]}</span>
      <span className="truncate flex-1">{columnName}</span>
      <span aria-hidden="true" className="text-slate-300 opacity-0 transition group-hover:opacity-100">⠿</span>
    </button>
  );
}

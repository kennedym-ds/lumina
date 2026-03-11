import { useCrossFilterStore } from "@/stores/crossFilterStore";

export function ResetSelectionButton() {
  const count = useCrossFilterStore((state) => state.selectedRowIds.size);
  const clearSelection = useCrossFilterStore((state) => state.clearSelection);

  if (count === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={clearSelection}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <span aria-hidden="true">✕</span>
      Reset Selection ({count})
    </button>
  );
}

interface EmptyChartStateProps {
  onAddChart: () => void;
}

export function EmptyChartState({ onAddChart }: EmptyChartStateProps) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <div className="text-2xl" aria-hidden="true">
        📊
      </div>
      <p className="text-sm text-slate-600">Drag variables to the shelves to create a chart</p>
      <button
        type="button"
        onClick={onAddChart}
        className="inline-flex items-center gap-2 rounded-md border border-lumina-300 bg-white px-3 py-2 text-sm font-medium text-lumina-700 hover:bg-lumina-50"
      >
        <span aria-hidden="true">＋</span>
        <span>Add Chart</span>
      </button>
    </div>
  );
}

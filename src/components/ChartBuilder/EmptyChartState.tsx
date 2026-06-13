import type { ChartType } from "@/types/eda";

interface GalleryPreset {
  type: ChartType;
  icon: string;
  label: string;
  hint: string;
}

const GALLERY_PRESETS: GalleryPreset[] = [
  { type: "scatter", icon: "⚬", label: "Scatter", hint: "X vs Y relationship" },
  { type: "histogram", icon: "📊", label: "Histogram", hint: "Single variable distribution" },
  { type: "box", icon: "📦", label: "Box plot", hint: "Group comparisons" },
  { type: "bar", icon: "📶", label: "Bar chart", hint: "Category aggregates" },
  { type: "line", icon: "📈", label: "Line chart", hint: "Trends over time" },
  { type: "heatmap", icon: "🔥", label: "Heatmap", hint: "Two-variable density" },
  { type: "violin", icon: "🎻", label: "Violin", hint: "Distribution shape" },
  { type: "bubble", icon: "🫧", label: "Bubble", hint: "3-variable scatter" },
  { type: "parallel_coords", icon: "⫘", label: "Parallel coords", hint: "Multivariate overview" },
];

interface EmptyChartStateProps {
  onAddChart: () => void;
  onAddPreset?: (chartType: ChartType) => void;
}

export function EmptyChartState({ onAddChart, onAddPreset }: EmptyChartStateProps) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 bg-white p-6">
      <div className="text-center">
        <div className="mb-1 text-2xl" aria-hidden="true">📊</div>
        <p className="text-sm text-slate-600">Drag variables to shelves, or start from a template</p>
      </div>

      {onAddPreset ? (
        <div className="grid grid-cols-3 gap-2">
          {GALLERY_PRESETS.map((preset) => (
            <button
              key={preset.type}
              type="button"
              onClick={() => onAddPreset(preset.type)}
              title={preset.hint}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-700 hover:border-lumina-300 hover:bg-lumina-50 hover:text-lumina-700"
            >
              <span className="text-lg" aria-hidden="true">{preset.icon}</span>
              <span className="font-medium">{preset.label}</span>
              <span className="text-slate-400">{preset.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAddChart}
        className="inline-flex items-center gap-2 rounded-md border border-lumina-300 bg-white px-3 py-2 text-sm font-medium text-lumina-700 hover:bg-lumina-50"
      >
        <span aria-hidden="true">＋</span>
        <span>Blank Chart</span>
      </button>
    </div>
  );
}

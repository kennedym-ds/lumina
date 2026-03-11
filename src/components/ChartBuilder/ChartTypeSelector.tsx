import type { ChartType } from "@/types/eda";

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

const chartTypeOptions: Array<{ type: ChartType; label: string; icon: string }> = [
  { type: "histogram", label: "Histogram", icon: "📊" },
  { type: "scatter", label: "Scatter", icon: "⚬" },
  { type: "box", label: "Box", icon: "📦" },
  { type: "bar", label: "Bar", icon: "📶" },
  { type: "line", label: "Line", icon: "📈" },
  { type: "violin", label: "Violin", icon: "🎻" },
  { type: "heatmap", label: "Heatmap", icon: "🔥" },
  { type: "density", label: "Density", icon: "🌊" },
  { type: "pie", label: "Pie", icon: "🥧" },
  { type: "area", label: "Area", icon: "📐" },
  { type: "qq_plot", label: "Q-Q Plot", icon: "📏" },
];

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chartTypeOptions.map((option) => {
        const isActive = option.type === value;

        return (
          <button
            key={option.type}
            type="button"
            data-active={isActive}
            onClick={() => onChange(option.type)}
            aria-label={option.label}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm transition ${
              isActive
                ? "border-lumina-500 bg-lumina-50 ring-2 ring-lumina-200"
                : "border-slate-300 bg-white text-slate-700 hover:border-lumina-300 hover:bg-lumina-50"
            }`}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

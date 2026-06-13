import { useState } from "react";
import { PALETTES, type PaletteId } from "@/constants/palettes";
import { PLOTLY_TEMPLATES, TEMPLATE_LABELS, useThemeStore, type PlotlyTemplate } from "@/stores/themeStore";

export function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const template = useThemeStore((state) => state.template);
  const palette = useThemeStore((state) => state.palette);
  const setTemplate = useThemeStore((state) => state.setTemplate);
  const setPalette = useThemeStore((state) => state.setPalette);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-label="Chart theme"
      >
        Theme
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-md">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Chart Style</p>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as PlotlyTemplate)}
              className="mb-3 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              {PLOTLY_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABELS[t]}
                </option>
              ))}
            </select>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Color Palette</p>
            <div className="flex flex-col gap-1">
              {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPalette(id)}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-slate-50 ${
                    palette === id ? "bg-lumina-50 font-semibold text-lumina-700" : "text-slate-700"
                  }`}
                >
                  <span className="flex gap-0.5">
                    {PALETTES[id].colors.slice(0, 5).map((color, i) => (
                      <span
                        key={i}
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  {PALETTES[id].label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

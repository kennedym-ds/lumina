import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PALETTE, type PaletteId } from "@/constants/palettes";

export const PLOTLY_TEMPLATES = ["plotly_white", "plotly_dark", "ggplot2", "seaborn", "simple_white"] as const;
export const TEMPLATE_LABELS: Record<PlotlyTemplate, string> = {
  plotly_white: "Clean White",
  plotly_dark: "Dark",
  ggplot2: "ggplot2",
  seaborn: "Seaborn",
  simple_white: "Minimal",
};

export type PlotlyTemplate = (typeof PLOTLY_TEMPLATES)[number];

interface ThemeState {
  template: PlotlyTemplate;
  palette: PaletteId;
  setTemplate: (template: PlotlyTemplate) => void;
  setPalette: (palette: PaletteId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      template: "plotly_white",
      palette: DEFAULT_PALETTE,
      setTemplate: (template) => set({ template }),
      setPalette: (palette) => set({ palette }),
    }),
    { name: "lumina-theme" },
  ),
);

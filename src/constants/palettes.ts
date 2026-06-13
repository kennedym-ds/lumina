export const PALETTES = {
  "okabe-ito": {
    label: "Okabe-Ito (colorblind-safe)",
    colors: ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#000000"],
  },
  "tableau-10": {
    label: "Tableau 10",
    colors: ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"],
  },
  pastel: {
    label: "Pastel",
    colors: ["#AEC6CF", "#FFD1DC", "#B5EAD7", "#FFDAC1", "#C7CEEA", "#E2F0CB", "#F3D7CA", "#D5E8D4"],
  },
  vivid: {
    label: "Vivid",
    colors: ["#E63946", "#457B9D", "#2A9D8F", "#E9C46A", "#F4A261", "#264653", "#A8DADC", "#1D3557"],
  },
  monochrome: {
    label: "Monochrome",
    colors: ["#1a1a1a", "#4d4d4d", "#808080", "#b3b3b3", "#999999", "#333333", "#666666", "#cccccc"],
  },
} as const;

export type PaletteId = keyof typeof PALETTES;
export const DEFAULT_PALETTE: PaletteId = "okabe-ito";

// Visual themes. Each level picks one via its "theme" field.
export const THEMES = {
  meadow: {
    sky: ["#6ec6ff", "#b8e8ff", "#f3fbff"], sun: { x: 0.78, y: 0.2, r: 46, color: "#fff6c2" },
    hills: ["#8fd1a8", "#5fb77f"], clouds: true,
    ground: { base: "#8b5a3c", dark: "#6e4429", speck: "#a56f4b", top: "#62c554", topDark: "#3f9a3d", edge: "#4a2c19" },
    water: "#3b8fe0",
  },
  dusk: {
    sky: ["#3a2a6b", "#d9577a", "#ffb35c"], image: true, sun: null,
    hills: ["#5c3466", "#3b2149"], clouds: false,
    ground: { base: "#6a3f55", dark: "#4d2c40", speck: "#85506b", top: "#f2a548", topDark: "#c2742c", edge: "#2f1a2a" },
    water: "#c4568a",
  },
  cave: {
    sky: ["#171a33", "#242a52", "#2d3563"], cave: true, sun: null,
    hills: ["#2a2f5a", "#1c2040"], clouds: false,
    ground: { base: "#4a4f78", dark: "#363a5c", speck: "#6a70a0", top: "#8ea2ff", topDark: "#5d6fd0", edge: "#20233d" },
    water: "#4a7be0",
  },
  lagoon: {
    sky: ["#0f5c9a", "#1688c4", "#3fc6d8"], water: "#2aa7d8", rays: true, sun: null,
    hills: ["#1a7f9e", "#13637f"], clouds: false,
    ground: { base: "#c9a56a", dark: "#a8854e", speck: "#e0c58f", top: "#f1dc9c", topDark: "#c9a56a", edge: "#6b5430" },
  },
  night: {
    sky: ["#0a0f2e", "#1b2760", "#3b4a94"], stars: true, sun: { x: 0.2, y: 0.18, r: 34, color: "#f4f1d0", moon: true },
    hills: ["#25306b", "#171f4a"], clouds: true, cloudAlpha: 0.12,
    ground: { base: "#34406f", dark: "#262f56", speck: "#47558f", top: "#4fd1b5", topDark: "#2b9984", edge: "#141a38" },
    water: "#3b66c9",
  },
  sky: {
    sky: ["#4aa8ff", "#92d2ff", "#e6f6ff"], sun: { x: 0.5, y: 0.14, r: 60, color: "#fffbe0" },
    hills: ["#cfe9ff", "#b0d8ff"], clouds: true, cloudsBig: true,
    ground: { base: "#e9f2ff", dark: "#c3d6ee", speck: "#ffffff", top: "#ffffff", topDark: "#cfe0f5", edge: "#8fa8c8" },
    water: "#4aa8ff",
  },
};

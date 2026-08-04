/**
 * Chart palette — the single sanctioned home for concrete chart color values
 * (web/CLAUDE.md bans hex elsewhere; canvas-rendered charts can't read CSS
 * variables, and ECharts' color parser doesn't understand oklch()).
 *
 * Every value is the sRGB hex of a design token in app/globals.css — if a
 * token changes, re-derive the hex here (oklch → hex). The categorical hues
 * match the Recharts PALETTE in components/charts/insight-charts.tsx.
 *
 * HTML-rendered chart chrome (tooltips) should keep using CSS variables via
 * `cssVarTooltipStyle` so it follows the theme live.
 */

/** Categorical series colors — distinct hues at consistent lightness/chroma. */
export const CHART_PALETTE = [
  "#009f6d", // oklch(0.62 0.14 163) emerald
  "#2784d5", // oklch(0.60 0.15 250) blue
  "#e26333", // oklch(0.65 0.17 40)  orange
  "#c39900", // oklch(0.70 0.15 90)  yellow
  "#a23db8", // oklch(0.55 0.20 320) magenta
  "#00969f", // oklch(0.60 0.13 200) cyan
  "#e54b57", // oklch(0.63 0.19 20)  red
  "#74aa54", // oklch(0.68 0.13 135) green
  "#7b65d1", // oklch(0.58 0.16 290) violet
] as const;

/** Semantic flow colors (sunburst inner ring, Sankey income node). */
export const FLOW_COLORS = {
  income: "#009f6d", // --positive (light)
  spending: "#d33850", // --negative (light)
} as const;

/** Neutral node color for the Sankey's Unallocated bucket, per theme. */
export const NEUTRAL_NODE = { light: "#676874", dark: "#9797a1" } as const;

/** Canvas text/border neutrals per theme (labels drawn on the page background). */
export const CHART_NEUTRALS = {
  light: { text: "#191924", subtext: "#676874", border: "#e1e1e5" }, // --foreground / --muted-foreground / --border
  dark: { text: "#eeeef2", subtext: "#9797a1", border: "#2d2d36" },
} as const;

/** White-ish label color for text drawn ON colored wedges (both themes). */
export const ON_WEDGE_TEXT = "#ffffff";

/** Is the app currently in dark mode? Charts are client-only, so reading the
 *  documentElement class at option-build time is safe. */
export function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** Theme-following tooltip chrome (tooltips are HTML, so CSS vars work). */
export const cssVarTooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  textStyle: { color: "var(--color-foreground)", fontSize: 12 },
} as const;

/** Pick a categorical color by index, cycling past the palette end. */
export function paletteColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length];
}

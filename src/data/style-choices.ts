import { t } from "@/utils/i18n";
export const LINECAPS = { butt: t("Butt"), round: t("Round"), square: t("Square") };
export const LINEJOINS = { miter: t("Miter"), round: t("Round"), bevel: t("Bevel") };
export const FONT_STYLES = { italic: t("Italic") };
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export const CLIPS = { "url(#land)": t("water"), "url(#water)": t("land") };

export const HEIGHTMAP_CURVES = {
  curveBasisClosed: t("Curved"),
  curveLinear: t("Linear"),
  curveStep: t("Rectangular")
};
export const CONTOUR_MODES = { off: t("Off"), overlay: t("Over colors"), only: t("Lines only") };
export const HACHURE_MODES = { off: t("Off"), overlay: t("Over colors"), only: t("Strokes only") };

export const LAKE_EMBELLISHMENTS = { none: t("None"), ripples: t("Ripples"), lines: t("Straight strokes") };
export const RELIEF_SETS = ["simple", "colored", "gray", "illustrated", "stickers"] as const;
export const RELIEF_SET_LABELS: Record<(typeof RELIEF_SETS)[number], string> = {
  simple: t("Simple"),
  colored: t("Colored"),
  gray: t("Gray"),
  illustrated: t("Illustrated"),
  stickers: t("Stickers")
};
export const POPULATION_TYPES = { bars: t("Bars"), cells: t("Cells") };
export const WAVE_TYPES = { waves: t("Waves"), lines: t("Straight strokes") };

export const MAP_FILTERS = {
  "url(#filter-grayscale)": t("Grayscale"),
  "url(#filter-sepia)": t("Sepia"),
  "url(#filter-dingy)": t("Dingy"),
  "url(#filter-tint)": t("Tint")
};

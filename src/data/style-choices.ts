export const LINECAPS = { butt: "Butt", round: "Round", square: "Square" };
export const LINEJOINS = { miter: "Miter", round: "Round", bevel: "Bevel" };
export const FONT_STYLES = { italic: "Italic", oblique: "Oblique" };
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export const FONT_WEIGHT_LABELS = { 950: "950 (Ultra-black)" };
export const CLIPS = { "url(#land)": "Clip water", "url(#water)": "Clip land" };

export const HEIGHTMAP_CURVES = { curveBasisClosed: "Curved", curveLinear: "Linear", curveStep: "Rectangular" };
export const CONTOUR_MODES = { off: "Off", overlay: "Over colors", only: "Lines only" };
export const HACHURE_MODES = { off: "Off", overlay: "Over colors", only: "Strokes only" };

export const RELIEF_STYLES = { simple: "Simple", gray: "Gray", colored: "Colored", illustrated: "Illustrated" };

export const LAKE_EMBELLISHMENTS = { none: "None", ripples: "Ripples", lines: "Straight strokes" };
export const WAVE_TYPES = { waves: "Waves", lines: "Straight strokes" };

// the whole-map filters; each has a matching #filter-<id> in the svg defs
export const MAP_FILTERS = { grayscale: "Grayscale", sepia: "Sepia", dingy: "Dingy", tint: "Tint" };

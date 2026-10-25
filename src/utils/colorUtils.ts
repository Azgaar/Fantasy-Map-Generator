import {
  color,
  hcl,
  interpolate,
  interpolateRainbow,
  type RGBColor,
  range,
  scaleSequential,
  schemeCategory10,
  shuffler
} from "d3";

/**
 * A CSS color as HEX: hex is kept as written, rgb/rgba, hsl and a color name go through d3-color.
 * A translucent color becomes an 8-digit hex; "" means the value is not a color at all.
 */
export const toHEX = (cssColor: string): string => {
  const value = cssColor.trim();
  if (value.startsWith("#")) return value;

  const parsed = color(value);
  if (!parsed) return "";
  return parsed.opacity < 1 ? parsed.formatHex8() : parsed.formatHex();
};

/** Any CSS color as HEX; a value that is not a color (a pattern url, an empty string) is unchanged */
export const toColorHex = (value: string): string => toHEX(value) || value;

/** A usable fill color as HEX ("#a1b2c3" or a CSS color name), or a readable error */
export const requireColor = (value: unknown): string => {
  const hex = typeof value === "string" ? toHEX(value) : "";
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) throw new Error("The color must be a HEX color like #a1b2c3");
  return hex;
};

/** A HEX color or a hatching pattern reference, as the fill picker gives them */
export const requireFill = (value: unknown): string =>
  typeof value === "string" && /^url\(#hatch\d+\)$/.test(value) ? value : requireColor(value);

/** Predefined set of 12 distinct pastel colors */
export const C_12 = [
  "#dababf",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#c6b9c1",
  "#bc80bd",
  "#ccebc5",
  "#ffed6f",
  "#8dd3c7",
  "#eb8de7"
];

export const getCardinalColor = (index: number) => schemeCategory10[index % schemeCategory10.length];

/**
 * Get an array of distinct colors
 * Uses shuffler with current Math.random to ensure seeded randomness works
 * @param {number} count - The count of colors to generate
 * @returns {string[]} - The array of HEX color strings
 */
export const getColors = (count: number): string[] => {
  const scaleRainbow = scaleSequential(interpolateRainbow);
  // Use shuffler() to create a shuffle function that uses the current Math.random
  const shuffle = shuffler(() => Math.random());
  const colors = shuffle(
    range(count).map(i => (i < 12 ? C_12[i] : color(scaleRainbow((i - 12) / (count - 12)))?.formatHex()))
  );
  return colors.filter((c): c is string => typeof c === "string");
};

/**
 * Get a random color in HEX format
 * @returns {string} - The HEX color string
 */
export const getRandomColor = (): string => {
  const colorFromRainbow: RGBColor = color(scaleSequential(interpolateRainbow)(Math.random())) as RGBColor;
  return colorFromRainbow.formatHex();
};

/**
 * Get a mixed color by blending a given color with a random color
 * @param {string} color - The base color in HEX format
 * @param {number} mix - The mix ratio (0 to 1)
 * @param {number} bright - The brightness adjustment
 * @returns {string} - The mixed HEX color string
 */
export const getMixedColor = (colorToMix: string, mix = 0.2, bright = 0.3): string => {
  const c = colorToMix && colorToMix[0] === "#" ? colorToMix : getRandomColor(); // if provided color is not hex (e.g. harching), generate random one
  const mixedColor: RGBColor = color(interpolate(c, getRandomColor())(mix)) as RGBColor;
  return mixedColor.brighter(bright).formatHex();
};

/** the hue arc a polity's sectors rotate in, so a sector never sits closer than ~70° to the polity hue */
const SECTOR_ARC = 210;
const SECTOR_OFFSET = 75;

/**
 * A sector of a polity: the polity's chroma and lightness with the hue spun well clear of it.
 * The sector's index within its polity sequences the rotation, so the sectors of one state differ
 * from the polity and from each other; an achromatic polity falls back to a blend
 * @param {string} polityColor - The polity color in HEX format
 * @param {number} index - The sector's index within its polity, sequencing the rotation
 * @returns {string} - The sector color in HEX format
 */
export const getSectorColor = (polityColor: string, index: number): string => {
  const base = polityColor[0] === "#" ? hcl(polityColor) : null;
  if (!base || !Number.isFinite(base.h)) return getMixedColor(polityColor, 0.5, 0.2); // achromatic: blend instead
  const spin = SECTOR_OFFSET + ((index * 49) % SECTOR_ARC) + (((index * 17) % 11) - 5); // the tail jitters the ladder
  base.h = (base.h + spin + 360) % 360;
  base.l = Math.max(12, Math.min(92, base.l + ((index % 3) - 1) * 5)); // the lightness ladder separates wrapped spins
  return base.formatHex();
};

declare global {
  interface Window {
    toHEX: typeof toHEX;
  }
}

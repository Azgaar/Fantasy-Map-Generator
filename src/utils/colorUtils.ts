import {
  color,
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

declare global {
  interface Window {
    toHEX: typeof toHEX;
  }
}

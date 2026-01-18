import { color, interpolate, interpolateRainbow, range, RGBColor, scaleSequential, shuffle } from "d3";

/**
 * Convert RGB or RGBA color to HEX
 * @param {string} rgba - The RGB or RGBA color string
 * @returns {string} - The HEX color string
 */
export const toHEX = (rgba: string): string => {
  if (rgba.charAt(0) === "#") return rgba;

  const matches = rgba.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return matches && matches.length === 4
    ? "#" +
        ("0" + parseInt(matches[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(matches[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(matches[3], 10).toString(16)).slice(-2)
    : "";
}

/** Predefined set of 12 distinct colors */
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

/** 
 * Get an array of distinct colors
 * @param {number} count - The count of colors to generate
 * @returns {string[]} - The array of HEX color strings
*/
export const getColors = (count: number): string[] => {
  const scaleRainbow = scaleSequential(interpolateRainbow);
  const colors = shuffle(
    range(count).map(i => (i < 12 ? C_12[i] : color(scaleRainbow((i - 12) / (count - 12)))?.formatHex()))
  );
  return colors.filter((c): c is string => typeof c === "string");
}

/**
 * Get a random color in HEX format
 * @returns {string} - The HEX color string
 */
export const getRandomColor = (): string => {
  const colorFromRainbow: RGBColor = color(scaleSequential(interpolateRainbow)(Math.random())) as RGBColor;
  return colorFromRainbow.formatHex();
}

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
}

declare global {
  interface Window {
    toHEX: typeof toHEX;
    getColors: typeof getColors;
    getRandomColor: typeof getRandomColor;
    getMixedColor: typeof getMixedColor;
    C_12: typeof C_12;
  } 
}

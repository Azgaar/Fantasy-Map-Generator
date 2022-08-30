import * as d3 from "d3";

const cardinal12: Hex[] = [
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

export type TColorScheme = "default" | "bright" | "light" | "green" | "rainbow" | "monochrome";
const colorSchemeMap: {[key in TColorScheme]: d3.ScaleSequential<string>} = {
  default: d3.scaleSequential(d3.interpolateSpectral),
  bright: d3.scaleSequential(d3.interpolateSpectral),
  light: d3.scaleSequential(d3.interpolateRdYlGn),
  green: d3.scaleSequential(d3.interpolateGreens),
  rainbow: d3.scaleSequential(d3.interpolateRainbow),
  monochrome: d3.scaleSequential(d3.interpolateGreys)
};

export function getColors(number: number): Hex[] {
  if (number <= cardinal12.length) return d3.shuffle(cardinal12.slice(0, number));

  const scheme = colorSchemeMap.default;
  const colors = d3.range(number).map(index => {
    if (index < 12) return cardinal12[index];

    const rgb = scheme((index - 12) / (number - 12))!;
    return d3.color(rgb)!.formatHex() as Hex;
  });

  return d3.shuffle(colors);
}

export function getRandomColor(): Hex {
  const scheme = d3.scaleSequential(d3.interpolateSpectral);
  const rgb = scheme(Math.random())!;
  return d3.color(rgb)?.formatHex() as Hex;
}

// mix a color with a random color. TODO: refactor without interpolation
export function getMixedColor(color: Hex | CssUrl, mixation = 0.2, bright = 0.3) {
  const color1 = color.startsWith("#") ? color : getRandomColor();
  const color2 = getRandomColor();
  const mixedColor = d3.interpolate(color1, color2)(mixation);

  return d3.color(mixedColor)!.brighter(bright).formatHex() as Hex;
}

export function darker(color: Hex | CssUrl, amount = 1) {
  if (color.startsWith("#") === false) return color;
  return d3.color(color)!.darker(amount).formatHex() as Hex;
}

export function brighter(color: Hex | CssUrl, amount = 1) {
  if (color.startsWith("#") === false) return color;
  return d3.color(color)!.brighter(amount).formatHex() as Hex;
}

export function getColorScheme(schemeName: TColorScheme) {
  return colorSchemeMap[schemeName] || colorSchemeMap.bright;
}

export function getHeightColor(height: number, scheme = getColorScheme("default")) {
  const fittedValue = height < 20 ? height - 5 : height;
  return scheme(1 - fittedValue / 100);
}

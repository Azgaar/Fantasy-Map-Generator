import {
  interpolateGreens,
  interpolateGreys,
  interpolateRdYlGn,
  interpolateRgbBasis,
  interpolateSpectral,
  scaleSequential
} from "d3";

export type HeightColorScheme = (value: number) => string;

export const HEIGHT_COLOR_SCHEMES: Record<string, HeightColorScheme> = {
  bright: scaleSequential(interpolateSpectral),
  green: scaleSequential(interpolateGreens),
  light: scaleSequential(interpolateRdYlGn),
  livid: scaleSequential(interpolateRgbBasis(["#BBBBDD", "#2A3440", "#17343B", "#0A1E24"])),
  monochrome: scaleSequential(interpolateGreys),
  natural: scaleSequential(interpolateRgbBasis(["white", "#EEEECC", "tan", "green", "teal"])),
  olive: scaleSequential(interpolateRgbBasis(["#ffffff", "#cea48d", "#d5b085", "#0c2c19", "#151320"]))
};

export function addCustomHeightColorScheme(scheme: string): HeightColorScheme {
  const colorScheme = scaleSequential(interpolateRgbBasis(scheme.split(",")));
  HEIGHT_COLOR_SCHEMES[scheme] = colorScheme;
  return colorScheme;
}

export function getHeightColorScheme(scheme = "bright"): HeightColorScheme {
  return HEIGHT_COLOR_SCHEMES[scheme] ?? addCustomHeightColorScheme(scheme);
}

export function getHeightColor(value: number, scheme = getHeightColorScheme("bright")): string {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

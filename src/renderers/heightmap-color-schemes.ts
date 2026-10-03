// Heightmap colour schemes: the built-in d3 ramps plus the custom "#hex,#hex,…" gradients users add
import {
  interpolateGreens,
  interpolateGreys,
  interpolateRdYlGn,
  interpolateRgbBasis,
  interpolateSpectral,
  scaleSequential
} from "d3";

export type ColorScheme = (t: number) => string;

const schemes: Record<string, ColorScheme> = {
  bright: scaleSequential(interpolateSpectral),
  light: scaleSequential(interpolateRdYlGn),
  natural: scaleSequential(interpolateRgbBasis(["white", "#EEEECC", "tan", "green", "teal"])),
  green: scaleSequential(interpolateGreens),
  olive: scaleSequential(interpolateRgbBasis(["#ffffff", "#cea48d", "#d5b085", "#0c2c19", "#151320"])),
  livid: scaleSequential(interpolateRgbBasis(["#BBBBDD", "#2A3440", "#17343B", "#0A1E24"])),
  monochrome: scaleSequential(interpolateGreys)
};

function names(): string[] {
  return Object.keys(schemes);
}

function has(name: string): boolean {
  return name in schemes;
}

// a custom scheme is named by its stops: "#hex,#hex,…" from high to low altitude
function add(name: string): ColorScheme {
  schemes[name] = scaleSequential(interpolateRgbBasis(name.split(",")));
  return schemes[name];
}

function ensure(name: string): void {
  if (name && !has(name)) add(name);
}

function get(name: string | null | undefined): ColorScheme {
  const scheme = name || "bright";
  if (!has(scheme)) add(scheme);
  return schemes[scheme];
}

function getColor(value: number, scheme: ColorScheme = get("bright")): string {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

export const HeightmapColorSchemes = { get, getColor, names, has, add, ensure };

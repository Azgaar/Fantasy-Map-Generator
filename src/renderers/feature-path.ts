import type { Feature } from "@/generators/features";
import { clipPoly, round } from "@/utils";
import { buildCoastlinePath, fractalizeCoastline } from "./coastline-fractal";

declare global {
  // vendored lib, loaded as a classic script from public/libs/simplify.js
  var simplify: (points: [number, number][], tolerance: number, highestQuality?: boolean) => [number, number][];
}

export function getFeaturePath(feature: Feature): string {
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
  if (points.some(point => point === undefined)) {
    ERROR && console.error("Undefined point in getFeaturePath");
    return "";
  }

  const simplifiedPoints = simplify(points, 0.3);
  const clippedPoints = clipPoly(simplifiedPoints, graphWidth, graphHeight, 1);
  const shape = fractalizeCoastline(clippedPoints, feature.i, feature.type);
  return `${round(buildCoastlinePath(shape))}Z`;
}

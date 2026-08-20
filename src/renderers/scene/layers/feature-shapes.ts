import { clipPolygon } from "lineclip";
import type { Feature } from "@/generators/features";
import type { PackedGraph } from "@/types/PackedGraph";

export interface FeatureShape {
  origIndices: number[];
  points: [number, number][];
}

export interface FeatureShapeOptions {
  fractalize?: (points: [number, number][], feature: Feature) => FeatureShape;
  secureBoundary?: boolean;
  simplify?: (points: [number, number][], tolerance: number) => [number, number][];
  simplifyTolerance?: number;
}

export interface MapBounds {
  height: number;
  width: number;
}

export function buildFeatureShape(
  feature: Feature,
  vertices: Pick<PackedGraph["vertices"], "p">,
  bounds: MapBounds,
  options: FeatureShapeOptions = {}
): FeatureShape | null {
  const points = feature.vertices.map(vertexId => vertices.p[vertexId]);
  if (points.length < 3 || points.some(point => point === undefined)) return null;

  const simplified: [number, number][] = options.simplify
    ? options.simplify(points, options.simplifyTolerance ?? 0.3)
    : points.map(([x, y]) => [x, y] as [number, number]);
  const clipped = clipFeaturePolygon(simplified, bounds, options.secureBoundary ?? false);
  if (clipped.length < 3) return null;

  return options.fractalize
    ? options.fractalize(clipped, feature)
    : { origIndices: clipped.map((_, index) => index), points: clipped };
}

function clipFeaturePolygon(
  points: [number, number][],
  bounds: MapBounds,
  secureBoundary: boolean
): [number, number][] {
  const clipped = clipPolygon(points, [0, 0, bounds.width, bounds.height]);
  if (!secureBoundary || !clipped.length) return clipped;

  const secured: [number, number][] = [];
  for (const point of clipped) {
    secured.push(point);
    if (point[0] === 0 || point[0] === bounds.width || point[1] === 0 || point[1] === bounds.height) {
      secured.push(point, point);
    }
  }
  return secured;
}

/**
 * layers/regions.ts — `twRegions`: territory fill + boundary strokes.
 *
 * Ported from the overlay's `map/fills.js`, re-hosted as a registered FMG layer:
 * one merged `<path>` per owner color (washed fill, exact-color stroke) and one
 * path of shared-edge segments wherever two different regions meet.
 *
 * Adjacency comes from FMG's own packed graph (`cells.c`), so the border is exact
 * rather than inferred from a rebuilt Voronoi. The whole path is memoized per
 * world: it is the expensive layer, and it only changes when the world does.
 */
import { r1, regionStroke, regionWash } from "../color";
import { cellNeighbors, cellPolygon } from "../geometry";
import { getSource } from "../session";
import type { TwSource } from "../source";
import type { TwLayerParams } from "./index";

const BORDER_STROKE = "rgba(12, 16, 22, 0.9)";

interface RegionGeometry {
  key: string;
  fills: string;
  borders: string;
}

let memo: RegionGeometry = { key: "", fills: "", borders: "" };

/**
 * One merged path per owner color, keyed by the RAW color so two realms whose
 * washes normalize to the same string never merge into one another.
 */
function buildFills(source: TwSource): string {
  const byColor = new Map<string, number[]>();
  for (const region of source.regions()) {
    if (region.cells.length === 0) continue;
    let bucket = byColor.get(region.color);
    if (!bucket) {
      bucket = [];
      byColor.set(region.color, bucket);
    }
    bucket.push(...region.cells);
  }

  let html = "";
  for (const [color, cells] of byColor) {
    let d = "";
    for (const cell of cells) d += polygonPath(cellPolygon(cell));
    if (!d) continue;
    html +=
      `<path d="${d}" fill="${regionWash(color)}" stroke="${regionStroke(color)}" stroke-width="0.6" ` +
      `stroke-opacity="0.85" stroke-linejoin="round" fill-rule="nonzero"></path>`;
  }
  return html;
}

/**
 * Border segments: for each cell, each neighbour in another region, the edge the
 * two cells share. A Voronoi diagram has exactly two cells per interior edge, so
 * `neighbor > cell` emits each border segment once.
 */
function buildBorders(source: TwSource): string {
  let d = "";
  for (const region of source.regions()) {
    for (const cell of region.cells) {
      for (const neighbor of cellNeighbors(cell)) {
        if (neighbor <= cell) continue;
        const other = source.regionOf(neighbor);
        if (!other || other.id === region.id) continue;
        const shared = sharedVertices(cellPolygon(cell), cellPolygon(neighbor));
        if (shared.length !== 2) continue;
        const [p, q] = shared;
        d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
    }
  }
  return d;
}

/** Vertices two cell polygons share — the border between them. */
function sharedVertices(a: number[][] | null, b: number[][] | null): number[][] {
  if (!a || !b) return [];
  const key = (point: number[]): string => `${r1(point[0])},${r1(point[1])}`;
  const other = new Set(b.map(key));
  const out: number[][] = [];
  const seen = new Set<string>();
  for (const point of a) {
    const k = key(point);
    if (other.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(point);
    }
  }
  return out;
}

function polygonPath(polygon: number[][] | null): string {
  if (!polygon || polygon.length < 3) return "";
  let d = `M${r1(polygon[0][0])} ${r1(polygon[0][1])}`;
  for (let i = 1; i < polygon.length; i++) d += `L${r1(polygon[i][0])} ${r1(polygon[i][1])}`;
  return `${d}Z`;
}

function geometryFor(source: TwSource): RegionGeometry {
  // cheap identity for "same world": region count and total cells change on any
  // structural edit, while zoom (the thing that changes constantly) does not.
  let cells = 0;
  for (const region of source.regions()) cells += region.cells.length;
  const key = `${source.regions().length}:${cells}:${source.width}`;
  if (memo.key === key) return memo;
  memo = { key, fills: buildFills(source), borders: buildBorders(source) };
  return memo;
}

/** Forget the memoized geometry — used when the world is replaced. */
export function resetRegions(): void {
  memo = { key: "", fills: "", borders: "" };
}

export const twRegions: TwLayerParams = {
  id: "twRegions",
  parent: "viewbox",
  draw(layer) {
    const group = layer.getEl();
    const source = getSource();
    if (source.empty) {
      group.replaceChildren();
      return;
    }
    const { fills, borders } = geometryFor(source);
    group.innerHTML =
      fills +
      (borders
        ? `<path d="${borders}" fill="none" stroke="${BORDER_STROKE}" stroke-width="1" ` +
          `vector-effect="non-scaling-stroke"></path>`
        : "");
  },
  erase(layer) {
    layer.getEl().replaceChildren();
  }
};

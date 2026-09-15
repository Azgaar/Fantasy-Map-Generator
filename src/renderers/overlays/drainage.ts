// Water drainage over a raw heightmap: flow arrows, the depressions that get filled and the lakes to be
import { rn } from "@/utils";
import { SEA_LEVEL } from "@/utils/heightUtils";
import { createEl, ensureEl, findEl } from "@/utils/nodeUtils";

const WIDTHS = [0.5, 0.8, 1.2, 1.7, 2.4]; // stroke width per flux class, at the reference spacing
const OPACITIES = [0.6, 0.7, 0.8, 0.9, 1];
const REFERENCE_SPACING = 14; // ~10k cells on a default-size map
const MIN_DEPTH = 0.5; // flats get a tiny epsilon depth, real depressions at least 1

/** Draw or redraw the drainage of the current grid heightmap. Deep depressions become lakes only when erosion runs */
export function drawDrainage(lakesForm: boolean): void {
  const { cells, points, spacing } = grid;
  const lakes = lakesForm ? Grid.findDeepDepressionLakes(cells, options.generation.lakeElevationLimit) : [];
  const h = Uint8Array.from(cells.h);
  for (const lake of lakes) for (const i of lake) h[i] = 19; // the rest drains into the new lakes
  const { target, flux, depth } = computeDrainage({ ...cells, h });
  const scale = spacing / REFERENCE_SPACING;
  const head = spacing * 0.25;
  const hatch = rn(spacing * 0.35, 2); // hatch step: a few lines per cell

  const arrows: string[][] = WIDTHS.map(() => []);
  const basins: string[] = [];
  const fluxClass = (flux: number): number => Math.min(WIDTHS.length - 1, Math.floor(Math.log2(flux) / 2));
  const basinOpacity = (depth: number): number => rn(Math.min(0.5 + depth / 30, 1), 2);

  for (const i of cells.i) {
    if (depth[i] >= MIN_DEPTH)
      basins.push(`<polygon points="${Grid.getPolygon(i)}" fill-opacity="${basinOpacity(depth[i])}"/>`);
    if (target[i] === -1) continue;

    const [x0, y0] = points[i];
    const [x1, y1] = points[target[i]];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const [sx, sy] = [x0 + ux * length * 0.15, y0 + uy * length * 0.15];
    const [ex, ey] = [x0 + ux * length * 0.7, y0 + uy * length * 0.7];
    // the arrowhead: two strokes back from the tip at ±30°
    const [lx, ly] = [ex - head * (ux * 0.87 - uy * 0.5), ey - head * (uy * 0.87 + ux * 0.5)];
    const [rx, ry] = [ex - head * (ux * 0.87 + uy * 0.5), ey - head * (uy * 0.87 - ux * 0.5)];
    arrows[fluxClass(flux[i])].push(
      `M${rn(sx, 1)},${rn(sy, 1)}L${rn(ex, 1)},${rn(ey, 1)}M${rn(lx, 1)},${rn(ly, 1)}L${rn(ex, 1)},${rn(ey, 1)}L${rn(rx, 1)},${rn(ry, 1)}`
    );
  }

  const arrowPaths = arrows.map((segments, cls) => {
    if (!segments.length) return "";
    const attrs = `stroke-width="${rn(WIDTHS[cls] * scale, 2)}" opacity="${OPACITIES[cls]}"`;
    return `<path d="${segments.join("")}" ${attrs}/>`;
  });

  const lakePolygons = lakes.flat().map(i => `<polygon points="${Grid.getPolygon(i)}"/>`);

  const getGroup = (): SVGGElement => {
    const existing = findEl<SVGGElement>("drainage");
    if (existing) return existing;
    const group = createEl<SVGGElement>("g", "drainage", { "pointer-events": "none" });
    ensureEl("debug").append(group);
    return group;
  };

  getGroup().innerHTML = /* html */ `
    <pattern id="drainageHatch" width="${hatch}" height="${hatch}" patternUnits="userSpaceOnUse">
      <path d="M0,${hatch}L${hatch},0" stroke="#000" stroke-width="${rn(0.5 * scale, 2)}"/>
    </pattern>
    <pattern id="drainageLakeHatch" width="${hatch}" height="${hatch}" patternUnits="userSpaceOnUse">
      <path d="M0,0L${hatch},${hatch}" stroke="#1a5fc8" stroke-width="${rn(0.8 * scale, 2)}"/>
    </pattern>
    <g fill="url(#drainageHatch)" stroke="#000" stroke-width="${rn(0.3 * scale, 2)}">${basins.join("")}</g>
    <g fill="url(#drainageLakeHatch)" stroke="#1a5fc8" stroke-width="${rn(0.5 * scale, 2)}">${lakePolygons.join("")}</g>
    <g fill="none" stroke="#0b2a6b" stroke-linecap="round" stroke-linejoin="round">${arrowPaths.join("")}</g>`;
}

/** Remove the drainage overlay */
export function removeDrainage(): void {
  findEl("drainage")?.remove();
}

type DrainageCells = { i: ArrayLike<number>; c: number[][]; b: ArrayLike<number>; h: ArrayLike<number> };

interface Drainage {
  target: Int32Array; // outlet neighbor of a land cell, -1 for sinks
  flux: Float32Array; // land cells draining through, itself included; sinks get the inflow only
  depth: Float32Array; // fill level above the cell height, > 0 inside a depression
}

const EPSILON = 1e-4; // makes the filled surface strictly descending across flats

function computeDrainage(cells: DrainageCells): Drainage {
  const { c, b, h } = cells;
  const n = cells.i.length;
  const filled = new Float64Array(n);
  const visited = new Uint8Array(n);
  const queue = new FlatQueue();

  for (let i = 0; i < n; i++) {
    if (h[i] >= SEA_LEVEL && !b[i]) continue;
    filled[i] = h[i];
    visited[i] = 1;
    queue.push(i, h[i]);
  }

  while (queue.length) {
    const i = queue.pop();
    for (const neighbor of c[i]) {
      if (visited[neighbor]) continue;
      visited[neighbor] = 1;
      filled[neighbor] = Math.max(h[neighbor], filled[i] + EPSILON);
      queue.push(neighbor, filled[neighbor]);
    }
  }

  const target = new Int32Array(n).fill(-1);
  const flux = new Float32Array(n);
  const depth = new Float32Array(n);
  const land: number[] = [];

  for (let i = 0; i < n; i++) {
    if (h[i] < SEA_LEVEL || b[i]) continue;
    land.push(i);
    depth[i] = filled[i] - h[i];
    for (const neighbor of c[i]) {
      if (filled[neighbor] < filled[target[i] === -1 ? i : target[i]]) target[i] = neighbor;
    }
  }

  land.sort((a, b) => filled[b] - filled[a]); // highest first, so the flow is passed down in one pass
  for (const i of land) {
    flux[i] += 1;
    if (target[i] !== -1) flux[target[i]] += flux[i];
  }

  return { target, flux, depth };
}

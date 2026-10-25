// Core–Rim: one full-extent wash on the axis the grid's temperature dictates — O(1), no isolines
import type { Layer } from "@/components/layers";
import { rn } from "@/utils/numberUtils";
import { coreRimAxis } from "./core-rim";

/** the wash ramp, core heat to rim cold; each stop's opacity scales with the style's intensity */
const STOPS = [
  { offset: 0, color: "#ff9d5c", scale: 1 },
  { offset: 45, color: "#a78bfa", scale: 0.5 },
  { offset: 100, color: "#4f7ce8", scale: 0.25 }
] as const;

export function drawCoreRim(layer: Layer): void {
  TIME && console.time("drawCoreRim");
  const element = layer.getEl();
  const clear = () => {
    element.replaceChildren();
    TIME && console.timeEnd("drawCoreRim");
  };

  const axis = grid?.points?.length ? coreRimAxis(grid.points, grid.cells.temp) : null;
  if (!axis) return void clear(); // a flat field has no rim to read

  const { flip, intensity } = styles.coreRim.options;
  const [hx, hy] = flip ? axis.cold : axis.hot;
  const [cx, cy] = flip ? axis.hot : axis.cold;
  const ux = cx - hx;
  const uy = cy - hy;
  const length = Math.hypot(ux, uy);
  if (!length) return void clear();
  const dirX = ux / length;
  const dirY = uy / length;

  // span the extent edge to edge along the axis: the corners hold the extreme projections
  const { width, height } = options.map.graph;
  const projections = [0, width].flatMap(x => [0, height].map(y => x * dirX + y * dirY));
  const near = Math.min(...projections);
  const far = Math.max(...projections);

  const reach = Math.max(0, Math.min(1, intensity));
  const stops = STOPS.map(
    ({ offset, color, scale }) =>
      `<stop offset="${offset}%" stop-color="${color}" stop-opacity="${rn(reach * scale, 3)}"/>`
  ).join("");

  element.innerHTML = /* html */ `<defs>
    <linearGradient id="coreRimWash" gradientUnits="userSpaceOnUse"
      x1="${rn(dirX * near, 2)}" y1="${rn(dirY * near, 2)}"
      x2="${rn(dirX * far, 2)}" y2="${rn(dirY * far, 2)}">${stops}</linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#coreRimWash)"/>`;

  TIME && console.timeEnd("drawCoreRim");
}

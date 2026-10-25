import type { CurveFactory } from "d3";
import {
  color,
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  extent,
  line,
  range
} from "d3";
import type { GridRaster } from "@/model/graph/grid-generator";
import { Grid } from "@/model/graph/grid-generator";
import type { Vertices } from "@/model/graph/voronoi";
import { getHeightUnitRatio, heightToMeters, metersToHeight } from "@/model/units";
import { HeightmapColorSchemes } from "@/renderers/heightmap/heightmap-color-schemes";
import type { GridGraph } from "@/types/grid-graph";
import { SEA_LEVEL } from "@/utils/height-utils";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { notify } from "@/utils/notices";
import { rn } from "@/utils/number-utils";
import { round } from "@/utils/string-utils";
import {
  type ContourLabel,
  getContourLabels,
  getContourLevels,
  getHeightContourChains,
  getHeightContours,
  smoothContourHeights
} from "./heightmap-contours";
import { getHachures } from "./heightmap-hachures";

const HACHURE_LEVEL = 4; // height units between the levels hachure strokes are seeded along
const LABEL_SPACING = 60; // font sizes between the labels along one contour

const CURVE_MAP: Record<string, CurveFactory> = {
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore
};

// the cell surface extended to the boundary pseudo-points the Delaunay triangles reference
function getContourSurface(smoothed: Float64Array): { points: [number, number][]; elevations: Float64Array } {
  const points = [...grid.points, ...grid.boundary];
  const elevations = Float64Array.from(points, ([x, y], i) => smoothed[i < smoothed.length ? i : Grid.findCell(x, y)]);
  return { points, elevations };
}

/** Whether the heights group is tinted by elevation, not drawn as contour or hachure lines alone */
export const hasHeightTints = (heightOptions: typeof styles.heightmap.groups.landHeights.options): boolean =>
  heightOptions.contours.mode !== "only" && heightOptions.hachures.mode !== "only";

// the labels, each over a white halo painted first that breaks the line under the text
function getContourLabelsMarkup(labels: ContourLabel[], fontSize: number, fill: string): string {
  if (!labels.length) return "";
  const texts = labels.map(
    ({ x, y, angle, text }) =>
      `<text transform="translate(${rn(x, 2)} ${rn(y, 2)}) rotate(${rn(angle, 1)})" dy="0.35em">${text}</text>`
  );
  return /* html */ `<g class="heightmap-contour-labels" fill="${fill}" stroke="#ffffff" stroke-width="${rn(fontSize / 3, 2)}"
    stroke-linejoin="round" paint-order="stroke" font-size="${fontSize}" text-anchor="middle">${texts.join("")}</g>`;
}

export const drawHeightmap = (): void => {
  if (options.app.mode === "heightmap")
    return void notify(t("The Layer control is not available in the heightmap edit mode"), "error");

  log.time("drawHeightmap");

  const paths: (string | undefined)[] = new Array(101);
  const { cells, vertices } = grid;
  const used = new Uint8Array(cells.i.length);
  const heights = Array.from(cells.i).sort((a, b) => cells.h[a] - cells.h[b]);
  const { width, height } = options.map.graph;

  const landOptions = styles.heightmap.groups.landHeights.options;
  const oceanOptions = styles.heightmap.groups.oceanHeights.options;
  const landFillsVisible = hasHeightTints(landOptions);
  const oceanFillsVisible = hasHeightTints(oceanOptions);
  const oceanMarkup: string[] = [];
  const landMarkup: string[] = [];

  // ocean cells
  const renderOceanCells = oceanOptions.render;
  if (renderOceanCells && oceanFillsVisible) {
    const skip = oceanOptions.skip + 1 || 1;
    const relax = oceanOptions.relax;
    const lineGen = line().curve(CURVE_MAP[oceanOptions.curve] ?? curveBasisClosed);

    let currentLayer = 0;
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer >= 20) break;
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some((n: number) => cells.h[n] < h);
      if (!onborder) continue;
      const vertex = cells.v[i].find((v: number) => vertices.c[v].some((i: number) => cells.h[i] < h));
      if (vertex === undefined) continue;
      const chain = connectVertices(cells, vertices, vertex, h, used);
      if (chain.length < 3) continue;
      const points = simplifyLine(chain, relax).map((v: number) => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points) || "");
    }
  }

  // land cells
  if (landFillsVisible) {
    const skip = landOptions.skip + 1 || 1;
    const relax = landOptions.relax;
    const lineGen = line().curve(CURVE_MAP[landOptions.curve] ?? curveBasisClosed);

    let currentLayer = 20;
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer > 100) break; // no layers possible with height > 100
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some((n: number) => cells.h[n] < h);
      if (!onborder) continue;

      const startVertex = cells.v[i].find((v: number) => vertices.c[v].some((i: number) => cells.h[i] < h));
      if (startVertex === undefined) continue;
      const chain = connectVertices(cells, vertices, startVertex, h, used);
      if (chain.length < 3) continue;

      const points = simplifyLine(chain, relax).map((v: number) => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points) || "");
    }
  }

  // render paths
  const baseRect = (fill: string) => `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}"/>`;
  for (let h = 0; h <= 100; h++) {
    const isOcean = h < 20;
    const heightOptions = isOcean ? oceanOptions : landOptions;
    if (!(isOcean ? oceanFillsVisible : landFillsVisible)) continue;
    const markup = isOcean ? oceanMarkup : landMarkup;
    const scheme = HeightmapColorSchemes.get(heightOptions.scheme);

    if (h === 0 && renderOceanCells) markup.push(baseRect(scheme(1))); // base ocean layer
    if (h === 20) markup.push(baseRect(scheme(0.8))); // base land layer

    const path = paths[h];
    if (!path || path.length < 10) continue;
    const terracing = heightOptions.terracing / 10 || 0;
    const fill = HeightmapColorSchemes.getColor(h, scheme);
    if (terracing) {
      const shade = color(fill)!.darker(terracing).toString();
      markup.push(`<path d="${path}" transform="translate(.7,1.4)" fill="${shade}" data-height="${h}"/>`);
    }
    markup.push(`<path d="${path}" fill="${fill}" data-height="${h}"/>`);
  }

  let smoothedHeights: Float64Array | undefined; // shared by contours and hachures
  const getSmoothedHeights = () => (smoothedHeights ??= smoothContourHeights(cells.h, cells.c));

  if (landOptions.contours.mode !== "off" || (renderOceanCells && oceanOptions.contours.mode !== "off")) {
    const smoothed = getSmoothedHeights();
    const { points, elevations } = getContourSurface(smoothed);
    const ratio = getHeightUnitRatio();
    const [min = SEA_LEVEL, max = SEA_LEVEL] = extent(cells.h);

    for (const [markup, options, isOcean] of [
      [landMarkup, landOptions, false],
      [oceanMarkup, oceanOptions, true]
    ] as const) {
      const contours = options.contours;
      if (contours.mode === "off" || (isOcean && !renderOceanCells)) continue;
      const levels = isOcean
        ? getContourLevels(contours.interval, -heightToMeters(min) * ratio, depth => metersToHeight(-depth / ratio))
        : getContourLevels(contours.interval, heightToMeters(max) * ratio, value => metersToHeight(value / ratio));
      const chains = getHeightContourChains(
        points,
        elevations,
        vertices.c,
        levels.map(level => level.height)
      );
      // full-precision coordinates bloat the saved map
      const lines = getHeightContours(chains, levels).map(
        ({ path, height, major }) =>
          `<path d="${round(path)}" data-height="${height}" stroke-width="${contours.width * (major ? 2 : 1)}"/>`
      );
      const labels = contours.fontSize
        ? getContourLabels(chains, levels, {
            size: contours.fontSize,
            spacing: contours.fontSize * LABEL_SPACING,
            heightAt: (x, y) => smoothed[Grid.findCell(x, y)],
            probe: grid.spacing
          })
        : [];
      markup.push(/* html */ `<g class="heightmap-contours" fill="none" stroke="${contours.color}" stroke-linejoin="round"
        stroke-linecap="round" opacity="${contours.opacity}" mask="url(#${isOcean ? "water" : "land"})" pointer-events="none"
        >${lines.join("")}${getContourLabelsMarkup(labels, contours.fontSize, contours.color)}</g>`);
    }
  }

  if (landOptions.hachures.mode !== "off" || (renderOceanCells && oceanOptions.hachures.mode !== "off")) {
    const smoothed = smoothContourHeights(getSmoothedHeights(), cells.c); // twice: a calm fall line
    const { points, elevations } = getContourSurface(smoothed);
    for (const [markup, heightOptions, isOcean] of [
      [landMarkup, landOptions, false],
      [oceanMarkup, oceanOptions, true]
    ] as const) {
      const hachures = heightOptions.hachures;
      if (hachures.mode === "off" || (isOcean && !renderOceanCells)) continue;
      const path = getHachures({
        points,
        heights: elevations,
        neighbors: cells.c,
        triangles: vertices.c,
        spacing: grid.spacing,
        findCell: (x, y) => (x < 0 || y < 0 || x > width || y > height ? -1 : Grid.findCell(x, y)),
        inBand: isOcean ? h => h < 20 : h => h >= 20,
        thresholds: isOcean
          ? range(20 - HACHURE_LEVEL, 0, -HACHURE_LEVEL)
          : range(20 + HACHURE_LEVEL, 100, HACHURE_LEVEL),
        density: hachures.density,
        length: hachures.length,
        width: hachures.width,
        seed: options.map.seed
      });
      if (!path) continue;
      markup.push(/* html */ `<g class="heightmap-hachures" fill="${hachures.color}" fill-rule="nonzero"
        opacity="${hachures.opacity}" mask="url(#${isOcean ? "water" : "land"})" pointer-events="none"><path d="${path}"/></g>`);
    }
  }

  ensureEl("oceanHeights").innerHTML = oceanMarkup.join("");
  ensureEl("landHeights").innerHTML = landMarkup.join("");

  // connect vertices to chain: specific case for heightmap
  function connectVertices(
    cells: GridGraph["cells"],
    vertices: Vertices,
    start: number,
    h: number,
    used: Uint8Array
  ): number[] {
    const MAX_ITERATIONS = vertices.c.length;

    const n = cells.i.length;
    const chain: number[] = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < MAX_ITERATIONS); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter((c: number) => cells.h[c] === h).forEach((c: number) => {
        used[c] = 1;
      });
      const c0 = c[0] >= n || cells.h[c[0]] < h;
      const c1 = c[1] >= n || cells.h[c[1]] < h;
      const c2 = c[2] >= n || cells.h[c[2]] < h;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      // a hull half-edge has no opposite triangle, so `vertices.v` holds -1 for it
      if (current < 0 || current >= vertices.c.length) {
        log.error("Next vertex is out of bounds");
        break;
      }
      if (current === chain[chain.length - 1]) {
        log.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }

  function simplifyLine(chain: number[], simplification: number): number[] {
    if (!simplification) return chain;
    const n = simplification + 1; // filter each nth element
    return chain.filter((_d, i) => i % n === 0);
  }

  log.timeEnd("drawHeightmap");
};

/** heightmap preview image as a data URL: per-cell heights drawn over the grid raster */
export const drawHeights = ({
  heights: cellHeights,
  raster,
  scheme,
  renderOcean
}: {
  heights: Uint8Array<ArrayBufferLike>;
  raster: GridRaster;
  scheme: (value: number) => string;
  renderOcean: boolean;
}) => {
  const { width, height } = raster;
  const heights = Grid.rasterize(cellHeights, raster);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);

  const getHeight = (height: number) => (height < 20 ? (renderOcean ? height : 0) : height);

  for (let i = 0; i < heights.length; i++) {
    const colorScheme = scheme(1 - getHeight(heights[i]) / 100);
    const { r, g, b } = color(colorScheme)?.rgb() ?? { r: 0, g: 0, b: 0 };

    const n = i * 4;
    imageData.data[n] = r;
    imageData.data[n + 1] = g;
    imageData.data[n + 2] = b;
    imageData.data[n + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

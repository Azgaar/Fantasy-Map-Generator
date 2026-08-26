// The initial graph: a jittered square grid of points
import Alea from "alea";
import { min } from "d3";
import type { GridCells, GridGraph } from "@/types/GridGraph";
import type { Point } from "@/types/global";
import { ensureEl, rn, SEA_LEVEL } from "@/utils";
import { calculateVoronoi } from "./voronoi";

declare global {
  var Grid: GridModule;
}

class GridModule {
  generate(seed: string, width: number, height: number): GridGraph {
    Math.random = Alea(seed); // reset PRNG

    const cellsDesired = this.getCellsDesired();
    const spacing = this.getSpacing(cellsDesired, width, height);
    const boundary = this.getBoundaryPoints(width, height, spacing);

    TIME && console.time("placePoints");
    const points = this.getJitteredPoints(width, height, spacing);
    TIME && console.timeEnd("placePoints");

    const { cells, vertices } = calculateVoronoi(points, boundary);

    const graph = {
      seed,
      spacing,
      cellsDesired,
      cellsX: this.getCellsCount(spacing, width),
      cellsY: this.getCellsCount(spacing, height),
      boundary,
      points,
      cells,
      vertices
    } as GridGraph;
    this.resetHeights(graph);

    return graph;
  }

  /** check whether the graph still fits the requested seed and canvas size */
  shouldRegenerate(graph: GridGraph, expectedSeed: string | undefined, width: number, height: number): boolean {
    if (expectedSeed && expectedSeed !== graph.seed) return true;

    const cellsDesired = this.getCellsDesired();
    if (cellsDesired !== graph.cellsDesired) return true;

    const spacing = this.getSpacing(cellsDesired, width, height);
    if (graph.spacing !== spacing) return true;
    return graph.cellsX !== this.getCellsCount(spacing, width) || graph.cellsY !== this.getCellsCount(spacing, height);
  }

  /** make the global grid fit the requested seed and canvas size, keeping the current one if it does */
  prepare(expectedSeed?: string, precreated?: GridGraph): void {
    if (this.shouldRegenerate(grid, expectedSeed, graphWidth, graphHeight)) {
      grid = precreated ?? this.generate(seed, graphWidth, graphHeight);
    } else {
      this.resetHeights(grid);
    }
  }

  /**
   * rebuild the Voronoi diagram of a stored graph: saves keep only the points and the boundary,
   * cells and vertices are derived from them on load
   */
  rebuildGraph(graph: GridGraph): void {
    const { cells, vertices } = calculateVoronoi(graph.points, graph.boundary);
    graph.cells = cells as GridCells;
    graph.vertices = vertices;
    this.resetHeights(graph);
  }

  /** blank the heightmap, keeping the graph itself: the heightmap generator starts from an empty canvas */
  resetHeights(graph: GridGraph): void {
    graph.cells.h = new Uint8Array(graph.points.length);
  }

  /** number of cells requested by the user, the generated number is close but not equal to it */
  getCellsDesired(): number {
    return +(ensureEl<HTMLInputElement>("pointsInput").dataset.cells || 0);
  }

  /** cell index at the given coordinates, resolved by the regular square grid the points sit on */
  findCell(x: number, y: number, graph: GridGraph = grid): number {
    const { spacing, cellsX, cellsY } = graph;
    return Math.floor(Math.min(y / spacing, cellsY - 1)) * cellsX + Math.floor(Math.min(x / spacing, cellsX - 1));
  }

  /** cell indexes within the radius from the given coordinates */
  findAll(x: number, y: number, radius: number, graph: GridGraph = grid): number[] {
    const neighbors = graph.cells.c;
    const found = [this.findCell(x, y, graph)];
    let rings = Math.floor(radius / graph.spacing);
    if (!rings || radius === 1) return found;

    found.push(...neighbors[found[0]]);
    let frontier = neighbors[found[0]];
    while (rings > 1) {
      const next: number[] = [];
      for (const cellId of frontier) {
        for (const neighborId of neighbors[cellId]) {
          if (found.includes(neighborId)) continue;
          found.push(neighborId);
          next.push(neighborId);
        }
      }
      frontier = next;
      rings--;
    }

    return found;
  }

  /** cell polygon points */
  getPolygon(cellId: number, graph: GridGraph = grid): Point[] {
    return graph.cells.v[cellId].map(vertexId => graph.vertices.p[vertexId]);
  }

  /** distance between points before jittering */
  private getSpacing(cellsDesired: number, width: number, height: number): number {
    return rn(Math.sqrt((width * height) / cellsDesired), 2);
  }

  /** number of cells fitting the given map dimension */
  private getCellsCount(spacing: number, size: number): number {
    return Math.floor((size + 0.5 * spacing - 1e-10) / spacing);
  }

  /** pseudo-points along the map edge, they clip the outer Voronoi cells but get no cells of their own */
  private getBoundaryPoints(width: number, height: number, spacing: number): Point[] {
    const offset = rn(-1 * spacing);
    const bSpacing = spacing * 2;
    const w = width - offset * 2;
    const h = height - offset * 2;
    const numberX = Math.ceil(w / bSpacing) - 1;
    const numberY = Math.ceil(h / bSpacing) - 1;
    const points: Point[] = [];

    for (let i = 0.5; i < numberX; i++) {
      const x = Math.ceil((w * i) / numberX + offset);
      points.push([x, offset], [x, h + offset]);
    }

    for (let i = 0.5; i < numberY; i++) {
      const y = Math.ceil((h * i) / numberY + offset);
      points.push([offset, y], [w + offset, y]);
    }

    return points;
  }

  /** points of a square grid, each one randomly shifted within its square */
  private getJitteredPoints(width: number, height: number, spacing: number): Point[] {
    const radius = spacing / 2;
    const jittering = radius * 0.9;
    const doubleJittering = jittering * 2;
    const jitter = () => Math.random() * doubleJittering - jittering;

    const points: Point[] = [];
    for (let y = radius; y < height; y += spacing) {
      for (let x = radius; x < width; x += spacing) {
        points.push([Math.min(rn(x + jitter(), 2), width), Math.min(rn(y + jitter(), 2), height)]);
      }
    }
    return points;
  }

  /** turn depressions that cannot pour to water into lakes */
  addDeepDepressionLakes(): void {
    const elevationLimit = +ensureEl<HTMLOutputElement>("lakeElevationLimitOutput").value;
    if (elevationLimit === 80) return;

    const { cells, features } = grid;
    const { c, h, b } = cells;

    const addLake = (lakeCells: number[]) => {
      const featureId = features.length;

      for (const i of lakeCells) {
        cells.h[i] = 19;
        cells.t[i] = -1;
        cells.f[i] = featureId;

        for (const n of c[i]) {
          if (!lakeCells.includes(n)) cells.t[n] = 1; // the lake shore is a coastline now
        }
      }

      features.push({ i: featureId, land: false, border: false, type: "lake" });
    };

    for (const i of cells.i) {
      if (b[i] || h[i] < SEA_LEVEL) continue;
      if (h[i] > (min(c[i].map(neibId => h[neibId])) as number)) continue;

      let deep = true;
      const threshold = h[i] + elevationLimit;
      const queue = [i];
      const checked: boolean[] = [];
      checked[i] = true;

      // check if elevated cell can potentially pour to water
      while (deep && queue.length) {
        const q = queue.pop() as number;

        for (const n of c[q]) {
          if (checked[n]) continue;
          if (h[n] >= threshold) continue;
          if (h[n] < SEA_LEVEL) {
            deep = false;
            break;
          }

          checked[n] = true;
          queue.push(n);
        }
      }

      if (deep) addLake([i, ...c[i].filter(n => h[n] === h[i])]);
    }
  }

  /** near sea lakes get a lot of water inflow, most of them should break the threshold and flow out to sea (see Ancylus Lake) */
  openNearSeaLakes(): void {
    if (ensureEl<HTMLInputElement>("templateInput").value === "Atoll") return; // no need for Atolls

    const { cells, features } = grid;
    if (!features.find(f => f.type === "lake")) return; // no lakes
    const LIMIT = 22; // max height that can be breached by water

    const removeLake = (thresholdCellId: number, lakeFeatureId: number, oceanFeatureId: number) => {
      cells.h[thresholdCellId] = 19;
      cells.t[thresholdCellId] = -1;
      cells.f[thresholdCellId] = oceanFeatureId;
      for (const c of cells.c[thresholdCellId]) {
        if (cells.h[c] >= SEA_LEVEL) cells.t[c] = 1; // mark as coastline
      }

      for (const i of cells.i) {
        if (cells.f[i] === lakeFeatureId) cells.f[i] = oceanFeatureId;
      }
      features[lakeFeatureId].type = "ocean"; // mark former lake as ocean
    };

    for (const i of cells.i) {
      const lakeFeatureId = cells.f[i];
      if (features[lakeFeatureId].type !== "lake") continue; // not a lake

      check_neighbours: for (const c of cells.c[i]) {
        if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue; // water cannot break this

        for (const n of cells.c[c]) {
          const ocean = cells.f[n];
          if (features[ocean].type !== "ocean") continue; // not an ocean
          removeLake(c, lakeFeatureId, ocean);
          break check_neighbours;
        }
      }
    }
  }
}

window.Grid = new GridModule();

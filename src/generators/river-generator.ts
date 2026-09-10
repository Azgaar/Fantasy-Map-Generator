import Alea from "alea";
import { curveBasis, curveCatmullRom, line, mean } from "d3";
import { each, rn, round, rw } from "../utils";
import { meander, projectToNearestEdge } from "../utils/pathUtils";
import type { Label } from "./labels-generator";
import type { Point } from "./voronoi";

export const MIN_NAVIGABLE_FLUX = 100;

export interface River {
  i: number; // river id
  source: number; // source cell index
  mouth: number; // mouth cell index
  parent: number; // parent river id
  basin: number; // basin river id
  length: number; // river length
  discharge: number; // river discharge in m3/s
  width: number; // mouth width in km
  widthFactor: number; // width scaling factor
  sourceWidth: number; // source width in km
  name: string; // river name
  type: string; // river type
  cells: number[]; // cells forming the river path
  points?: Point[]; // river points (for meandering)
  label?: Label;
  note?: string;
}

class RiverModule {
  private FLUX_FACTOR = 500;
  private MAX_FLUX_WIDTH = 1;
  private LENGTH_FACTOR = 200;
  private LENGTH_STEP_WIDTH = 1 / this.LENGTH_FACTOR;
  private LENGTH_PROGRESSION = [1, 1, 2, 3, 5, 8, 13, 21, 34].map(n => n / this.LENGTH_FACTOR);
  private lineGen = line().curve(curveBasis);

  riverTypes = {
    main: {
      big: { River: 1 },
      small: { Creek: 9, River: 3, Brook: 3, Stream: 1 }
    },
    fork: {
      big: { Fork: 1 },
      small: { Branch: 1 }
    }
  };

  smallLength: number | null = null;

  regenerate(): void {
    this.generate();
    this.specify();
    Features.defineGroups();
    Lakes.defineNames();
  }

  addDownhill(initialCell: number): { error?: string } {
    const { cells, rivers } = pack;
    let cell = initialCell;
    const riverCells: number[] = [];
    let riverId = this.getNextId(rivers);
    let parent = riverId;

    cells.fl[cell] = grid.cells.prec[cells.g[cell]];
    const heights = this.alterHeights();
    this.resolveDepressions(heights);

    while (cell) {
      cells.r[cell] = riverId;
      riverCells.push(cell);

      const nextCell: number = cells.c[cell].sort((a, b) => heights[a] - heights[b])[0];
      if (heights[cell] <= heights[nextCell]) {
        return { error: `Cell ${cell} is depressed, river cannot flow further` };
      }

      if (heights[nextCell] < 20) {
        riverCells.push(nextCell);
        const feature = pack.features[cells.f[nextCell]];
        if (feature.type === "lake") {
          if (feature.outlet) parent = feature.outlet;
          if (feature.inlets) feature.inlets.push(riverId);
          else feature.inlets = [riverId];
        }
        break;
      }

      if (cells.b[nextCell]) {
        cells.fl[nextCell] += cells.fl[cell];
        riverCells.push(-1);
        break;
      }

      if (!cells.r[nextCell]) {
        cells.fl[nextCell] += cells.fl[cell];
        cell = nextCell;
        continue;
      }

      const oldRiverId = cells.r[nextCell];
      const oldRiver = rivers.find(river => river.i === oldRiverId);
      const oldRiverCells = oldRiver?.cells || cells.i.filter(cellId => cells.r[cellId] === oldRiverId);
      const oldRiverCellsUpper = oldRiverCells.filter(cellId => heights[cellId] > heights[nextCell]);

      if (riverCells.length <= oldRiverCellsUpper.length) {
        cells.conf[nextCell] += cells.fl[cell];
        riverCells.push(nextCell);
        parent = oldRiverId;
        break;
      }

      riverCells.forEach(riverCell => {
        cells.r[riverCell] = oldRiverId;
      });
      oldRiverCells.forEach(oldCell => {
        if (heights[oldCell] > heights[nextCell]) {
          cells.r[oldCell] = 0;
          cells.fl[oldCell] = grid.cells.prec[cells.g[oldCell]];
        } else {
          riverCells.push(oldCell);
          cells.fl[oldCell] += cells.fl[cell];
        }
      });
      riverId = oldRiverId;
      break;
    }

    const river = rivers.find(candidate => candidate.i === riverId);
    const source = riverCells[0];
    const mouth = riverCells[riverCells.length - 2];
    const defaultWidthFactor = rn(1 / (grid.points.length / 10000) ** 0.25, 2);
    const widthFactor =
      river?.widthFactor || (!parent || parent === riverId ? defaultWidthFactor * 1.2 : defaultWidthFactor);
    const sourceWidth = river?.sourceWidth || this.getSourceWidth(cells.fl[source]);
    const meanderedPoints = this.addMeandering(riverCells);
    const discharge = cells.fl[mouth];
    const length = this.getApproximateLength(meanderedPoints.map(([x, y]) => [x, y]));
    const width = this.getWidth(
      this.getOffset({ flux: discharge, pointIndex: meanderedPoints.length, widthFactor, startingWidth: sourceWidth })
    );

    if (river) {
      Object.assign(river, { source, length, discharge, width, cells: riverCells });
    } else {
      const basin = this.getBasin(parent);
      const name = this.getName(mouth);
      const type = this.getType({ i: riverId, length, parent } as River);
      rivers.push({
        i: riverId,
        source,
        mouth,
        discharge,
        length,
        width,
        widthFactor,
        sourceWidth,
        parent,
        cells: riverCells,
        basin,
        name,
        type
      });
    }

    return {};
  }

  generate(allowErosion = true) {
    Math.random = Alea(options.map.seed);
    const { cells, features } = pack;

    const riversData: { [riverId: number]: number[] } = {};
    const riverParents: { [key: number]: number } = {};

    const addCellToRiver = (cellId: number, riverId: number) => {
      if (!riversData[riverId]) riversData[riverId] = [cellId];
      else riversData[riverId].push(cellId);
    };

    // Accumulate in floats: per-cell rain is precipitation / cellsNumberModifier, which drops
    // below 1 at high density and truncates to nothing in the Uint16 flux array
    const flux = new Float64Array(cells.i.length);

    const drainWater = () => {
      const MIN_FLUX_TO_FORM_RIVER = 30;
      const cellsNumberModifier = (options.map.graph.points / 10000) ** 0.25;

      const prec = grid.cells.prec;
      const land = cells.i.filter((i: number) => h[i] >= 20).sort((a: number, b: number) => h[b] - h[a]);
      const lakeOutCells = Lakes.defineClimateData(h);

      // pre-compute map from outCell to qualifying lake features
      const outCellToLakes = new Map<number, any[]>();
      for (const feature of features) {
        if (feature.type !== "lake" || !feature.outCell) continue;
        if (!(feature.flux > feature.evaporation)) continue;
        const list = outCellToLakes.get(feature.outCell);
        if (list) list.push(feature);
        else outCellToLakes.set(feature.outCell, [feature]);
      }

      for (const i of land) {
        flux[i] += prec[cells.g[i]] / cellsNumberModifier; // add flux from precipitation

        // create lake outlet if lake is not in deep depression and flux > evaporation
        const lakes = (lakeOutCells[i] && outCellToLakes.get(i)) || [];
        for (const lake of lakes) {
          const lakeCell = cells.c[i].find((c: number) => h[c] < 20 && cells.f[c] === lake.i)!;
          flux[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

          // allow chain lakes to retain identity
          if (cells.r[lakeCell] !== lake.river) {
            const sameRiver = cells.c[lakeCell].some((c: number) => cells.r[c] === lake.river);

            if (sameRiver) {
              cells.r[lakeCell] = lake.river as number;
              addCellToRiver(lakeCell, lake.river as number);
            } else {
              cells.r[lakeCell] = riverNext;
              addCellToRiver(lakeCell, riverNext);
              riverNext++;
            }
          }

          lake.outlet = cells.r[lakeCell];
          flowDown(i, flux[lakeCell], lake.outlet);
        }

        // assign all tributary rivers to outlet basin
        const outlet = lakes[0]?.outlet;
        for (const lake of lakes) {
          if (!Array.isArray(lake.inlets)) continue;
          for (const inlet of lake.inlets) {
            riverParents[inlet] = outlet as number;
          }
        }

        // near-border cell: pour water out of the screen
        if (cells.b[i] && cells.r[i]) {
          addCellToRiver(-1, cells.r[i]);
          continue;
        }

        // downhill cell (make sure it's not in the source lake)
        let minCell = -1;
        if (lakeOutCells[i]) {
          const lakeIds = new Set(lakes.map((lake: any) => lake.i));
          let minH = Infinity;
          for (const c of cells.c[i]) {
            if (lakeIds.has(cells.f[c])) continue;
            if (h[c] < minH) {
              minH = h[c];
              minCell = c;
            }
          }
        } else if (cells.haven[i]) {
          minCell = cells.haven[i];
        } else {
          let minH = Infinity;
          for (const c of cells.c[i]) {
            if (h[c] < minH) {
              minH = h[c];
              minCell = c;
            }
          }
        }

        // cells is depressed
        if (minCell < 0 || h[i] <= h[minCell]) continue;

        if (flux[i] < MIN_FLUX_TO_FORM_RIVER) {
          // flux is too small to operate as a river
          if (h[minCell] >= 20) flux[minCell] += flux[i];
          continue;
        }

        // proclaim a new river
        if (!cells.r[i]) {
          cells.r[i] = riverNext;
          addCellToRiver(i, riverNext);
          riverNext++;
        }

        flowDown(minCell, flux[i], cells.r[i]);
      }
    };

    const flowDown = (toCell: number, fromFlux: number, river: number) => {
      const toFlux = flux[toCell] - cells.conf[toCell];
      const toRiver = cells.r[toCell];

      if (toRiver) {
        // downhill cell already has river assigned
        if (fromFlux > toFlux) {
          cells.conf[toCell] += flux[toCell]; // mark confluence
          if (h[toCell] >= 20) riverParents[toRiver] = river; // min river is a tributary of current river
          cells.r[toCell] = river; // re-assign river if downhill part has less flux
        } else {
          cells.conf[toCell] += fromFlux; // mark confluence
          if (h[toCell] >= 20) riverParents[river] = toRiver; // current river is a tributary of min river
        }
      } else cells.r[toCell] = river; // assign the river to the downhill cell

      if (h[toCell] < 20) {
        // pour water to the water body
        const waterBody = features[cells.f[toCell]];
        if (waterBody.type === "lake") {
          if (!waterBody.river || fromFlux > (waterBody.enteringFlux as number)) {
            waterBody.river = river;
            waterBody.enteringFlux = fromFlux;
          }
          waterBody.flux = waterBody.flux + fromFlux;
          if (!waterBody.inlets) waterBody.inlets = [river];
          else waterBody.inlets.push(river);
        }
      } else {
        // propagate flux and add next river segment
        flux[toCell] += fromFlux;
      }

      addCellToRiver(toCell, river);
    };

    const defineRivers = () => {
      // re-initialize rivers and confluence arrays
      cells.r = new Uint16Array(cells.i.length);
      cells.conf = new Uint16Array(cells.i.length);
      pack.rivers = [];

      const defaultWidthFactor = rn(1 / (options.map.graph.points / 10000) ** 0.25, 2);
      const mainStemWidthFactor = defaultWidthFactor * 1.2;

      for (const key in riversData) {
        const riverCells = riversData[key];
        if (riverCells.length < 3) continue; // exclude tiny rivers

        const riverId = +key;
        for (const cell of riverCells) {
          if (cell < 0 || cells.h[cell] < 20) continue;

          // mark real confluences and assign river to cells
          if (cells.r[cell]) cells.conf[cell] = 1;
          else cells.r[cell] = riverId;
        }

        const source = riverCells[0];
        const mouth = riverCells[riverCells.length - 2];
        const parent = riverParents[key] || 0;

        const widthFactor = !parent || parent === riverId ? mainStemWidthFactor : defaultWidthFactor;
        const meanderedPoints = this.addMeandering(riverCells);
        const discharge = cells.fl[mouth]; // m3 in second
        const length = this.getApproximateLength(meanderedPoints.map(([x, y]) => [x, y]));
        const sourceWidth = this.getSourceWidth(cells.fl[source]);
        const width = this.getWidth(
          this.getOffset({
            flux: discharge,
            pointIndex: meanderedPoints.length,
            widthFactor,
            startingWidth: sourceWidth
          })
        );

        pack.rivers.push({
          i: riverId,
          source,
          mouth,
          discharge,
          length,
          width,
          widthFactor,
          sourceWidth,
          parent,
          cells: riverCells
        } as River);
      }
    };

    const downcutRivers = () => {
      const MAX_DOWNCUT = 5;

      for (const i of pack.cells.i) {
        if (cells.h[i] < 35) continue; // don't donwcut lowlands
        if (!cells.fl[i]) continue;

        const higherCells = cells.c[i].filter((c: number) => cells.h[c] > cells.h[i]);
        const higherFlux = higherCells.reduce((acc: number, c: number) => acc + cells.fl[c], 0) / higherCells.length;
        if (!higherFlux) continue;

        const downcut = Math.floor(cells.fl[i] / higherFlux);
        if (downcut) cells.h[i] -= Math.min(downcut, MAX_DOWNCUT);
      }
    };

    const calculateConfluenceFlux = () => {
      for (const i of cells.i) {
        if (!cells.conf[i]) continue;

        const sortedInflux = cells.c[i]
          .filter((c: number) => cells.r[c] && h[c] > h[i])
          .map((c: number) => cells.fl[c])
          .sort((a: number, b: number) => b - a);
        cells.conf[i] = sortedInflux.reduce(
          (acc: number, flux: number, index: number) => (index ? acc + flux : acc),
          0
        );
      }
    };

    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1

    const h = this.alterHeights();
    Lakes.detectCloseLakes(h);
    this.resolveDepressions(h);
    drainWater();
    for (let i = 0; i < flux.length; i++) cells.fl[i] = Math.min(Math.round(flux[i]), 65535);
    defineRivers();

    calculateConfluenceFlux();
    Lakes.cleanupLakeData();

    if (allowErosion) {
      cells.h = Uint8Array.from(h); // apply gradient
      downcutRivers(); // downcut river beds
    }
  }

  alterHeights(): number[] {
    const { h, c, t } = pack.cells as {
      h: Uint8Array;
      c: number[][];
      t: Uint8Array;
    };
    return Array.from(h).map((h, i) => {
      if (h < 20 || t[i] < 1) return h;
      return h + t[i] / 100 + (mean(c[i].map(c => t[c])) as number) / 10000;
    });
  }

  // depression filling algorithm (for a correct water flux modeling)
  // Priority-flood (Barnes 2014): each land cell is processed in
  // monotonically non-decreasing height order from the lowest boundary
  // cell upward, and any neighbour below the current processing height
  // is raised to currentHeight + EPSILON, guaranteeing a descent path
  // from every interior cell to a boundary in one pass.
  resolveDepressions(h: number[]) {
    const { cells, features } = pack;
    const lakes = features.filter((feature: any) => feature?.type === "lake");

    const EPSILON = 0.1;
    const cellCount = cells.h.length;
    const processed = new Uint8Array(cellCount);
    const queue = new FlatQueue();

    // Seed: every water cell and every border cell at its current height.
    for (let i = 0; i < cellCount; i++) {
      if (h[i] < 20 || cells.b[i]) {
        queue.push(i, h[i]);
        processed[i] = 1;
      }
    }

    while (queue.length) {
      const currentHeight = queue.peekValue();
      const current = queue.pop();
      const neighbors = cells.c[current];
      for (let n = 0; n < neighbors.length; n++) {
        const next = neighbors[n];
        if (processed[next]) continue;
        processed[next] = 1;
        // Carve: ensure next is at least slightly above currentHeight
        // so flow descends from next → current.
        if (h[next] <= currentHeight) h[next] = currentHeight + EPSILON;
        queue.push(next, h[next]);
      }
    }

    // Resolve lake heights against the (now-monotonic) heights array.
    for (const l of lakes as any[]) {
      if (l.closed) continue;
      let minHeight = Infinity;
      for (let si = 0; si < l.shoreline.length; si++) {
        const sh = h[l.shoreline[si]];
        if (sh < minHeight) minHeight = sh;
      }
      if (minHeight === Infinity || minHeight >= 100) {
        l.closed = true;
        continue;
      }
      if (l.height > minHeight) continue;
      l.height = minHeight + 0.2;
    }
  }

  addMeandering(riverCells: number[], riverPoints: Point[] | null = null): [number, number, number][] {
    const { fl, h, p } = pack.cells;
    const { points, anchorIndices } = meander(riverCells, p, {
      anchors: riverPoints ?? undefined,
      meandering: 0.5,
      startStep: h[riverCells[0]] < 20 ? 1 : 10,
      isWaterCell: riverCells.map(c => c !== -1 && h[c] < 20),
      bounds: { width: options.map.graph.width, height: options.map.graph.height }
    });

    const flux: number[] = new Array(points.length).fill(0);
    anchorIndices.forEach((pointIndex, anchorIndex) => {
      const cellId = riverCells[anchorIndex];
      const fluxCell = cellId === -1 ? riverCells[anchorIndex - 1] : cellId;
      flux[pointIndex] = fl[fluxCell] || 0;
    });

    return points.map(([x, y], idx) => [x, y, flux[idx]]);
  }

  // anchor positions per river cell (cell centers, or override anchors), with -1 cells resolved to the map edge
  getRiverPoints(riverCells: number[], riverPoints: Point[] | null = null): Point[] {
    if (riverPoints) return riverPoints;

    const { p } = pack.cells;
    return riverCells.map((cell, i) => {
      if (cell === -1)
        return projectToNearestEdge(p[riverCells[i - 1]], options.map.graph.width, options.map.graph.height);
      return p[cell];
    });
  }

  getOffset({
    flux,
    pointIndex,
    widthFactor,
    startingWidth
  }: {
    flux: number;
    pointIndex: number;
    widthFactor: number;
    startingWidth: number;
  }) {
    if (pointIndex === 0) return startingWidth;

    const fluxWidth = Math.min(flux ** 0.7 / this.FLUX_FACTOR, this.MAX_FLUX_WIDTH);
    const lengthWidth =
      pointIndex * this.LENGTH_STEP_WIDTH +
      (this.LENGTH_PROGRESSION[pointIndex] || (this.LENGTH_PROGRESSION.at(-1) as number));
    return widthFactor * (lengthWidth + fluxWidth) + startingWidth;
  }

  getSourceWidth(flux: number) {
    return rn(Math.min(flux ** 0.9 / this.FLUX_FACTOR, this.MAX_FLUX_WIDTH), 2);
  }

  // build polygon from a list of points and calculated offset (width)
  getRiverPath(points: [number, number, number][], widthFactor: number, startingWidth: number) {
    this.lineGen.curve(curveCatmullRom.alpha(0.1));
    const riverPointsLeft: [number, number][] = [];
    const riverPointsRight: [number, number][] = [];
    let flux = 0;

    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const [x0, y0] = points[pointIndex - 1] || points[pointIndex];
      const [x1, y1, pointFlux] = points[pointIndex];
      const [x2, y2] = points[pointIndex + 1] || points[pointIndex];
      if (pointFlux > flux) flux = pointFlux;

      const offset = this.getOffset({
        flux,
        pointIndex,
        widthFactor,
        startingWidth
      });
      const angle = Math.atan2(y0 - y2, x0 - x2);
      const sinOffset = Math.sin(angle) * offset;
      const cosOffset = Math.cos(angle) * offset;

      riverPointsLeft.push([x1 - sinOffset, y1 + cosOffset]);
      riverPointsRight.push([x1 + sinOffset, y1 - cosOffset]);
    }

    const right = this.lineGen(riverPointsRight.reverse());
    let left = this.lineGen(riverPointsLeft) || "";
    left = left.substring(left.indexOf("C"));

    return round(right + left, 1);
  }

  specify() {
    const rivers = pack.rivers;
    if (!rivers.length) return;

    for (const river of rivers) {
      river.parent = this.getParent(river.i);
      river.basin = this.getBasin(river.i);
      river.name = this.getName(river.mouth);
      river.type = this.getType(river);
    }
  }

  getName(cell: number) {
    return Names.getCulture(pack.cells.culture[cell]);
  }

  getType({ i, length, parent }: River) {
    if (this.smallLength === null) {
      const threshold = Math.ceil(pack.rivers.length * 0.15);
      this.smallLength = pack.rivers.map(r => r.length || 0).sort((a: number, b: number) => a - b)[threshold];
    }

    const isSmall: boolean = length < (this.smallLength as number);
    const isFork = each(3)(i) && parent && parent !== i;
    return rw(this.riverTypes[isFork ? "fork" : "main"][isSmall ? "small" : "big"]);
  }

  getApproximateLength(points: Point[] = []) {
    const length = points.reduce((s, v, i, p) => s + (i ? Math.hypot(v[0] - p[i - 1][0], v[1] - p[i - 1][1]) : 0), 0);
    return rn(length, 2);
  }

  // Real mouth width examples: Amazon 6000m, Volga 6000m, Dniepr 3000m, Mississippi 1300m, Themes 900m,
  // Danube 800m, Daugava 600m, Neva 500m, Nile 450m, Don 400m, Wisla 300m, Pripyat 150m, Bug 140m, Muchavets 40m
  getWidth(offset: number) {
    return rn((offset / 1.5) ** 1.8, 2); // mouth width in km
  }

  // remove river and all its tributaries
  remove(id: number) {
    const cells = pack.cells;
    const riversToRemove = pack.rivers.filter(r => r.i === id || r.parent === id || r.basin === id).map(r => r.i);
    cells.r.forEach((r, i) => {
      if (!r || !riversToRemove.includes(r)) return;
      cells.r[i] = 0;
      cells.fl[i] = grid.cells.prec[cells.g[i]];
      cells.conf[i] = 0;
    });
    pack.rivers = pack.rivers.filter(r => !riversToRemove.includes(r.i));
  }

  private riverIndex: Map<number, River> | null = null;
  private riverIndexFor: River[] | null = null;

  private getRiverIndex(): Map<number, River> {
    if (this.riverIndex && this.riverIndexFor === pack.rivers && this.riverIndex.size === pack.rivers.length) {
      return this.riverIndex;
    }
    const m = new Map<number, River>();
    for (const r of pack.rivers) m.set(r.i, r);
    this.riverIndex = m;
    this.riverIndexFor = pack.rivers;
    return m;
  }

  getParent(r: number): number {
    const idx = this.getRiverIndex();
    const parent = idx.get(r)?.parent;
    if (!parent || parent === r) return r;
    if (!idx.has(parent)) return r;
    return parent;
  }

  getBasin(r: number): number {
    const idx = this.getRiverIndex();
    let current = r;
    // Iterative walk with cycle bound (defensive). Max depth = number of rivers.
    for (let step = 0; step <= idx.size; step++) {
      const parent = idx.get(current)?.parent;
      if (!parent || parent === current) return current;
      if (!idx.has(parent)) return current;
      current = parent;
    }
    return current;
  }

  getNextId(rivers: { i: number }[]) {
    if (!rivers.length) return 1;
    let maxId = 0;
    for (let i = 0; i < rivers.length; i++) {
      if (rivers[i].i > maxId) maxId = rivers[i].i;
    }
    return maxId + 1;
  }

  isNavigable(cellId: number): boolean {
    const { r, fl } = pack.cells;
    return Boolean(r[cellId]) && fl[cellId] >= MIN_NAVIGABLE_FLUX;
  }

  // Walk an outlet chain starting from a lake feature
  resolveLakeDrainFeature(lakeFeatureId: number): number | null {
    const { features, rivers, cells } = pack;
    const lake = features[lakeFeatureId];
    if (lake?.type !== "lake") return null;
    if (!lake.outlet) return lakeFeatureId; // closed lake: return itself

    const riverById = new Map(rivers.map(r => [r.i, r]));
    const visited = new Set<number>();
    let river = riverById.get(lake.outlet);
    while (river && !visited.has(river.i)) {
      visited.add(river.i);
      const lastCell = river.cells[river.cells.length - 1];
      if (lastCell < 0) return null; // outlet exits the map

      const feature = features[cells.f[lastCell]];
      if (!feature) return null;
      if (feature.type === "ocean") return feature.i;
      if (feature.type !== "lake") return null;
      if (!feature.outlet) return feature.i; // closed downstream lake
      river = riverById.get(feature.outlet);
    }
    return null;
  }

  // Walk a river chain downstream through lakes until we reach the final receiving body
  resolveDrainFeature(cellId: number): number | null {
    const { cells, features, rivers } = pack;
    const startRiver = cells.r[cellId];
    if (!startRiver) return null;

    const riverById = new Map(rivers.map(r => [r.i, r]));
    let river = riverById.get(startRiver);
    const visited = new Set<number>();
    while (river && !visited.has(river.i)) {
      visited.add(river.i);
      const lastCell = river.cells[river.cells.length - 1];
      if (lastCell < 0) return null; // off-map exit

      const feature = features[cells.f[lastCell]];
      if (!feature) return null;
      if (feature.type === "ocean") return feature.i;
      if (feature.type !== "lake") return null;

      if (!feature.outlet) return feature.i; // closed lake terminus
      river = riverById.get(feature.outlet);
    }
    return null;
  }
}

declare global {
  var Rivers: RiverModule;
}

window.Rivers = new RiverModule();

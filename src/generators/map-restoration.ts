// Carries a map's data over to a rebuilt graph: every stored cell id is found again by its position
import { quadtree } from "d3";
import { clipPolyline } from "lineclip";
import type { Point } from "@/types/global";
import type { JourneyPoint } from "@/types/Journey";
import type { PackedGraph, TypedArray } from "@/types/PackedGraph";
import { getPolesOfInaccessibility, isWater, rn } from "@/utils";
import type { Burg } from "./burgs-generator";
import { GraphOverride } from "./graph-override";
import type { Label } from "./labels-generator";
import type { Regiment } from "./military-generator";
import type { LockedRiver, River } from "./river-generator";

type Projection = (x: number, y: number) => Point;

interface MapSnapshot {
  pack: PackedGraph;
  spacing: number; // grid cell spacing of the snapshot map
  riverAnchors: Point[][]; // one point per river cell, by index in pack.rivers
}

interface RestoreOptions {
  projection?: Projection; // snapshot coordinates to current ones
  inverse?: Projection; // current coordinates to snapshot ones
  scale?: number; // linear scale of the projection
  rivers: "restore" | "generate"; // carry the snapshot rivers over, or generate them for the new graph around the locked ones
  previousHeights?: Uint8Array; // the grid heights the snapshot was built on, when the grid is the same
}

interface CellLinks {
  under: Int32Array; // snapshot cell at each cell's position
  sameType: Int32Array; // closest snapshot cell of the same land or water type nearby, -1 if none
}

const identity: Projection = (x, y) => [x, y];
const LINK_RADIUS = 2; // in snapshot cell spacings: how far a cell looks for a parent of its own type

class MapRestorationModule {
  /**
   * Rebuild a map for new grid heights and carry its data over (the Risk heightmap edit). Land under a burg is not
   * sunk. Water erosion generates the rivers anew around the locked ones, else the rivers are kept
   */
  applyHeights(heights: Uint8Array, { erosion }: { erosion: boolean }): void {
    this.transaction(() => {
      for (const burg of pack.burgs) {
        if (!burg.i || burg.removed) continue;
        const gridCell = pack.cells.g[burg.cell];
        if (heights[gridCell] < 20) heights[gridCell] = 20;
      }

      const snapshot = this.snapshot();
      const previousHeights = grid.cells.h;
      pack = { ...pack }; // the new map is built aside, the old one is kept for a rollback
      grid.cells.h = heights;
      Features.markupGrid();
      if (erosion) Grid.addDeepDepressionLakes();
      Temperature.generate();
      Precipitation.generate();
      Pack.generate();
      Features.markupPack();
      GraphOverride.restore(); // re-apply the user's vertex edits that still fit the new graph
      // without erosion the untouched land keeps the valleys generation carved; erosion carves them anew
      this.restore(snapshot, {
        rivers: erosion ? "generate" : "restore",
        previousHeights: erosion ? undefined : previousHeights
      });
      Ice.generate();
    });
  }

  /**
   * Run a rebuild of the map; if it throws, the map is put back as it was and the error rethrown.
   * The rebuild must assign a new `pack` object rather than change the old one, as `applyHeights` and Resample do
   */
  transaction(rebuild: () => void): void {
    const { h, t, f, temp, prec } = grid.cells;
    const saved = {
      grid,
      gridData: structuredClone({ h, t, f, temp, prec, features: grid.features }),
      pack,
      map: structuredClone(options.map),
      density: options.generation.graph.density,
      overrides: GraphOverride.state
    };

    try {
      rebuild();
    } catch (error) {
      const { features, ...cells } = saved.gridData;
      grid = saved.grid;
      Object.assign(grid.cells, cells);
      grid.features = features;
      pack = saved.pack;
      options.map = saved.map;
      options.generation.graph.density = saved.density;
      GraphOverride.adopt(saved.overrides);
      Routes.sync();
      Markets.sync();
      Goods.sync();
      throw error;
    }
  }

  /** capture the map before its graph is rebuilt */
  snapshot(): MapSnapshot {
    const { p } = pack.cells;
    // a damaged map can hold ids beyond its graph: such a river cannot be followed and is dropped
    const riverAnchors = pack.rivers.map(river =>
      river.points || river.cells.every(cell => cell === -1 || p[cell])
        ? Rivers.getRiverPoints(river.cells, river.points ?? null)
        : []
    );
    return { pack: structuredClone(pack), spacing: grid.spacing, riverAnchors };
  }

  /** restore the snapshot data onto the current graph, already built and marked up */
  restore(
    snapshot: MapSnapshot,
    { projection = identity, inverse = identity, scale = 1, rivers, previousHeights }: RestoreOptions
  ) {
    const parent = snapshot.pack;
    const links = this.linkCells(parent, inverse, snapshot.spacing * LINK_RADIUS);
    if (previousHeights) this.restoreHeights(parent, links, previousHeights);

    if (rivers === "restore") this.restoreRivers(snapshot, links, projection, scale);
    else Rivers.generate(true, this.restoreLockedRivers(snapshot, links, projection, scale));
    this.restoreCells(parent, links, scale);
    const features = this.restoreFeatures(parent, links, rivers === "restore");
    this.restoreRelief(parent, links, projection);
    this.restoreCultures(parent, projection);
    this.restoreBurgs(parent, projection, scale);
    this.restoreStates(parent, projection);
    this.restoreProvinces(parent, projection);
    States.findNeighbors();
    States.collectStatistics();
    this.restoreReligions(parent, projection);
    this.restoreRoutes(parent, projection, features);
    this.restoreMarkers(parent, projection);
    this.restoreZones(parent, links);
    this.restoreJourneys(parent, projection);
    this.restoreAddedLabels(parent, projection);
    if (rivers === "generate") {
      Rivers.specify();
      this.restoreRiverData(parent, links, projection);
    }
    Features.defineNames();
    this.restoreEconomy(parent);
  }

  private linkCells(parent: PackedGraph, inverse: Projection, radius: number): CellLinks {
    type Entry = [number, number, number];
    const all: Entry[] = [];
    const land: Entry[] = [];
    const water: Entry[] = [];
    parent.cells.p.forEach(([x, y], cell) => {
      all.push([x, y, cell]);
      (isWater(cell, parent) ? water : land).push([x, y, cell]);
    });
    const [allTree, landTree, waterTree] = [all, land, water].map(entries => quadtree<Entry>(entries));

    const n = pack.cells.i.length;
    const under = new Int32Array(n).fill(-1);
    const sameType = new Int32Array(n).fill(-1);
    for (let cell = 0; cell < n; cell++) {
      const [x, y] = inverse(...pack.cells.p[cell]);
      under[cell] = allTree.find(x, y)?.[2] ?? -1;
      sameType[cell] = (isWater(cell, pack) ? waterTree : landTree).find(x, y, radius)?.[2] ?? -1;
    }
    return { under, sameType };
  }

  private isInMap(x: number, y: number) {
    return x >= 0 && x <= options.map.graph.width && y >= 0 && y <= options.map.graph.height;
  }

  private findCell(x: number, y: number): number {
    return Pack.findCell(x, y, Infinity)!;
  }

  /** the projected center of a snapshot cell; none for an id a damaged map holds beyond its graph */
  private projectPoint(parent: PackedGraph, cell: number | undefined, projection: Projection) {
    const point = cell === undefined ? undefined : parent.cells.p[cell];
    return point && projection(...point);
  }

  /** a path point keeps its path cell while it is under or next to the point, else takes the cell under it */
  private findPathCell(parent: PackedGraph, projection: Projection, cell: number, x: number, y: number): number {
    const under = this.findCell(x, y);
    const point = this.projectPoint(parent, cell, projection);
    const projected = point && this.findCell(...point);
    return projected === under || pack.cells.c[under].includes(projected!) ? projected! : under;
  }

  /**
   * Consecutive path cells must be neighbors, for the links and pathfinding along them. A gap left by the new graph
   * is filled with the cells a walk toward the next cell crosses, each placed on the line between the two points where
   * that line passes it, so the path is drawn as before
   */
  private fillPathGaps(points: [number, number, number][]): [number, number, number][] {
    const { c, p } = pack.cells;
    const filled = [points[0]];
    for (let k = 1; k < points.length; k++) {
      const [x0, y0, from] = points[k - 1];
      const [x1, y1, to] = points[k];
      const [dx, dy] = [x1 - x0, y1 - y0];
      let t = 0;
      for (const cell of this.findCellsBetween(from, to)) {
        // where the cell is nearest the line, never back along it
        t = Math.max(t, Math.min(1, ((p[cell][0] - x0) * dx + (p[cell][1] - y0) * dy) / (dx * dx + dy * dy || 1)));
        const [x, y] = [rn(x0 + t * dx, 2), rn(y0 + t * dy, 2)];
        const under = this.findCell(x, y);
        filled.push(under === cell || c[cell].includes(under) ? [x, y, cell] : [...p[cell], cell]);
      }
      filled.push(points[k]);
    }
    return filled;
  }

  /** the cells between two cells, none if they are neighbors: a greedy walk toward the target, else a search */
  private findCellsBetween(from: number, to: number): number[] {
    const { c, p } = pack.cells;
    const reached = (cell: number) => cell === to || c[cell].includes(to);
    const toTarget = (cell: number) => (p[cell][0] - p[to][0]) ** 2 + (p[cell][1] - p[to][1]) ** 2;

    const walk: number[] = [];
    let cell = from;
    while (!reached(cell)) {
      const next = c[cell].reduce((best, neighbor) => (toTarget(neighbor) < toTarget(best) ? neighbor : best));
      if (toTarget(next) >= toTarget(cell)) break; // stuck at the map edge, where the graph has no boundary points
      cell = next;
      walk.push(cell);
    }
    if (reached(cell)) return walk;

    const previous = new Map<number, number>([[cell, -1]]);
    for (let queue = [cell]; queue.length && !reached(queue[0]); queue.shift()) {
      for (const neighbor of c[queue[0]]) {
        if (previous.has(neighbor)) continue;
        previous.set(neighbor, queue[0]);
        queue.push(neighbor);
      }
    }
    const last = [...previous.keys()].find(reached);
    if (last === undefined) return walk; // another part of the graph: the gap stays
    const search: number[] = [];
    for (let step = last; step !== cell; step = previous.get(step)!) search.unshift(step);
    return [...walk, ...search];
  }

  /** the cell at an entity's pole if it is the entity's, else its first cell */
  private findPoleCell(owner: TypedArray, id: number, pole?: Point): number {
    const cell = pole && this.findCell(...pole);
    return cell !== undefined && owner[cell] === id ? cell : owner.indexOf(id);
  }

  /** an entity without a capital keeps its center while the cell is still its own, else it moves to the pole */
  private keepCenter(
    parent: PackedGraph,
    projection: Projection,
    center: number,
    owner: TypedArray,
    id: number,
    pole?: Point
  ) {
    const point = this.projectPoint(parent, center, projection);
    const cell = point && this.isInMap(...point) ? this.findCell(...point) : -1;
    return cell !== -1 && owner[cell] === id ? cell : this.findPoleCell(owner, id, pole);
  }

  /** a culture or religion keeps its origin while it is land on the map, else it moves to the pole */
  private findOrigin(parent: PackedGraph, projection: Projection, center: number | undefined, pole: () => number) {
    const point = this.projectPoint(parent, center, projection);
    if (!point || !this.isInMap(...point)) return pole();
    const [x, y] = point;
    const cell = this.findCell(x, y);
    return isWater(cell, pack) ? pole() : cell;
  }

  /** a custom label path and offset follow the projection, a default label stays default */
  private projectLabel<T extends { label?: Label }>(entity: T, projection: Projection): T {
    const { label } = entity;
    if (!label || projection === identity) return entity;
    const round = ([x, y]: [number, number]): Point => [rn(x, 2), rn(y, 2)];
    const projected = { ...label };
    if (label.pathPoints) projected.pathPoints = label.pathPoints.map(point => round(projection(...point)));
    if (label.dx !== undefined || label.dy !== undefined) {
      // an offset is a vector: only the linear part of the projection applies
      const [x0, y0] = projection(0, 0);
      const [x, y] = projection(label.dx ?? 0, label.dy ?? 0);
      const [dx, dy] = round([x - x0, y - y0]);
      if (label.dx !== undefined || dx) projected.dx = dx;
      if (label.dy !== undefined || dy) projected.dy = dy;
    }
    return { ...entity, label: projected };
  }

  /** a snapshot river on the current graph, its course found again by its anchors; none if it is not on the map */
  private projectRiver(snapshot: MapSnapshot, index: number, projection: Projection, scale: number): River | null {
    const river = snapshot.pack.rivers[index];
    const points: Point[] = [];
    const cells: number[] = [];
    let wasInMap = true;
    snapshot.riverAnchors[index].forEach((anchor, k) => {
      const [x, y] = projection(...anchor).map(value => rn(value, 2));
      const inMap = this.isInMap(x, y);
      if (inMap || wasInMap) {
        points.push([x, y]);
        // a river leaving the map ends with -1, as when it is generated
        const offMap = river.cells[k] === -1 || (!inMap && points.length > 1);
        cells.push(offMap ? -1 : this.findCell(x, y));
      }
      wasInMap = inMap;
    });
    if (points.length < 2) return null;

    const widthFactor = river.widthFactor * scale;
    const restored = { ...river, cells, points, source: cells[0], mouth: cells.at(-2)!, widthFactor };
    return this.projectLabel(restored, projection);
  }

  /** a cell whose grid height was not changed keeps the height the snapshot cell at its place had, erosion included */
  private restoreHeights(parent: PackedGraph, links: CellLinks, previousHeights: Uint8Array) {
    const { cells } = pack;
    for (let cell = 0; cell < cells.i.length; cell++) {
      const [under, gridCell] = [links.under[cell], cells.g[cell]];
      if (under === -1 || parent.cells.g[under] !== gridCell) continue;
      if (grid.cells.h[gridCell] !== previousHeights[gridCell]) continue;
      if (isWater(cell, pack) !== isWater(under, parent)) continue;
      cells.h[cell] = parent.cells.h[under];
    }
  }

  /** rivers keep their course, cells take the flux and confluences of the snapshot cells under them */
  private restoreRivers(snapshot: MapSnapshot, links: CellLinks, projection: Projection, scale: number) {
    const { cells } = pack;
    const n = cells.i.length;
    cells.r = new Uint16Array(n);
    cells.conf = new Uint16Array(n); // confluence flux, as generation stores it
    cells.fl = new Uint16Array(n);
    for (let cell = 0; cell < n; cell++) {
      const source = links.sameType[cell];
      if (source !== -1) cells.fl[cell] = snapshot.pack.cells.fl[source];
    }

    pack.rivers = snapshot.pack.rivers.flatMap((_, index) => {
      const projected = this.projectRiver(snapshot, index, projection, scale);
      return (projected && this.cutAtSea(projected)) ?? [];
    });
    for (const river of pack.rivers) {
      for (const cell of river.cells) {
        if (cell < 0 || isWater(cell, pack)) continue;
        // a confluence keeps the flux it had, which settlement ranking reads
        if (cells.r[cell] && cells.r[cell] !== river.i) {
          const source = links.sameType[cell];
          cells.conf[cell] = source === -1 ? 1 : snapshot.pack.cells.conf[source];
        } else cells.r[cell] = river.i;
      }
    }

    for (const river of pack.rivers) {
      river.parent = Rivers.getParent(river.i);
      river.basin = Rivers.getBasin(river.i);
      river.length = Rivers.getApproximateLength(Rivers.addMeandering(river.cells, river.points) as unknown as Point[]);
    }
  }

  /** locked rivers keep their course on the new graph, ending where it now runs into the sea */
  private restoreLockedRivers(snapshot: MapSnapshot, links: CellLinks, projection: Projection, scale: number) {
    return snapshot.pack.rivers.flatMap((river, index): LockedRiver[] => {
      if (!river.lock) return [];
      const projected = this.projectRiver(snapshot, index, projection, scale);
      const restored = projected && this.cutAtSea(projected);
      if (!restored) {
        WARN && console.warn(`Locked river ${river.name} (${river.i}) has no land left on the map and is removed`);
        return [];
      }

      const flux = restored.cells.map(cell => {
        const source = cell >= 0 && !isWater(cell, pack) ? links.sameType[cell] : -1;
        return source === -1 ? 0 : snapshot.pack.cells.fl[source];
      });
      return [{ river: restored, flux }];
    });
  }

  /** a river starts where its course is no longer under the sea and ends where it reaches it; none if no land is left */
  private cutAtSea(river: River): River | null {
    const { cells, features } = pack;
    const isOcean = (cell: number) => cell >= 0 && features[cells.f[cell]]?.type === "ocean";
    const start = river.cells.findIndex(cell => !isOcean(cell));
    if (start === -1) return null;
    const end = river.cells.findIndex((cell, k) => k > start && isOcean(cell));
    const range = [start, end === -1 ? undefined : end + 1] as const;
    const riverCells = river.cells.slice(...range);
    if (riverCells.length < 2 || !riverCells.some(cell => cell >= 0 && !isWater(cell, pack))) return null;
    const points = river.points?.slice(...range);
    return { ...river, cells: riverCells, points, source: riverCells[0], mouth: riverCells.at(-2)! };
  }

  private restoreCells(parent: PackedGraph, links: CellLinks, scale: number) {
    const { cells } = pack;
    const n = cells.i.length;
    const from = parent.cells;

    pack.biomes = parent.biomes;
    cells.biome = new Uint8Array(n);
    cells.s = new Int16Array(n);
    cells.pop = new Float32Array(n);
    cells.culture = new Uint16Array(n);
    cells.state = new Uint16Array(n);
    cells.burg = new Uint16Array(n);
    cells.religion = new Uint16Array(n);
    cells.province = new Uint16Array(n);
    cells.good = new Uint16Array(n);

    for (let cell = 0; cell < n; cell++) {
      const source = links.sameType[cell];
      if (source !== -1) cells.good[cell] = from.good[source]; // goods sit on water too (fish)
      if (isWater(cell, pack)) continue;

      if (source === -1) {
        const gridCell = cells.g[cell];
        const { prec, temp } = grid.cells;
        cells.biome[cell] = Biomes.getId(prec[gridCell], temp[gridCell], cells.h[cell], Boolean(cells.r[cell]));
        continue;
      }

      // tiny boundary cells may store a zero area
      const ratio = cells.area[cell] / (from.area[source] || 1) / scale;
      cells.biome[cell] = from.biome[source];
      cells.s[cell] = from.s[source] * ratio;
      cells.pop[cell] = from.pop[source] * ratio;
      cells.culture[cell] = from.culture[source];
      cells.state[cell] = from.state[source];
      cells.religion[cell] = from.religion[source];
      cells.province[cell] = from.province[source];
    }
  }

  /** a new feature takes the user data of the old one of its type it mostly covers or lies on. Returns old -> new ids */
  private restoreFeatures(parent: PackedGraph, links: CellLinks, keepHydrology: boolean): Map<number, number> {
    Features.defineGroups();
    const { cells, features } = pack;
    const overlaps = countOverlaps(
      cells.i.length,
      cell => cells.f[cell],
      cell => parent.cells.f[links.under[cell]]
    );
    const featureIds = matchOverlaps(overlaps, (featureId, oldFeatureId) => {
      const [feature, old] = [features[featureId], parent.features[oldFeatureId]];
      return Boolean(feature && old && feature.type === old.type); // a lake raised to land is not the island covering it
    });

    const riverIds = new Set(pack.rivers.map(river => river.i));
    for (const [oldFeatureId, featureId] of featureIds) {
      const feature = features[featureId];
      const old = parent.features[oldFeatureId];
      const { name, note, coastline, tags, subtype, group } = old;
      if (name) feature.name = name;
      if (note) feature.note = note;
      if (coastline) feature.coastline = coastline;
      if (tags) feature.tags = [...tags];
      // a lake on kept rivers keeps the rivers flowing in and out, which ports trade by
      if (keepHydrology && feature.type === "lake") {
        const inlets = old.inlets?.filter(id => riverIds.has(id));
        if (inlets?.length) feature.inlets = inlets;
        if (old.outlet && riverIds.has(old.outlet)) feature.outlet = old.outlet;
        Object.assign(feature, { flux: old.flux, evaporation: old.evaporation, temp: old.temp });
      }
      // a lake island is defined by the heightmap, not chosen
      if (subtype && subtype !== "lake_island" && feature.subtype !== "lake_island") {
        feature.subtype = subtype;
        if (group) feature.group = group;
      }
    }
    return featureIds;
  }

  /** a generated river takes the user data of the old river whose course it mostly follows or lies on, locked ones keep theirs */
  private restoreRiverData(parent: PackedGraph, links: CellLinks, projection: Projection) {
    const { r } = pack.cells;
    const overlaps = countOverlaps(
      r.length,
      cell => r[cell],
      cell => parent.cells.r[links.under[cell]]
    );
    const oldRivers = new Map(parent.rivers.map(river => [river.i, river]));
    const locked = new Set(pack.rivers.filter(river => river.lock).map(river => river.i)); // they keep their own data
    const generated = (id: number, oldId: number) => !locked.has(id) && !oldRivers.get(oldId)?.lock;
    const matched = new Map([...matchOverlaps(overlaps, generated)].map(([oldId, id]) => [id, oldRivers.get(oldId)]));

    pack.rivers = pack.rivers.map(river => {
      const old = matched.get(river.i);
      if (!old) return river;
      const { name, type, note, tags, label } = old;
      const restored = { ...river, name, type, ...(note && { note }), ...(tags && { tags }), ...(label && { label }) };
      return this.projectLabel(restored, projection);
    });
  }

  /** icons stay where they are, except where land went under the sea; land raised from the sea gets relief placed */
  private restoreRelief(parent: PackedGraph, links: CellLinks, projection: Projection) {
    if (!parent.relief?.length) {
      pack.relief = []; // never drawn yet: all of it is placed on the first draw
      return;
    }

    const marine = Object.keys(parent.biomes[0]?.icons ?? {});
    pack.relief = parent.relief.flatMap(icon => {
      const [centerX, centerY] = [icon.x + icon.s / 2, icon.y + icon.s / 2];
      const [x, y] = projection(centerX, centerY);
      if (!this.isInMap(x, y)) return [];
      const sunk =
        isWater(this.findCell(x, y), pack) && !isWater(Pack.findCell(centerX, centerY, Infinity, parent)!, parent);
      if (sunk && !marine.includes("type" in icon ? icon.type : icon.icon)) return [];
      return [{ ...icon, x: rn(x - icon.s / 2, 2), y: rn(y - icon.s / 2, 2) }];
    });
    Relief.regenerate(cell => {
      const under = links.under[cell];
      return !isWater(cell, pack) && under !== -1 && isWater(under, parent);
    });
  }

  private restoreCultures(parent: PackedGraph, projection: Projection) {
    const { culture } = pack.cells;
    const present = new Set(culture);
    const poles = getPolesOfInaccessibility(pack, cell => culture[cell]);
    pack.cultures = parent.cultures.map(item => {
      if (!item.i || item.removed) return item;
      if (!present.has(item.i)) return { ...item, removed: true, lock: false };
      const center = this.findOrigin(parent, projection, item.center, () =>
        this.findPoleCell(culture, item.i, poles[item.i])
      );
      return { ...item, center };
    });
  }

  /** a burg keeps its place or moves to the closest free land cell, capitals choose first. Removed if no land is left */
  private restoreBurgs(parent: PackedGraph, projection: Projection, scale: number) {
    const { cells } = pack;
    const findLandCell = createAvailableLandCellFinder(cells);
    const living = parent.burgs.filter(burg => burg.i && !burg.removed);
    const byCapitalsFirst = [...living.filter(burg => burg.capital), ...living.filter(burg => !burg.capital)];
    const placed = new Map<number, number>(); // burg -> cell
    for (const burg of byCapitalsFirst) {
      const [x, y] = projection(burg.x, burg.y).map(value => rn(value, 2));
      // a port can lie just off the map edge: its cell decides whether the burg is still on the map
      const home = this.projectPoint(parent, burg.cell, projection) ?? [x, y];
      const cell = this.isInMap(...home) ? findLandCell(x, y) : undefined;
      if (cell !== undefined) placed.set(burg.i, cell);
    }

    pack.burgs = parent.burgs.map(burg => {
      if (!burg.i || burg.removed) return burg;
      const cell = placed.get(burg.i);
      if (cell === undefined) {
        WARN && console.warn(`Burg ${burg.name} (${burg.i}) has no land left on the map and is removed`);
        return { ...burg, removed: true, lock: false, capital: 0 };
      }

      cells.burg[cell] = burg.i;
      const [x, y] = projection(burg.x, burg.y).map(value => rn(value, 2));
      const haven = cells.haven[cell];
      const moved = this.findCell(x, y) !== cell;
      const [bx, by] = !moved ? [x, y] : burg.port && haven ? this.getEdgePoint(cell, haven) : cells.p[cell];
      const port = burg.port ? Burgs.getPortWater(cell) : burg.port;
      const population = burg.population! * scale;
      const restored = { ...burg, cell, x: bx, y: by, feature: cells.f[cell], port, population };
      // a custom layout no longer fits a burg that moved, as when it is moved by hand
      if (moved && burg.label) return { ...restored, label: { ...burg.label, dx: 0, dy: 0, pathPoints: undefined } };
      return this.projectLabel(restored, projection);
    });
  }

  private getEdgePoint(cell: number, neighbor: number): Point {
    const { cells, vertices } = pack;
    const [x0, y0] = cells.p[cell];
    const [v1, v2] = cells.v[cell].filter(vertex => vertices.c[vertex].includes(neighbor));
    const [x1, y1] = vertices.p[v1];
    const [x2, y2] = vertices.p[v2];
    return [rn(x0 + 0.95 * ((x1 + x2) / 2 - x0), 2), rn(y0 + 0.95 * ((y1 + y2) / 2 - y0), 2)];
  }

  private restoreStates(parent: PackedGraph, projection: Projection) {
    const { cells, burgs } = pack;
    const present = new Set(cells.state);
    pack.states = parent.states.map(state => {
      if (!state.i || state.removed) return state;
      if (!present.has(state.i)) return { ...state, removed: true, lock: false };
      return this.projectLabel(state, projection);
    });

    States.getPoles();

    for (const state of pack.states) {
      if (!state.i || state.removed) continue;
      const capital = burgs[state.capital];
      if (!capital?.i || capital.removed) {
        // the capital left the map: the most populous burg on the state's land takes over
        state.capital = 0;
        const successor = this.findMostPopulous(burg => burg.state === state.i && cells.state[burg.cell] === state.i);
        if (successor) Burgs.setCapital(successor.i);
      }
      state.center = state.capital
        ? burgs[state.capital].cell
        : this.keepCenter(parent, projection, state.center, cells.state, state.i, state.pole);

      const restoreRegiment = (regiment: Regiment): Regiment => {
        const [x, y] = projection(regiment.x, regiment.y);
        const home = this.projectPoint(parent, regiment.cell, projection);
        const cell = home && this.isInMap(...home) ? this.findCell(...home) : this.findCell(x, y);
        const [baseX, baseY] = projection(regiment.bx, regiment.by);
        const [bx, by] = this.isInMap(baseX, baseY) ? [rn(baseX, 2), rn(baseY, 2)] : cells.p[cell];
        const children = regiment.children?.map(restoreRegiment);
        return { ...regiment, cell, x: rn(x, 2), y: rn(y, 2), bx, by, ...(children && { children }) };
      };
      state.military = (state.military ?? [])
        .filter(regiment => this.isInMap(...projection(regiment.x, regiment.y)))
        .map(restoreRegiment);
    }
  }

  private findMostPopulous(fits: (burg: Burg) => boolean): Burg | undefined {
    const candidates = pack.burgs.filter(burg => burg.i && !burg.removed && fits(burg));
    return candidates.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
  }

  private restoreProvinces(parent: PackedGraph, projection: Projection) {
    const { cells, burgs, states } = pack;
    const present = new Set(cells.province);
    pack.provinces = parent.provinces.map(province => {
      if (!province.i || province.removed) return province;
      if (present.has(province.i)) return this.projectLabel(province, projection);
      const provinces = states[province.state]?.provinces;
      if (provinces) states[province.state].provinces = provinces.filter(id => id !== province.i);
      return { ...province, removed: true, lock: false };
    });

    Provinces.getPoles();

    for (const province of pack.provinces) {
      if (!province.i || province.removed) continue;
      const capital = burgs[province.burg];
      if (capital?.i && !capital.removed) {
        province.center = capital.cell;
        continue;
      }
      const successor = this.findMostPopulous(burg => cells.province[burg.cell] === province.i);
      if (successor) {
        Provinces.setCapital(province.i, successor.i);
        continue;
      }
      province.center = this.keepCenter(parent, projection, province.center, cells.province, province.i, province.pole);
      province.burg = 0;
    }
  }

  private restoreReligions(parent: PackedGraph, projection: Projection) {
    const { religion } = pack.cells;
    const present = new Set(religion);
    const poles = getPolesOfInaccessibility(pack, cell => religion[cell]);
    pack.religions = parent.religions.map(item => {
      if (!item.i || item.removed) return item;
      if (!present.has(item.i)) return { ...item, removed: true, lock: false };
      const center = this.findOrigin(parent, projection, item.center, () =>
        this.findPoleCell(religion, item.i, poles[item.i])
      );
      return { ...item, center };
    });
  }

  /** a point cut at the map edge takes the cell under it */
  private restoreRoutes(parent: PackedGraph, projection: Projection, featureIds: Map<number, number>) {
    const { cells } = pack;
    // a route can end at a port just off the map edge: a cell spacing of margin keeps it whole
    const margin = grid.spacing;
    const { width, height } = options.map.graph;
    const bbox: [number, number, number, number] = [-margin, -margin, width + margin, height + margin];
    const routes = parent.routes.map(route => {
      const projected = route.points.map(([x, y, cell]) => [...projection(x, y), cell]);
      // lineclip keeps the inner points as given and adds [x, y] points where the line is cut
      const [clipped] = clipPolyline(projected as Point[], bbox) as unknown as number[][][];
      if (!clipped || clipped.length < 2) return null;
      const points = this.fillPathGaps(
        clipped.map(([x, y, cell]): [number, number, number] => {
          const [px, py] = [rn(x, 2), rn(y, 2)];
          return [
            px,
            py,
            cell === undefined ? this.findCell(px, py) : this.findPathCell(parent, projection, cell, px, py)
          ];
        })
      );
      const wasWater = !parent.features[route.feature]?.land;
      const firstCell = points.find(([, , cell]) => isWater(cell, pack) === wasWater)?.[2] ?? points[0][2];
      const feature = featureIds.get(route.feature) ?? cells.f[firstCell];
      return this.projectLabel({ ...route, feature, points }, projection);
    });
    pack.routes = routes.filter(route => route !== null);
    cells.routes = Routes.buildLinks(pack.routes);
    Routes.sync(); // its path caches hold cell ids
  }

  private restoreMarkers(parent: PackedGraph, projection: Projection) {
    pack.markers = parent.markers.flatMap(marker => {
      const [x, y] = projection(marker.x, marker.y).map(value => rn(value, 2));
      if (!this.isInMap(x, y)) return [];
      return [{ ...marker, x, y, cell: this.findCell(x, y) }];
    });
  }

  /** a cell is in a zone if the snapshot cell under it was */
  private restoreZones(parent: PackedGraph, links: CellLinks) {
    const zonesByCell = new Map<number, number[]>();
    parent.zones.forEach((zone, index) => {
      for (const cell of zone.cells) {
        const zones = zonesByCell.get(cell);
        if (zones) zones.push(index);
        else zonesByCell.set(cell, [index]);
      }
    });

    const zoneCells: number[][] = parent.zones.map(() => []);
    for (let cell = 0; cell < pack.cells.i.length; cell++) {
      for (const index of zonesByCell.get(links.under[cell]) ?? []) zoneCells[index].push(cell);
    }
    pack.zones = parent.zones.map((zone, index) => ({ ...zone, cells: zoneCells[index] }));
  }

  private restoreJourneys(parent: PackedGraph, projection: Projection) {
    let dropped = 0;
    const journeys = (parent.journeys ?? []).map(journey => {
      const segments = journey.segments.flatMap(segment => {
        let points: JourneyPoint[] = [];
        for (const [parentX, parentY, cell] of segment.points) {
          const [x, y] = projection(parentX, parentY).map(value => rn(value, 2));
          // a clipped path can't stay valid cell-by-cell, so a segment leaving the map goes whole
          if (!this.isInMap(x, y)) return [];
          points.push([x, y, this.findPathCell(parent, projection, cell, x, y)]);
        }
        if (!points.length) return [];
        points = this.fillPathGaps(points);
        const from = segment.from === undefined ? undefined : points[0][2];
        const to = segment.to === undefined ? undefined : points.at(-1)![2];
        return [{ ...segment, points, from, to, distance: Journeys.getPathLength(points) }];
      });
      dropped += journey.segments.length - segments.length;
      return segments.length ? { ...journey, segments } : null;
    });
    pack.journeys = journeys.filter(journey => journey !== null);

    if (dropped) WARN && console.warn(`Map restoration: dropped ${dropped} journey segment(s) outside the map`);
  }

  private restoreAddedLabels(parent: PackedGraph, projection: Projection) {
    pack.addedLabels = (parent.addedLabels ?? []).map(addedLabel => {
      const [x, y] = projection(addedLabel.x, addedLabel.y).map(value => rn(value, 2));
      return this.projectLabel({ ...addedLabel, x, y }, projection);
    });
  }

  /** goods and market anchors are kept, everything cell-bound in the economy is rebuilt */
  private restoreEconomy(parent: PackedGraph) {
    pack.goods = parent.goods;
    pack.markets = (parent.markets ?? []).filter(market => {
      const burg = pack.burgs[market.centerBurgId];
      return Boolean(burg && !burg.removed);
    });

    if (pack.goods?.length) {
      // a rerun adds a round of income: the burgs keep the balance they had
      const treasuries = new Map(pack.burgs.map(burg => [burg, burg?.treasury]));
      Production.regenerateEconomy();
      for (const [burg, treasury] of treasuries) if (burg?.i) burg.treasury = treasury;
      return;
    }
    Goods.generate();
    Markets.generate();
    Production.produce();
    States.collectTaxes();
  }
}

/** cells shared by every pair of new and old ids, and the cells of each id, from a new and an old id per cell (0 for none) */
function countOverlaps(
  cellsNumber: number,
  newId: (cell: number) => number,
  oldId: (cell: number) => number | undefined
) {
  const pairs = new Map<string, number>(); // `${new}:${old}` -> cells
  const sizes = new Map<number, number>(); // new id -> cells
  const covered = new Map<number, number>(); // old id -> cells now over it
  for (let cell = 0; cell < cellsNumber; cell++) {
    const [id, oldIdOfCell] = [newId(cell), oldId(cell) ?? 0];
    if (id) sizes.set(id, (sizes.get(id) || 0) + 1);
    if (oldIdOfCell) covered.set(oldIdOfCell, (covered.get(oldIdOfCell) || 0) + 1);
    if (id && oldIdOfCell) pairs.set(`${id}:${oldIdOfCell}`, (pairs.get(`${id}:${oldIdOfCell}`) || 0) + 1);
  }
  return { pairs, sizes, covered };
}

/**
 * One-to-one matches, best overlap first. A pair matches when the overlap is most of the old one as it is now
 * or most of the new one, so a shrunk or grown entity is found again; of a split one, the biggest part. Returns old -> new
 */
function matchOverlaps(
  { pairs, sizes, covered }: ReturnType<typeof countOverlaps>,
  qualifies: (id: number, oldId: number) => boolean
): Map<number, number> {
  const matches = Array.from(pairs, ([key, overlap]) => {
    const [id, oldId] = key.split(":").map(Number);
    return { id, oldId, overlap };
  }).sort((a, b) => b.overlap - a.overlap);

  const taken = new Set<number>();
  const result = new Map<number, number>();
  for (const { id, oldId, overlap } of matches) {
    if (taken.has(id) || result.has(oldId)) continue;
    if (overlap * 2 < Math.min(covered.get(oldId)!, sizes.get(id)!) || !qualifies(id, oldId)) continue;
    taken.add(id);
    result.set(oldId, id);
  }
  return result;
}

/**
 * A finder that gives each request the nearest land cell no earlier request took,
 * so no two burgs share a cell. Undefined when no land cell is left
 */
export const createAvailableLandCellFinder = (cells: { h: ArrayLike<number>; p: readonly Point[] }) => {
  const landPoints: [number, number, number][] = [];
  for (let i = 0; i < cells.p.length; i++) {
    if (cells.h[i] >= 20) landPoints.push([cells.p[i][0], cells.p[i][1], i]);
  }

  const availableLand = quadtree<[number, number, number]>(landPoints);
  return (x: number, y: number): number | undefined => {
    const point = availableLand.find(x, y);
    if (!point) return;

    availableLand.remove(point);
    return point[2];
  };
};

export const MapRestoration = new MapRestorationModule();

// Checks that every stored cell id and every link between entities still holds. A broken id never throws, so it is
// looked for: after a rebuild of the graph, in tests, or from the console on a map that behaves oddly
import { isWater } from "@/utils";

export type IntegrityRule = (typeof RULES)[number];

/** one broken rule, with how often and where it breaks */
export interface IntegrityViolation {
  rule: IntegrityRule;
  count: number;
  examples: string[];
}

const RULES = [
  "river-cells", // ids valid or -1, as many points as cells
  "river-points", // a point lies in its cell
  "river-ownership", // a river's land cells carry it, or the river it joins there
  "river-ends", // source and mouth are cells
  "river-parent", // the parent is a river
  "river-sea", // the course does not cross the sea before its end
  "river-unique", // the course does not come back to a cell it left
  "river-outlet", // -1 only ends a course, at a point on the map edge or off it
  "route-points", // a point's cell is under it or next to it
  "route-steps", // consecutive cells are neighbors
  "route-links", // cells.routes links cells along existing routes
  "route-cache", // the Routes path cache matches the routes
  "journey-points",
  "journey-steps",
  "marker-cells", // a marker's cell is the cell under it
  "burg-cells", // a burg owns a land cell no other burg has
  "burg-positions", // a burg lies in its cell
  "burg-features", // feature and port water fit the cell
  "cell-burgs", // cells.burg points at living burgs that point back
  "state-centers",
  "state-capitals", // a living state has a living capital
  "state-provinces", // a state lists living provinces only
  "province-centers",
  "province-capitals", // a province capital is a living burg
  "culture-centers",
  "religion-centers",
  "regiment-cells",
  "zone-cells",
  "market-centers",
  "cell-owners", // cells point at living states, cultures, provinces and religions
  "lake-links", // a lake's inlets and outlet are rivers
  "cell-arrays", // every per-cell array covers every cell
  "cell-values", // population is a number, land has a biome
  "feature-data" // features are named, lakes and islands have a group
] as const;

const CELL_ARRAYS = [
  "h",
  "t",
  "f",
  "haven",
  "harbor",
  "biome",
  "pop",
  "s",
  "culture",
  "state",
  "province",
  "religion",
  "burg",
  "good",
  "r",
  "fl",
  "conf",
  "market"
] as const;

class MapIntegrityModule {
  readonly rules = RULES;

  /** every rule the current map breaks; an empty list for a sound map */
  check(): IntegrityViolation[] {
    const found = new Map<IntegrityRule, string[]>();
    const fail = (rule: IntegrityRule, example: string | number) => {
      const examples = found.get(rule) ?? [];
      examples.push(String(example));
      found.set(rule, examples);
    };

    const { cells, features } = pack;
    const n = cells.i.length;
    const valid = (cell: unknown): cell is number =>
      Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < n;
    const land = (cell: number) => valid(cell) && !isWater(cell, pack);
    const neighbors = (a: number, b: number) => a === b || cells.c[a]?.includes(b);
    const nearPoint = (cell: number, x: number, y: number) => neighbors(cell, Pack.findCell(x, y)!);
    const living = <T extends { i: number; removed?: boolean }>(list: T[] = []) => list.filter(e => e.i && !e.removed);
    const alive = (list: { i: number; removed?: boolean }[], id: number) => Boolean(list[id]?.i && !list[id].removed);
    const isOcean = (cell: number) => valid(cell) && features[cells.f[cell]]?.type === "ocean";
    const { width, height } = options.map.graph;
    const inside = (x: number, y: number) => x > 0 && x < width && y > 0 && y < height;

    const riverIds = new Set(pack.rivers.map(river => river.i));
    for (const river of pack.rivers) {
      if (river.cells.some(cell => cell !== -1 && !valid(cell))) fail("river-cells", river.i);
      else if (river.points && river.points.length !== river.cells.length) fail("river-cells", river.i);
      if (river.points?.some((point, k) => valid(river.cells[k]) && Pack.findCell(...point) !== river.cells[k]))
        fail("river-points", river.i);
      if (river.cells.some(cell => land(cell) && !riverIds.has(cells.r[cell]))) fail("river-ownership", river.i);
      if (!valid(river.source) || !(valid(river.mouth) || river.mouth === -1)) fail("river-ends", river.i);
      if (river.parent && !riverIds.has(river.parent)) fail("river-parent", river.i);
      if (river.cells.slice(0, -1).some(isOcean)) fail("river-sea", river.i);
      // generation can pour a river into a lake cell twice in a row: not a loop
      const course = river.cells.filter((cell, k) => cell !== -1 && cell !== river.cells[k - 1]);
      if (new Set(course).size !== course.length) fail("river-unique", river.i);
      const outlet = river.cells.indexOf(-1);
      const end = river.points?.at(-1);
      if (outlet !== -1 && (outlet < river.cells.length - 1 || (end && inside(...end)))) fail("river-outlet", river.i);
    }

    const routeIds = new Set(pack.routes.map(route => route.i));
    const routePairs = new Set<string>();
    for (const route of pack.routes) {
      if (route.points.some(([x, y, cell]) => !valid(cell) || !nearPoint(cell, x, y))) fail("route-points", route.i);
      for (let k = 1; k < route.points.length; k++) {
        const [a, b] = [route.points[k - 1][2], route.points[k][2]];
        routePairs.add(`${a}-${b}`).add(`${b}-${a}`);
        if (valid(a) && valid(b) && !neighbors(a, b)) fail("route-steps", route.i);
      }
    }
    for (const [from, links] of Object.entries(cells.routes ?? {})) {
      for (const [to, routeId] of Object.entries(links)) {
        if (!valid(+from) || !valid(+to) || !routeIds.has(routeId) || !routePairs.has(`${from}-${to}`))
          fail("route-links", from);
      }
    }
    // the cache is private: read it as a diagnostic, never write it
    const cached = (Routes as unknown as { connections?: Map<string, boolean> }).connections;
    for (const key of cached?.keys() ?? []) if (!routePairs.has(key)) fail("route-cache", key);

    for (const journey of pack.journeys ?? []) {
      for (const segment of journey.segments) {
        const { points } = segment;
        if (points.some(([x, y, cell]) => !valid(cell) || !nearPoint(cell, x, y))) fail("journey-points", journey.i);
        if (points.some(([, , cell], k) => k && valid(cell) && !neighbors(points[k - 1][2], cell)))
          fail("journey-steps", journey.i);
      }
    }

    for (const marker of pack.markers) {
      if (!valid(marker.cell) || Pack.findCell(marker.x, marker.y) !== marker.cell) fail("marker-cells", marker.i);
    }

    const burgsByCell = new Set<number>();
    for (const burg of living(pack.burgs)) {
      if (!land(burg.cell) || cells.burg[burg.cell] !== burg.i || burgsByCell.has(burg.cell))
        fail("burg-cells", burg.i);
      burgsByCell.add(burg.cell);
      if (valid(burg.cell) && Pack.findCell(burg.x, burg.y) !== burg.cell) fail("burg-positions", burg.i);
      const port = burg.port ? features[burg.port] : undefined;
      if (burg.feature !== cells.f[burg.cell] || (burg.port && (!port || port.land))) fail("burg-features", burg.i);
    }
    for (let cell = 0; cell < n; cell++) {
      const burgId = cells.burg[cell];
      if (burgId && (!alive(pack.burgs, burgId) || pack.burgs[burgId].cell !== cell)) fail("cell-burgs", cell);
    }

    for (const state of living(pack.states)) {
      const capital = pack.burgs[state.capital];
      if (!state.capital || !alive(pack.burgs, state.capital)) fail("state-capitals", state.i);
      else if (state.center !== capital.cell) fail("state-centers", state.i);
      if (!state.capital && cells.state[state.center] !== state.i) fail("state-centers", state.i);
      if (state.provinces?.some(id => !alive(pack.provinces, id))) fail("state-provinces", state.i);
      for (const regiment of state.military ?? [])
        if (!valid(regiment.cell)) fail("regiment-cells", `${state.i}-${regiment.i}`);
    }
    for (const province of living(pack.provinces)) {
      if (province.burg && !alive(pack.burgs, province.burg)) fail("province-capitals", province.i);
      const ownCenter = cells.province[province.center] === province.i;
      if (!valid(province.center) || (!ownCenter && pack.burgs[province.burg]?.cell !== province.center))
        fail("province-centers", province.i);
    }
    for (const culture of living(pack.cultures)) if (!land(culture.center!)) fail("culture-centers", culture.i);
    for (const religion of living(pack.religions)) if (!land(religion.center)) fail("religion-centers", religion.i);
    for (const zone of pack.zones) if (zone.cells.some(cell => !valid(cell))) fail("zone-cells", zone.i);
    for (const market of pack.markets ?? [])
      if (!alive(pack.burgs, market.centerBurgId)) fail("market-centers", market.i);

    const owners = [
      [cells.state, pack.states],
      [cells.culture, pack.cultures],
      [cells.province, pack.provinces],
      [cells.religion, pack.religions]
    ] as const;
    for (const [values, list] of owners) {
      for (let cell = 0; cell < n; cell++) if (values?.[cell] && !alive(list, values[cell])) fail("cell-owners", cell);
    }

    for (const lake of features) {
      if (lake?.type !== "lake") continue;
      if ((lake.outlet && !riverIds.has(lake.outlet)) || lake.inlets?.some(id => !riverIds.has(id)))
        fail("lake-links", lake.i);
    }

    for (const key of CELL_ARRAYS) if (cells[key]?.length !== n) fail("cell-arrays", key);
    for (let cell = 0; cell < n; cell++) {
      if (!Number.isFinite(cells.pop?.[cell]) || (land(cell) && !cells.biome?.[cell])) fail("cell-values", cell);
    }
    for (const feature of features) {
      if (!feature) continue;
      if (!feature.name || (feature.type !== "ocean" && !feature.group)) fail("feature-data", feature.i);
    }

    return RULES.flatMap(rule => {
      const examples = found.get(rule);
      return examples ? [{ rule, count: examples.length, examples: examples.slice(0, 5) }] : [];
    });
  }
}

export const MapIntegrity = new MapIntegrityModule();
Object.assign(window, { MapIntegrity }); // to run from the console on a map that behaves oddly

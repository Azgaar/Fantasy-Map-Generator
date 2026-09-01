import { DEFAULT_JOURNEY_TYPE } from "@/data/journey-lore";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/Journey";
import { getDistanceUnitRatio, isLand } from "@/utils";
import { getCardinalColor } from "@/utils/colorUtils";
import type { Burg } from "../burgs-generator";
import type { Route } from "../routes-generator";
import { MAX_HOURS_PER_DAY, type TransportDomain } from "../transports-generator";
import { generateStoryJourney } from "./journey-story";

const COARSE_UNIT_THRESHOLD = 10;
const MINUTES_PER_DAY = MAX_HOURS_PER_DAY * 60;
const ON_ROAD_DISCOUNT = 0.5;
const OFF_ROAD_PENALTY = 5;
const FALLBACK_POOL_SIZE = 6;
const OFF_ROAD_SPEED_FACTOR = 0.5;
const BASELINE_BIOME_COST = 50;
const HEIGHT_COST_THRESHOLD = 25;

export interface PathfindingResult {
  points: JourneyPoint[];
  distance: number;
  warning?: string;
  errorCode?: "no-water" | "no-land" | "no-water-path" | "no-land-path";
}

class JourneysModule {
  generate(): void {
    this.sync();
    if (pack.journeys.length) return;
    this.addRandom();
  }

  addRandom(): Journey | null {
    this.sync();
    const story = generateStoryJourney(this) ?? this.buildFallbackJourney();
    if (!story) return null;

    const i = this.getNextId(pack.journeys);
    const journey = { ...story, i, color: getCardinalColor(i) };
    pack.journeys.push(journey);
    return journey;
  }

  addEmpty(): Journey {
    this.sync();
    const i = this.getNextId(pack.journeys);
    const journey: Journey = {
      i,
      name: `Journey ${i + 1}`,
      type: DEFAULT_JOURNEY_TYPE,
      color: getCardinalColor(i),
      segments: []
    };
    pack.journeys.push(journey);
    return journey;
  }

  /** Ensure the pack carries the journey collection; safe to call repeatedly */
  sync(): void {
    if (!pack.journeys) pack.journeys = [];
  }

  remove(journeyId: number): void {
    pack.journeys = pack.journeys.filter(journey => journey.i !== journeyId);
  }

  private getNextId(items: { i: number }[]): number {
    return items.length ? Math.max(...items.map(({ i }) => i)) + 1 : 0;
  }

  /** Append an empty segment, starting where the previous one ended */
  addSegment(journey: Journey): JourneySegment {
    const i = this.getNextId(journey.segments);
    const transport = Transports.all.find(type => type.domain !== "stay") ?? Transports.all[0];

    const segment: JourneySegment = {
      i,
      name: `Segment ${i + 1}`,
      from: journey.segments.at(-1)?.to,
      transport: transport?.name ?? "Direct",
      speed: transport?.speed ?? 5,
      distance: 0,
      points: []
    };
    journey.segments.push(segment);
    return segment;
  }

  /** An absent flag means visible, so only hiding stores anything */
  toggleVisibility(target: { visible?: boolean }): void {
    if (target.visible === false) delete target.visible;
    else target.visible = false;
  }

  /** A halt, not a slow leg: decided by the transport's domain, never by a speed the user typed */
  isStaySegment(seg: JourneySegment): boolean {
    return Transports.getDomain(seg.transport) === "stay";
  }

  /** Hours of travel a day the segment's transport sustains */
  getSegmentHoursPerDay(seg: JourneySegment): number {
    return Transports.getHoursPerDay(seg.transport);
  }

  /** Segment length in the current distance unit; a stay covers no ground. */
  getSegmentDistance(seg: JourneySegment): number {
    return this.isStaySegment(seg) ? 0 : seg.distance * distanceScale;
  }

  /** Speed in km/h, after the off-road penalty. The UI converts it to the user distance unit */
  getEffectiveSpeed(seg: JourneySegment): number {
    if (!seg.speed || seg.speed <= 0) return 0;
    return seg.avoidRoads ? seg.speed * OFF_ROAD_SPEED_FACTOR : seg.speed;
  }

  getSegmentTime(seg: JourneySegment): number {
    if (seg.duration !== undefined) return seg.duration; // an explicit override wins
    // distances are in the user distance unit, speeds in km/h: bring the speed over to compare them
    const speed = this.getEffectiveSpeed(seg) * getDistanceUnitRatio();
    return speed > 0 ? this.getSegmentDistance(seg) / speed : 0;
  }

  /**
   * Calendar hours a stretch of travel takes: every full travel day the transport sustains
   * costs a whole 24h day (8 hours of walking fill a walker's day), the hours left over
   * cost only themselves. A stay travels 24h a day, so waiting hours are calendar hours.
   */
  getElapsedHours(hours: number, hoursPerDay: number): number {
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    // a corrupt rate must not inflate the day count, so fall back to the longest possible day
    const rate = hoursPerDay > 0 ? hoursPerDay : MAX_HOURS_PER_DAY;
    const days = Math.floor(hours / rate);
    return days * MAX_HOURS_PER_DAY + (hours - days * rate);
  }

  /** Calendar hours the segment takes, counted at its own transport's travel day */
  getSegmentElapsedHours(seg: JourneySegment): number {
    return this.getElapsedHours(this.getSegmentTime(seg), this.getSegmentHoursPerDay(seg));
  }

  getTotals(journey: Journey) {
    let totalDistance = 0;
    let totalHours = 0;
    let movingHours = 0;
    let elapsedHours = 0;
    let hiddenSegments = 0;

    for (const seg of journey.segments) {
      // a hidden leg is off the map and out of the totals: an alternative route, a leg not taken yet
      if (seg.visible === false) {
        hiddenSegments++;
        continue;
      }

      const hours = this.getSegmentTime(seg);
      totalDistance += this.getSegmentDistance(seg);
      totalHours += hours;
      // each segment converts to calendar hours at its own travel day, so the sum stays exact
      elapsedHours += this.getSegmentElapsedHours(seg);
      if (!this.isStaySegment(seg)) movingHours += hours;
    }

    // avgSpeed is km/h like every other stored speed, so the distance-unit ratio has to come back out
    const avgSpeed = movingHours > 0 ? totalDistance / movingHours / getDistanceUnitRatio() : 0;
    const totalDays = elapsedHours / MAX_HOURS_PER_DAY;
    return { totalDistance, totalHours, avgSpeed, elapsedHours, totalDays, hiddenSegments };
  }

  /** Readable calendar duration, e.g. "2d 3h", from the hours `getElapsedHours` returns */
  formatTravelTime(elapsedHours: number): string {
    const { days, hours, minutes } = this.splitTravelTime(elapsedHours);

    if (days >= COARSE_UNIT_THRESHOLD) return `${days}d`;
    if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
    if (hours >= COARSE_UNIT_THRESHOLD) return `${hours}h`;
    if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
  }

  /**
   * Hours spent moving or waiting, e.g. "733h" — no travel day applied, so it stays
   * comparable to the hours typed into a segment. Never days: those are calendar time.
   */
  formatHours(hours: number): string {
    const totalMinutes = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
    const [restHours, minutes] = [Math.floor(totalMinutes / 60), totalMinutes % 60];

    if (restHours >= COARSE_UNIT_THRESHOLD) return `${restHours}h`;
    if (restHours) return minutes ? `${restHours}h ${minutes}m` : `${restHours}h`;
    return `${minutes}m`;
  }

  /** Exact calendar duration down to the minute, e.g. "52d 4h 9m" — for tooltips */
  formatTravelTimeFull(elapsedHours: number): string {
    const { days, hours, minutes } = this.splitTravelTime(elapsedHours);

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes || !parts.length) parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  private splitTravelTime(elapsedHours: number): { days: number; hours: number; minutes: number } {
    const totalMinutes = Number.isFinite(elapsedHours) && elapsedHours > 0 ? Math.round(elapsedHours * 60) : 0;
    const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const rest = totalMinutes - days * MINUTES_PER_DAY;
    return { days, hours: Math.floor(rest / 60), minutes: rest % 60 };
  }

  /** Total length in px of a point chain — manual path edits recalculate distance with it. */
  getPathLength(points: JourneyPoint[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += this.getDistance(points[i - 1], points[i]);
    return total;
  }

  /**
   * Is the cell a valid endpoint for the domain?
   *   land:  cell must be on land (coastal land is fine — you can board/disembark there)
   *   water: cell must be water, or land a boat can put in at (see {@link isMoorage})
   *   air:   any cell
   */
  isValidEndpoint(cellId: number, domain: TransportDomain): boolean {
    if (cellId === undefined || cellId === null) return false;
    if (domain === "air" || domain === "stay") return true;
    if (domain === "land") return isLand(cellId, pack);
    return !isLand(cellId, pack) || this.isMoorage(cellId);
  }

  /**
   * Stricter than {@link isValidEndpoint}: a water route may start or end on the shore
   * (you board from land), but overland it may only follow a navigable river, as searoutes do.
   */
  isValidPathPoint(cellId: number, domain: TransportDomain): boolean {
    if (cellId === undefined || cellId === null) return false;
    if (domain === "air" || domain === "stay") return true;
    if (domain === "land") return isLand(cellId, pack);
    return !isLand(cellId, pack) || Rivers.isNavigable(cellId);
  }

  /** Endpoints and intermediate points answer to different rules; this picks the right one */
  isValidPointAt(cellId: number, domain: TransportDomain, isEndpoint: boolean): boolean {
    return isEndpoint ? this.isValidEndpoint(cellId, domain) : this.isValidPathPoint(cellId, domain);
  }

  /** Whole-path form of {@link isValidPathPoint}; endpoints are skipped deliberately. */
  isValidPath(points: JourneyPoint[], domain: TransportDomain): boolean {
    for (let i = 1; i < points.length - 1; i++) {
      if (!this.isValidPathPoint(points[i][2], domain)) return false;
    }
    return true;
  }

  describeCell(cellId: number): string {
    if (cellId === undefined || cellId === null) return "no cell";
    if (!isLand(cellId, pack)) return `water cell ${cellId}`;
    if (Rivers.isNavigable(cellId)) return `navigable river cell ${cellId}`;
    if (this.isCoastalLand(cellId)) return `coastal land cell ${cellId}`;
    return `inland land cell ${cellId}`;
  }

  findPath(
    from: number,
    to: number,
    domain: TransportDomain,
    options: {
      avoidRoads?: boolean;
    } = {}
  ): PathfindingResult {
    if (from === to) return { points: [this.getPoint(from)], distance: 0 };

    // domain gate: refuse before pathfinding when the endpoints obviously don't match
    if (domain === "land" && (!isLand(from, pack) || !isLand(to, pack))) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-land",
        warning: "Land transport can only travel between land cells. At least one endpoint is in water."
      };
    }

    if (domain === "water" && !(this.isValidEndpoint(from, "water") && this.isValidEndpoint(to, "water"))) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-water",
        warning:
          "Water transport needs a water cell, a coastal cell or a navigable river at both ends. At least one endpoint is landlocked."
      };
    }

    if (domain === "water") return this.findWaterPath(from, to);
    if (domain === "land") return this.findLandPath(from, to, options.avoidRoads);
    return this.toResult([this.getPoint(from), this.getPoint(to)]); // air and stay go in a direct line
  }

  private findLandPath(from: number, to: number, avoidRoads = false): PathfindingResult {
    if (isLand(from, pack) && isLand(to, pack) && pack.cells.f[from] !== pack.cells.f[to]) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-land-path",
        warning: "No land route exists — the cells are on different landmasses."
      };
    }

    if (!avoidRoads) {
      const chain = this.findRouteChain(from, to, cellId => isLand(cellId, pack));
      if (chain) {
        const points = this.collectRoutePoints(chain);
        if (this.isValidPath(points, "land")) return this.toResult(points);
      }
    }

    const pathCells = this.findPathAStar(from, to, (a, b) => {
      if (!isLand(b, pack) && b !== to && b !== from) return Infinity;
      const cost = this.getDistance(this.getPoint(a), this.getPoint(b)) * this.getTerrainCost(b);
      if (!this.hasRoute(b)) return cost;
      return cost * (avoidRoads ? OFF_ROAD_PENALTY : ON_ROAD_DISCOUNT);
    });

    if (!pathCells) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-land-path",
        warning: "No land route found between these cells"
      };
    }

    const points = pathCells.map(cellId => this.getPoint(cellId));
    return { ...this.toResult(points), warning: avoidRoads ? undefined : "Segment leaves the road network" };
  }

  private findWaterPath(from: number, to: number): PathfindingResult {
    const pathCells = Routes.findWaterPath(from, to);

    if (!pathCells) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-water-path",
        warning: "No sea route found between these cells — they may be in different bodies of water."
      };
    }

    // the same geometry searoutes are drawn with: burg positions at ports, meandering along rivers
    return this.toResult(Routes.getWaterPoints(pathCells) as JourneyPoint[]);
  }

  /** A* shortest-path over the Voronoi cell graph */
  private findPathAStar(
    start: number,
    end: number,
    getCost: (current: number, next: number) => number
  ): number[] | null {
    const { cells } = pack;
    const [endX, endY] = cells.p[end];
    // scaled by the cheapest possible step cost (the road discount) to stay admissible
    const heuristic = (cellId: number) =>
      ON_ROAD_DISCOUNT * Math.hypot(cells.p[cellId][0] - endX, cells.p[cellId][1] - endY);

    const from: number[] = [];
    const gScore: number[] = [];
    const closed = new Set<number>();
    const queue = new FlatQueue();

    gScore[start] = 0;
    queue.push(start, heuristic(start));

    while (queue.length) {
      const current = queue.pop();
      if (current === end) return this.tracePath(from, start, end);

      if (closed.has(current)) continue;
      closed.add(current);

      const currentG = gScore[current];
      if (currentG === undefined) continue;

      for (const next of cells.c[current]) {
        if (closed.has(next)) continue;

        const edgeCost = getCost(current, next);
        if (edgeCost === Infinity) continue;

        const tentativeG = currentG + edgeCost;
        if (gScore[next] !== undefined && tentativeG >= gScore[next]) continue;

        from[next] = current;
        gScore[next] = tentativeG;
        queue.push(next, tentativeG + heuristic(next));
      }
    }

    return null;
  }

  /**
   * BFS over pack.cells.routes for a road path between two cells, or null if disconnected.
   *
   * `canTraverse` gates intermediate cells by terrain, because pack.cells.routes merges
   * every route group into one graph — roads, trails and searoutes alike. Without it a
   * land journey happily walks a sea route across the ocean.
   */
  private findRouteChain(start: number, end: number, canTraverse: (cellId: number) => boolean): number[] | null {
    const links = pack.cells.routes;
    if (!links[start] || !links[end]) return null;

    const from: number[] = [];
    const visited = new Set<number>([start]);
    const queue: number[] = [start];

    while (queue.length) {
      const current = queue.shift()!;
      for (const key of Object.keys(links[current] ?? {})) {
        const next = +key;
        if (visited.has(next)) continue;
        visited.add(next);
        if (next === end) {
          from[next] = current;
          return this.tracePath(from, start, end);
        }
        if (!canTraverse(next)) continue;
        from[next] = current;
        queue.push(next);
      }
    }

    return null;
  }

  /** Walk the `from` predecessors back to `start` and return the chain in travel order. */
  private tracePath(from: number[], start: number, end: number): number[] {
    const chain = [end];
    let current = end;
    while (current !== start) {
      current = from[current];
      chain.push(current);
    }
    return chain.reverse();
  }

  /** Concatenate the route geometry along a cell chain, dropping duplicated joins. */
  private collectRoutePoints(chain: number[]): JourneyPoint[] {
    const links = pack.cells.routes;
    const points: JourneyPoint[] = [];

    const push = (point: JourneyPoint) => {
      const last = points[points.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
    };

    for (let i = 0; i < chain.length - 1; i++) {
      const [a, b] = [chain[i], chain[i + 1]];
      const routeId = links[a]?.[b];
      const route = routeId === undefined ? undefined : pack.routes.find((r: Route) => r.i === routeId);

      // find the slice of route.points that goes from cell a to cell b
      const fromIndex = route?.points.findIndex(point => point[2] === a) ?? -1;
      const toIndex = route?.points.findIndex(point => point[2] === b) ?? -1;
      if (!route || fromIndex === -1 || toIndex === -1) {
        push(this.getPoint(a));
        push(this.getPoint(b));
        continue;
      }

      const step = fromIndex < toIndex ? 1 : -1;
      for (let j = fromIndex; j !== toIndex + step; j += step) push([...route.points[j]] as JourneyPoint);
    }

    if (!points.length) return [this.getPoint(chain[0]), this.getPoint(chain[chain.length - 1])];
    return points;
  }

  private toResult(points: JourneyPoint[]): PathfindingResult {
    return { points, distance: this.getPathLength(points) };
  }

  private getPoint(cellId: number): JourneyPoint {
    const [x, y] = pack.cells.p[cellId];
    return [x, y, cellId];
  }

  private getDistance(a: JourneyPoint, b: JourneyPoint): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  private getTerrainCost(cellId: number): number {
    const { cells, biomes } = pack;
    const biomeCost = biomes?.[cells.biome?.[cellId] ?? 0]?.cost ?? BASELINE_BIOME_COST;
    const biomeModifier = Math.max(biomeCost / BASELINE_BIOME_COST, 1); // [1, 100] by default
    const heightModifier = 1 + Math.max(cells.h[cellId] - HEIGHT_COST_THRESHOLD, 0) / HEIGHT_COST_THRESHOLD; // [1, 4]
    return biomeModifier * heightModifier;
  }

  private hasRoute(cellId: number): boolean {
    return Object.keys(pack.cells.routes?.[cellId] ?? {}).length > 0;
  }

  private isCoastalLand(cellId: number): boolean {
    if (!isLand(cellId, pack)) return false;
    return (pack.cells.c[cellId] ?? []).some(neibCellId => !isLand(neibCellId, pack));
  }

  /** Land a boat can put in at: a coastal cell with a haven, or a navigable river cell */
  private isMoorage(cellId: number): boolean {
    return Boolean(pack.cells.haven?.[cellId]) || Rivers.isNavigable(cellId);
  }

  /** Single-domain A→B leg between the most notable burgs — never a land leg that secretly crosses water. */
  private buildFallbackJourney() {
    const burgs = (pack.burgs ?? []).filter(burg => burg?.i && !burg.removed && burg.cell !== undefined);
    if (burgs.length < 2) return null;

    const capitals = burgs.filter(burg => burg.capital);
    const ranked =
      capitals.length >= 2 ? capitals : [...burgs].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    const pool = ranked.slice(0, FALLBACK_POOL_SIZE);

    const segment =
      this.findFallbackLeg(pool, "land") ??
      this.findFallbackLeg(
        pool.filter(burg => burg.port),
        "water"
      );
    if (!segment) return null;

    return { name: segment.name, type: "Travel", segments: [segment] };
  }

  /** First burg pair in `pool` joined by a path that is genuinely valid for `domain`. */
  private findFallbackLeg(pool: Burg[], domain: TransportDomain): JourneySegment | null {
    const transport = Transports.getByDomain(domain);
    if (!transport) return null;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const [from, to] = [pool[i].cell, pool[j].cell];
        if (!this.isValidEndpoint(from, domain) || !this.isValidEndpoint(to, domain)) continue;

        const { points, distance, errorCode } = this.findPath(from, to, domain);
        if (errorCode || points.length < 2 || !this.isValidPath(points, domain)) continue;

        return {
          i: 0,
          name: `${pool[i].name ?? "Start"} → ${pool[j].name ?? "End"}`,
          from,
          to,
          transport: transport.name,
          speed: transport.speed,
          distance,
          points
        };
      }
    }

    return null;
  }
}

declare global {
  var Journeys: JourneysModule;
}

window.Journeys = new JourneysModule();

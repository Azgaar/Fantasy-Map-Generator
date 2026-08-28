import { DEFAULT_JOURNEY_TYPE } from "@/data/journey-lore";
import { getDefaultTransportTypes } from "@/data/transport-types";
import type { JouneySegment, Journey, JourneyPoint, TransportDomain, TransportType } from "@/types/Journey";
import { isLand } from "../utils";
import { getCardinalColor } from "../utils/colorUtils";
import type { Burg } from "./burgs-generator";
import { generateStoryJourney } from "./journey-story";
import type { Route } from "./routes-generator";

const DEFAULT_HOURS_PER_DAY = 8;
const COARSE_UNIT_THRESHOLD = 10;
const ON_ROAD_DISCOUNT = 0.5;
const OFF_ROAD_PENALTY = 5;
const FALLBACK_POOL_SIZE = 6;
const OFF_ROAD_SPEED_FACTOR = 0.5;

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

    const i = this.getNextId();
    const journey = { ...story, i, color: getCardinalColor(i) };
    pack.journeys.push(journey);
    return journey;
  }

  addEmpty(): Journey {
    this.sync();
    const i = this.getNextId();
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

  /** Ensure the pack carries the journey collections; safe to call repeatedly */
  sync(): void {
    if (!pack.journeys) pack.journeys = [];
    if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
  }

  remove(journeyId: number): void {
    pack.journeys = pack.journeys.filter(journey => journey.i !== journeyId);
  }

  getNextId(): number {
    return pack.journeys.length ? Math.max(...pack.journeys.map(journey => journey.i)) + 1 : 0;
  }

  isStaySegment(seg: JouneySegment): boolean {
    return seg.speed <= 0;
  }

  /** Segment length in the current distance unit; a stay covers no ground. */
  getSegmentDistance(seg: JouneySegment): number {
    return this.isStaySegment(seg) ? 0 : seg.distance * distanceScale;
  }

  getEffectiveSpeed(seg: JouneySegment): number {
    if (!seg.speed || seg.speed <= 0) return 0;
    return seg.avoidRoads ? seg.speed * OFF_ROAD_SPEED_FACTOR : seg.speed;
  }

  getSegmentTime(seg: JouneySegment): number {
    if (seg.duration !== undefined) return seg.duration; // an explicit override wins
    const speed = this.getEffectiveSpeed(seg);
    return speed > 0 ? this.getSegmentDistance(seg) / speed : 0;
  }

  /** Average speed covers moving segments only, so a long stay doesn't drag it down. */
  getTotals(journey: Journey) {
    let totalDistance = 0;
    let totalHours = 0;
    let movingHours = 0;

    for (const seg of journey.segments) {
      const hours = this.getSegmentTime(seg);
      totalDistance += this.getSegmentDistance(seg);
      totalHours += hours;
      if (!this.isStaySegment(seg)) movingHours += hours;
    }

    return { totalDistance, totalHours, avgSpeed: movingHours > 0 ? totalDistance / movingHours : 0 };
  }

  /** Readable duration, e.g. "2d 3h". Days are counted from `hoursPerDay` */
  formatTravelTime(hours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): string {
    const { days, hours: restHours, minutes } = this.splitTravelTime(hours, hoursPerDay);

    if (days >= COARSE_UNIT_THRESHOLD) return `${days}d`;
    if (days) return restHours ? `${days}d ${restHours}h` : `${days}d`;
    if (restHours >= COARSE_UNIT_THRESHOLD) return `${restHours}h`;
    if (restHours) return minutes ? `${restHours}h ${minutes}m` : `${restHours}h`;
    return `${minutes}m`;
  }

  /** Exact duration down to the minute, e.g. "52d 4h 9m" — for tooltips */
  formatTravelTimeFull(hours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): string {
    const { days, hours: restHours, minutes } = this.splitTravelTime(hours, hoursPerDay);

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (restHours) parts.push(`${restHours}h`);
    if (minutes || !parts.length) parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  private splitTravelTime(hours: number, hoursPerDay: number): { days: number; hours: number; minutes: number } {
    const minutesPerDay = (hoursPerDay > 0 ? hoursPerDay : DEFAULT_HOURS_PER_DAY) * 60;
    const totalMinutes = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const rest = totalMinutes - days * minutesPerDay;
    return { days, hours: Math.floor(rest / 60), minutes: rest % 60 };
  }

  /** Total length in px of a point chain — manual path edits recalculate distance with it. */
  getPathLength(points: JourneyPoint[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += this.getDistance(points[i - 1], points[i]);
    return total;
  }

  getTransportType(name: string): TransportType | undefined {
    return pack.transportTypes.find(type => type.name === name);
  }

  /** Domain of the named transport type; unknown types are treated as unrestricted. */
  getDomain(name: string): TransportDomain {
    return this.getTransportType(name)?.domain ?? "air";
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
    if (!avoidRoads) {
      // Try the exact road-network path first: it walks the underlying Route.points
      // slices, so it follows the drawn road geometry rather than cell centres.
      const chain = this.findRouteChain(from, to, cellId => isLand(cellId, pack));
      if (chain) {
        const points = this.collectRoutePoints(chain);
        // The chain is land-only, but a route's own geometry between two land cells
        // can still dip into water — fall through to A* when it does.
        if (this.isValidPath(points, "land")) return this.toResult(points);
      }
    }

    // On-road fallback: road cells get a discount so the path seeks roads out.
    // Off-road: road cells get a penalty so the path routes around them.
    const pathCells = this.findPathAStar(from, to, (a, b) => {
      if (!isLand(b, pack) && b !== to && b !== from) return Infinity;
      const cost = this.getDistance(this.getPoint(a), this.getPoint(b));
      if (!this.hasRoute(b)) return cost;
      return cost * (avoidRoads ? OFF_ROAD_PENALTY : ON_ROAD_DISCOUNT);
    });

    if (!pathCells) {
      return {
        points: [],
        distance: 0,
        errorCode: "no-land-path",
        warning: "No land route found between these cells — they may be on different landmasses."
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

  /**
   * A* shortest-path over the Voronoi cell graph.
   *
   * Two critical differences from the shared `findPath` in pathUtils:
   *  1. Uses a Euclidean-distance heuristic so exploration fans toward the
   *     target, producing visually straighter paths.
   *  2. Checks the exit condition when a cell is **popped** from the priority
   *     queue (not when discovered as a neighbour), guaranteeing the returned
   *     path is truly optimal.
   */
  private findPathAStar(
    start: number,
    end: number,
    getCost: (current: number, next: number) => number
  ): number[] | null {
    const { cells } = pack;
    const [endX, endY] = cells.p[end];
    const heuristic = (cellId: number) => Math.hypot(cells.p[cellId][0] - endX, cells.p[cellId][1] - endY);

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
  private findFallbackLeg(pool: Burg[], domain: TransportDomain): JouneySegment | null {
    const transport = pack.transportTypes.find(type => type.domain === domain);
    if (!transport) return null;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const [from, to] = [pool[i].cell, pool[j].cell];
        if (!this.isValidEndpoint(from, domain) || !this.isValidEndpoint(to, domain)) continue;

        const { points, distance, errorCode } = this.findPath(from, to, domain);
        if (errorCode || points.length < 2 || !this.isValidPath(points, domain)) continue;

        return {
          id: 0,
          name: `${pool[i].name ?? "Start"} → ${pool[j].name ?? "End"}`,
          from,
          to,
          transportType: transport.name,
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

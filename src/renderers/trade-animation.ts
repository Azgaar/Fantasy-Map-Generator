import { DEFAULT_TRADE_ANIMATION } from "@/data/trade-animation-options";
import type { Deal } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import { TradeRoutes } from "@/model/economy/trade-routes";
import type { Point } from "@/model/graph/voronoi";
import { Layers } from "@/renderers/layers";
import { ra } from "@/utils/probability-utils";
import { clear, draw } from "./draw-trade-animation";

type TradePath = { points: Point[]; segments: { type: "land" | "water"; points: Point[] }[] };

export class TradeAnimationModule {
  private activeCount = 0;
  private generation = 0;
  private cachedDeals: Deal[] | null = null;
  private pathCache = new Map<string, TradePath | null>();

  start(): void {
    if (!Layers.isOn("trade")) return;
    this.stop();
    const deals = pack.deals.filter(deal => this.getEnds(deal));
    if (!deals.length) return;
    this.cachedDeals = deals;
    this.topUp();
  }

  stop(): void {
    this.generation++;
    this.activeCount = 0;
    this.cachedDeals = null;
    this.pathCache.clear();
    clear();
  }

  sync(): void {
    if (Layers.isOn("trade")) this.start();
    else this.stop();
  }

  private topUp(): void {
    if (!Layers.isOn("trade") || !this.cachedDeals) return;
    const target = options.app.trade.animation.concurrent ?? DEFAULT_TRADE_ANIMATION.concurrent;
    while (this.activeCount < target) {
      if (!this.spawnOne(this.cachedDeals)) break;
    }
  }

  private spawnOne(deals: Deal[]): boolean {
    while (deals.length) {
      const deal = ra(deals);

      const path = this.getPath(deal);
      if (!path) {
        const idx = deals.indexOf(deal);
        if (idx !== -1) deals.splice(idx, 1);
        continue;
      }

      const gen = this.generation;
      this.activeCount++;
      draw(
        deal,
        path.segments,
        () => {
          if (gen !== this.generation) return;
          this.activeCount--;
          this.topUp();
        },
        () => gen !== this.generation
      );
      return true;
    }
    return false;
  }

  trigger(deals: Deal[]): void {
    if (!deals.length) return;
    if (!Layers.isOn("trade")) {
      clear();
      return;
    }

    for (const deal of deals) {
      const path = this.getPath(deal);
      if (!path) continue;
      draw(deal, path.segments);
    }
  }

  /** Burgs the goods travel between: the market's center and the burg, in the direction of the deal */
  getEnds([burgId, marketId, , kind]: Deal): { startBurgId: number; endBurgId: number } | null {
    const centerId = Markets.get(marketId)?.centerBurgId;
    const burg = pack.burgs[burgId];
    const center = centerId ? pack.burgs[centerId] : undefined;
    if (!burg?.i || burg.removed || !center?.i || center.removed || burg.cell === center.cell) return null;
    if (kind === DEAL_KINDS.kept) return null; // nothing moves
    return kind === DEAL_KINDS.sale
      ? { startBurgId: burgId, endBurgId: center.i }
      : { startBurgId: center.i, endBurgId: burgId };
  }

  getPath(deal: Deal): TradePath | null {
    const ends = this.getEnds(deal);
    if (!ends) return null;

    const cacheKey = `${ends.startBurgId}-${ends.endBurgId}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const path = this.findRoutePath(pack.burgs[ends.startBurgId].cell, pack.burgs[ends.endBurgId].cell);
    this.pathCache.set(cacheKey, path);
    return path;
  }

  findRoutePath(startCell: number, endCell: number): TradePath | null {
    if (startCell === endCell) return null;
    const { search, endState } = TradeRoutes.search(startCell, endCell);
    if (endState === -1) return null;
    return this.buildPathResult(endState, search.prevCell, search.prevState);
  }

  private buildPathResult(
    terminalState: number,
    prevCellArr: Int32Array,
    prevStateArr: Int32Array
  ): { points: Point[]; segments: { type: "land" | "water"; points: Point[] }[] } {
    const cells: number[] = [terminalState >> 1]; // endCell
    const waterEdges: boolean[] = [];
    let state = terminalState;
    while (prevStateArr[state] !== -1) {
      waterEdges.push((state & 1) === 1);
      cells.push(prevCellArr[state]);
      state = prevStateArr[state];
    }
    waterEdges.push((state & 1) === 1); // first hop from startCell
    cells.push(prevCellArr[state]); // startCell
    cells.reverse();
    waterEdges.reverse();

    type Segment = "land" | "water";

    if (cells.length < 2) return { points: [], segments: [] };

    // Build a fast routeId→route lookup to avoid repeated linear scans.
    const routeById = new Map<number, { points: number[][] }>();
    for (const route of pack.routes) routeById.set(route.i, route);

    // Process the path edge-by-edge, extracting actual stored route geometry so the
    // animation follows the same adjusted/meandered points that the renderer draws.
    type TaggedPoint = [number, number, number]; // [x, y, cell]
    const segments: { type: Segment; points: TaggedPoint[] }[] = [];
    let currentType: Segment = waterEdges[0] ? "water" : "land";

    // First edge: take the full geometry (both endpoint cell runs).
    let currentPoints = this.extractEdgePoints(cells[0], cells[1], pack.cells.routes[cells[0]]?.[cells[1]], routeById);

    for (let i = 1; i < cells.length - 1; i++) {
      const fromCell = cells[i];
      const toCell = cells[i + 1];
      const type: Segment = waterEdges[i] ? "water" : "land";

      if (type !== currentType) {
        segments.push({ type: currentType, points: currentPoints });
        // New segment shares the boundary point with the previous one.
        currentPoints = [currentPoints[currentPoints.length - 1]];
        currentType = type;
      }

      const edgePoints = this.extractEdgePoints(fromCell, toCell, pack.cells.routes[fromCell]?.[toCell], routeById);
      // The previous edge already emitted fromCell's entire run of points, so skip every leading
      // point that still belongs to fromCell and append only the new toCell geometry. Skipping just
      // one point would re-traverse fromCell's run (very visible on meandering water routes, where
      // the marker appears to spin 180° back and forth across every shared cell).
      let k = 0;
      while (k < edgePoints.length && edgePoints[k][2] === fromCell) k++;
      if (k === 0)
        k = 1; // boundary point wasn't tagged fromCell — skip just it to avoid a duplicate
      else if (k >= edgePoints.length) k = edgePoints.length - 1; // keep at least the final point
      for (; k < edgePoints.length; k++) currentPoints.push(edgePoints[k]);
    }
    segments.push({ type: currentType, points: currentPoints });

    // The goods leave and reach the burgs themselves, a port's straight from its harbor's center: the route's other points
    // in those cells, such as the river course a sea route follows into a river port, would turn the path back on itself
    const [startCell, endCell] = [cells[0], cells[cells.length - 1]];
    const startHarbor = this.getHarbor(startCell, cells[1]);
    const endHarbor = this.getHarbor(endCell, cells[cells.length - 2]);
    const passes = ([, , cell]: TaggedPoint) => cell !== startCell && cell !== startHarbor;
    const reaches = ([, , cell]: TaggedPoint) => cell !== endCell && cell !== endHarbor;
    const at = (cell: number): TaggedPoint[] => (cell === -1 ? [] : [[...pack.cells.p[cell], cell]]);
    const first = segments[0];
    first.points = [
      [...TradeRoutes.getCellPoint(startCell), startCell],
      ...at(startHarbor),
      ...first.points.filter(passes)
    ];
    const last = segments[segments.length - 1];
    last.points = [...last.points.filter(reaches), ...at(endHarbor), [...TradeRoutes.getCellPoint(endCell), endCell]];

    // Flatten segments into a single points array (shared boundary points appear once).
    const points: Point[] = [];
    for (let si = 0; si < segments.length; si++) {
      for (let pk = 0; pk < segments[si].points.length; pk++) {
        if (pk === 0 && si > 0) continue;
        points.push([segments[si].points[pk][0], segments[si].points[pk][1]]);
      }
    }

    return {
      points,
      segments: segments.map(({ type, points }) => ({ type, points: points.map(([x, y]) => [x, y] as Point) }))
    };
  }

  /** The water cell a port burg's goods leave from when the path goes that way, else -1 */
  private getHarbor(burgCell: number, nextCell: number): number {
    const burg = pack.burgs[pack.cells.burg[burgCell]];
    return burg?.port && pack.cells.haven?.[burgCell] === nextCell ? nextCell : -1;
  }

  // Extract the actual rendered points for one route edge (fromCell → toCell), each tagged with the
  // cell it belongs to ([x, y, cellId]). Looks up the stored route geometry so the animation follows
  // the same path the renderer draws. The cell tag lets the caller drop a cell's run once it has
  // already been emitted by the adjacent edge.
  private extractEdgePoints(
    fromCell: number,
    toCell: number,
    routeId: number | undefined,
    routeById: Map<number, { points: number[][] }>
  ): [number, number, number][] {
    const fallback = (): [number, number, number][] => [
      [...TradeRoutes.getCellPoint(fromCell), fromCell] as [number, number, number],
      [...TradeRoutes.getCellPoint(toCell), toCell] as [number, number, number]
    ];

    if (routeId === undefined) return fallback();
    const route = routeById.get(routeId);
    if (!route) return fallback();

    const pts = route.points;
    if (!pts) return fallback();

    for (let i = 0; i < pts.length - 1; i++) {
      const cellA = pts[i][2];
      const cellB = pts[i + 1][2];

      if (cellA === fromCell && cellB === toCell) {
        // Forward direction: include all points belonging to fromCell, then all belonging to toCell.
        let start = i;
        while (start > 0 && pts[start - 1][2] === fromCell) start--;
        let end = i + 1;
        while (end + 1 < pts.length && pts[end + 1][2] === toCell) end++;
        return pts.slice(start, end + 1).map(p => [p[0], p[1], p[2]] as [number, number, number]);
      }

      if (cellA === toCell && cellB === fromCell) {
        // Reverse direction: same slice, reversed.
        let start = i;
        while (start > 0 && pts[start - 1][2] === toCell) start--;
        let end = i + 1;
        while (end + 1 < pts.length && pts[end + 1][2] === fromCell) end++;
        return pts
          .slice(start, end + 1)
          .reverse()
          .map(p => [p[0], p[1], p[2]] as [number, number, number]);
      }
    }

    return fallback();
  }

  getDefaultOptions() {
    return DEFAULT_TRADE_ANIMATION;
  }
}

export const TradeAnimation = new TradeAnimationModule();

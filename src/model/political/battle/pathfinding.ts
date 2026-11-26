// Shortest ways over a grid of nodes, row by row: each node has a cost of the way through it

/**
 * Cost of the way from the sources to every node, in nodes' widths, and the node each is reached from.
 * Read a node's cost by `costTo`: a lazy spread goes on only as far as that node, and `cost` and `from` hold for the
 * nodes it has come to and the ways to them
 */
export interface Reach {
  cost: Float64Array; // doubles: a rounded cost would look improved by an equal way and be spread again
  from: Int32Array;
  costTo: (node: number) => number;
}

const NO_STEPS: number[] = []; // no `closed` mask

// kept for grids of the same content: the generals' rehearsals ask for the same ways again and again
const KEPT_WAYS = 4096;
const KEPT_NEAREST = 8192;
const KEPT_REACHES = 256; // spreads from a node: one for every battalion of a large battle
const KEPT_GRIDS = 512;
const HEAP = 1024;

type NodeValues = Float32Array | Uint16Array;

/** The node by another that a spread comes to, the other itself when it can, and the cost of the way there */
interface Nearest {
  goal: number | null;
  cost: number;
  way?: number[] | null; // the nodes of the way, once asked for
}

class PathfindingModule {
  private readonly leasts = new WeakMap<ArrayLike<number>, number>();
  private readonly parts = new WeakMap<ArrayLike<number>, Map<ArrayLike<number>, Int32Array | null>>(); // by costs and steps shut
  // by the grids' content and the ends, the latest used last
  private readonly ways = new Map<string, number[] | null>();
  private readonly nearest = new Map<string, Nearest>();
  private readonly reaches = new Map<string, Reach>();
  private readonly gridIds = new WeakMap<NodeValues, number>();
  private readonly grids = new Map<number, { grid: NodeValues; id: number }[]>(); // grids by the hash of their content
  private lastGridId = 0;

  /**
   * Spread from the sources over the grid, the cheapest ways first: all of it, or when `lazy` only as far as asked.
   * `costs` is what a node's width of the way costs there; a node of infinite cost cannot be entered.
   * A source may stand where it cannot: it leaves at the cost of the node it steps onto.
   * `closed` shuts single steps, for what is thinner than a node: a bit a neighbour, see `getStepBit`.
   * `toward` is the one node the spread is for: it goes that way first, and costs hold only for the way to it
   */
  spread(
    cols: number,
    rows: number,
    sources: number[],
    costs: ArrayLike<number>,
    closed?: ArrayLike<number>,
    lazy = false,
    toward = -1
  ): Reach {
    // the least a way from a node to `toward` costs: as many nodes' widths as the straight steps, at the cheapest going
    const least = toward < 0 ? 0 : this.getLeast(costs);
    const [goalCol, goalRow] = [toward % cols, Math.floor(toward / cols)];
    const ahead = (node: number): number => {
      if (toward < 0) return 0;
      const dx = Math.abs((node % cols) - goalCol);
      const dy = Math.abs(Math.floor(node / cols) - goalRow);
      return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * least;
    };
    const size = cols * rows;
    const cost = new Float64Array(size).fill(Infinity);
    const from = new Int32Array(size).fill(-1);
    const settled = new Uint8Array(size); // its cost and its way are final: it came off the heap

    // a binary heap of nodes by cost and what is left of the way; a node may be in it more than once, later copies are skipped
    let heapCost = new Float64Array(HEAP); // grown as it fills
    let heapNode = new Int32Array(HEAP);
    let length = 0;
    const push = (value: number, node: number): void => {
      if (length === heapCost.length) {
        const [costs, nodes] = [new Float64Array(length * 2), new Int32Array(length * 2)];
        costs.set(heapCost);
        nodes.set(heapNode);
        [heapCost, heapNode] = [costs, nodes];
      }
      let i = length++;
      while (i) {
        const parent = (i - 1) >> 1;
        if (heapCost[parent] <= value) break;
        heapCost[i] = heapCost[parent];
        heapNode[i] = heapNode[parent];
        i = parent;
      }
      heapCost[i] = value;
      heapNode[i] = node;
    };
    /** Take the cheapest node off the heap; its cost is read before */
    const pop = (): number => {
      const top = heapNode[0];
      length--;
      const value = heapCost[length];
      const node = heapNode[length];
      if (length) {
        let i = 0;
        for (;;) {
          let child = i * 2 + 1;
          if (child >= length) break;
          if (child + 1 < length && heapCost[child + 1] < heapCost[child]) child++;
          if (heapCost[child] >= value) break;
          heapCost[i] = heapCost[child];
          heapNode[i] = heapNode[child];
          i = child;
        }
        heapCost[i] = value;
        heapNode[i] = node;
      }
      return top;
    };

    for (const source of sources) {
      cost[source] = 0;
      push(ahead(source), source);
    }

    /** Spread on till the node is settled, or everywhere */
    const run = (until: number): void => {
      while (length && !(until >= 0 && settled[until])) {
        const node = pop();
        if (settled[node]) continue;
        settled[node] = 1;
        relax(node, cost[node]);
      }
    };

    const relax = (node: number, reached: number): void => {
      const col = node % cols;
      const row = (node - col) / cols;
      const here = costs[node];
      const shut = closed ? closed[node] : 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = col + dx;
          const y = row + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const next = y * cols + x;
          const there = costs[next];
          if (there === Infinity) continue;
          if (shut & this.getStepBit(dx, dy)) continue;
          // no cutting the corner of a node dearer than both ends of the step, nor of one that cannot be entered
          if (dx && dy) {
            const worst = Math.max(here === Infinity ? there : here, there);
            if (costs[row * cols + x] > worst || costs[y * cols + col] > worst) continue;
          }
          const step = ((dx && dy ? Math.SQRT2 : 1) * ((here === Infinity ? there : here) + there)) / 2;
          if (reached + step < cost[next]) {
            cost[next] = reached + step;
            from[next] = node;
            push(cost[next] + ahead(next), next);
          }
        }
      }
    };

    if (!lazy) run(-1);
    // a node in no part of the grid the sources can come to is never spread to in vain
    const parts = lazy ? this.getParts(cols, rows, costs, closed) : null;
    const reached = parts && this.getReachedParts(cols, rows, sources, costs, closed, parts);
    const costTo = (node: number): number => {
      if (!settled[node]) {
        if (reached) {
          const part = parts![node];
          if (part < 0 ? !sources.includes(node) : !reached.includes(part)) return Infinity;
        }
        run(node);
      }
      return cost[node];
    };
    return { cost, from, costTo };
  }

  /**
   * The parts of the grid that can be entered, by the steps `spread` takes: nodes of a part come to one another, and to no
   * other part. Found once for a grid; null when some step is open one way and shut the other
   */
  private getParts(
    cols: number,
    rows: number,
    costs: ArrayLike<number>,
    closed?: ArrayLike<number>
  ): Int32Array | null {
    let known = this.parts.get(costs);
    if (!known) {
      known = new Map();
      this.parts.set(costs, known);
    }
    const found = known.get(closed ?? NO_STEPS);
    if (found !== undefined) return found;
    const parts = new Int32Array(cols * rows).fill(-1);
    const queue = new Int32Array(cols * rows);
    let symmetric = true;
    for (let first = 0; first < parts.length && symmetric; first++) {
      if (parts[first] !== -1 || costs[first] === Infinity) continue;
      parts[first] = first;
      queue[0] = first;
      for (let length = 1, i = 0; i < length && symmetric; i++) {
        const node = queue[i];
        const col = node % cols;
        const row = (node - col) / cols;
        const here = costs[node];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = col + dx;
            const y = row + dy;
            if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const next = y * cols + x;
            const there = costs[next];
            if (there === Infinity) continue;
            if (dx && dy) {
              const worst = Math.max(here, there);
              if (costs[row * cols + x] > worst || costs[y * cols + col] > worst) continue;
            }
            const open = closed ? !(closed[node] & this.getStepBit(dx, dy)) : true;
            const back = closed ? !(closed[next] & this.getStepBit(-dx, -dy)) : true;
            if (open !== back) symmetric = false;
            if (!open || parts[next] !== -1) continue;
            parts[next] = first;
            queue[length++] = next;
          }
        }
      }
    }
    const result = symmetric ? parts : null;
    known.set(closed ?? NO_STEPS, result);
    return result;
  }

  /** The parts of the grid a spread from the sources comes to: their own, and those a source that cannot be entered steps into */
  private getReachedParts(
    cols: number,
    rows: number,
    sources: number[],
    costs: ArrayLike<number>,
    closed: ArrayLike<number> | undefined,
    parts: Int32Array
  ): number[] {
    const reached: number[] = [];
    const reach = (part: number): void => {
      if (!reached.includes(part)) reached.push(part);
    };
    for (const source of sources) {
      if (costs[source] !== Infinity) {
        reach(parts[source]);
        continue;
      }
      const col = source % cols;
      const row = (source - col) / cols;
      const shut = closed ? closed[source] : 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = col + dx;
          const y = row + dy;
          if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const there = costs[y * cols + x];
          if (there === Infinity || shut & this.getStepBit(dx, dy)) continue;
          if (dx && dy && (costs[row * cols + x] > there || costs[y * cols + col] > there)) continue;
          reach(parts[y * cols + x]);
        }
      }
    }
    return reached;
  }

  /**
   * The nodes the sources can come to: what `spread` reaches, found without the costs.
   * `open` marks the nodes that can be entered.
   */
  flood(cols: number, rows: number, sources: number[], open: Uint8Array, closed?: ArrayLike<number>): Uint8Array {
    const reached = new Uint8Array(cols * rows);
    const queue = new Int32Array(cols * rows);
    let length = 0;
    for (const source of sources) {
      if (reached[source]) continue;
      reached[source] = 1;
      queue[length++] = source;
    }
    for (let i = 0; i < length; i++) {
      const node = queue[i];
      const col = node % cols;
      const row = (node - col) / cols;
      const shut = closed ? closed[node] : 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = col + dx;
          const y = row + dy;
          if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const next = y * cols + x;
          if (reached[next] || !open[next] || shut & this.getStepBit(dx, dy)) continue;
          if (dx && dy && (!open[row * cols + x] || !open[y * cols + col])) continue; // no cutting a closed corner
          reached[next] = 1;
          queue[length++] = next;
        }
      }
    }
    return reached;
  }

  /** The cheapest node's width of the way on the grid, at least something */
  private getLeast(costs: ArrayLike<number>): number {
    let least = this.leasts.get(costs);
    if (least === undefined) {
      least = Infinity;
      for (let i = 0; i < costs.length; i++) if (costs[i] < least) least = costs[i];
      this.leasts.set(costs, least === Infinity ? 0 : least);
    }
    return this.leasts.get(costs)!;
  }

  /**
   * The nodes of the cheapest way from one node to another, sought toward it; null when it cannot be come to.
   * The same as `trace` of a `spread` toward the end, kept for grids of the same content
   */
  findWay(
    cols: number,
    rows: number,
    start: number,
    end: number,
    costs: Float32Array,
    closed: Uint16Array
  ): number[] | null {
    const key = this.getKey(cols, rows, start, end, costs, closed);
    return this.recall(this.ways, key, KEPT_WAYS, () => {
      const reach = this.spread(cols, rows, [start], costs, closed, true, end);
      return reach.costTo(end) === Infinity ? null : this.trace(reach, end);
    });
  }

  /**
   * The node a spread from the start comes to by the end: the end itself, else the cheapest within two nodes of it, if any;
   * and the cost of the way there. Kept for grids of the same content
   */
  findNearest(
    cols: number,
    rows: number,
    start: number,
    end: number,
    costs: Float32Array,
    closed: Uint16Array
  ): Nearest {
    const key = this.getKey(cols, rows, start, end, costs, closed);
    return this.recall(this.nearest, key, KEPT_NEAREST, () => {
      const reach = this.getReach(cols, rows, start, costs, closed);
      const goal = this.getNearestNode(cols, rows, reach, end);
      return { goal, cost: goal === null ? Infinity : reach.costTo(goal) };
    });
  }

  /** The nodes of the way to the node `findNearest` finds; null when there is none */
  findNearestWay(
    cols: number,
    rows: number,
    start: number,
    end: number,
    costs: Float32Array,
    closed: Uint16Array
  ): number[] | null {
    const nearest = this.findNearest(cols, rows, start, end, costs, closed);
    if (nearest.way === undefined) {
      const { goal } = nearest;
      nearest.way = goal === null ? null : this.trace(this.getReach(cols, rows, start, costs, closed), goal);
    }
    return nearest.way;
  }

  /** Drop all that is kept: the battles it was found for are over */
  clear(): void {
    this.ways.clear();
    this.nearest.clear();
    this.reaches.clear();
    this.grids.clear();
  }

  /** A lazy spread from a node, shared by all that ask about the same grids */
  private getReach(cols: number, rows: number, start: number, costs: Float32Array, closed: Uint16Array): Reach {
    const key = this.getKey(cols, rows, start, -1, costs, closed);
    return this.recall(this.reaches, key, KEPT_REACHES, () => this.spread(cols, rows, [start], costs, closed, true));
  }

  private getNearestNode(cols: number, rows: number, reach: Reach, node: number): number | null {
    if (reach.costTo(node) !== Infinity) return node;
    let best: number | null = null;
    const col = node % cols;
    const row = (node - col) / cols;
    for (let y = Math.max(row - 2, 0); y <= Math.min(row + 2, rows - 1); y++) {
      for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, cols - 1); x++) {
        const near = y * cols + x;
        if (reach.costTo(near) < (best === null ? Infinity : reach.cost[best])) best = near;
      }
    }
    return best;
  }

  private getKey(
    cols: number,
    rows: number,
    start: number,
    end: number,
    costs: NodeValues,
    closed: NodeValues
  ): string {
    return `${this.getGridId(costs)}|${this.getGridId(closed)}|${cols}|${rows}|${start}|${end}`;
  }

  /** What is kept under the key, made when it is not; the latest used goes last, the longest unused is dropped */
  private recall<T>(kept: Map<string, T>, key: string, most: number, make: () => T): T {
    if (kept.has(key)) {
      const value = kept.get(key)!;
      kept.delete(key);
      kept.set(key, value);
      return value;
    }
    const value = make();
    kept.set(key, value);
    if (kept.size > most) kept.delete(kept.keys().next().value!);
    return value;
  }

  /** A number for the content of a grid: grids that hold the same get the same one */
  private getGridId(grid: NodeValues): number {
    const known = this.gridIds.get(grid);
    if (known !== undefined) return known;
    const words = new Int32Array(grid.buffer, grid.byteOffset, grid.byteLength >> 2);
    let hash = 2166136261 ^ grid.length;
    for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i], 16777619);
    if (this.grids.size >= KEPT_GRIDS) this.grids.clear(); // ids are never reused: a grid seen again only gets a new one
    const alike = this.grids.get(hash) ?? [];
    let id = alike.find(other => this.isSameGrid(other.grid, grid))?.id;
    if (id === undefined) {
      id = ++this.lastGridId;
      alike.push({ grid, id });
      this.grids.set(hash, alike);
    }
    this.gridIds.set(grid, id);
    return id;
  }

  private isSameGrid(a: NodeValues, b: NodeValues): boolean {
    if (a.constructor !== b.constructor || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }

  /** The bit of a step to a neighbour in the `closed` mask of a node */
  getStepBit(dx: number, dy: number): number {
    return 1 << ((dy + 1) * 3 + dx + 1);
  }

  /** Nodes of the way to a node, from the source on; empty when the node is not reached */
  trace({ from, costTo }: Reach, node: number): number[] {
    if (costTo(node) === Infinity) return [];
    const way = [node];
    while (from[way[0]] !== -1) way.unshift(from[way[0]]);
    return way;
  }

  /** Whether the straight way between two points of a grid keeps off the nodes that are in the way */
  isClear(
    cols: number,
    rows: number,
    size: number,
    [x0, y0]: [number, number],
    [x1, y1]: [number, number],
    inWay: (node: number) => boolean
  ): boolean {
    const steps = Math.max(Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (size / 2)), 1);
    let [lastCol, lastRow] = [-1, -1];
    for (let i = 0; i <= steps; i++) {
      const col = Math.min(Math.max(Math.floor((x0 + ((x1 - x0) * i) / steps) / size), 0), cols - 1);
      const row = Math.min(Math.max(Math.floor((y0 + ((y1 - y0) * i) / steps) / size), 0), rows - 1);
      if (inWay(row * cols + col)) return false;
      // no slipping between two nodes in the way that touch at a corner, as `spread` does not
      if (i && col !== lastCol && row !== lastRow && inWay(lastRow * cols + col) && inWay(row * cols + lastCol))
        return false;
      [lastCol, lastRow] = [col, row];
    }
    return true;
  }
}

export const Pathfinding = new PathfindingModule();

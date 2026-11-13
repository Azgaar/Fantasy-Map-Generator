// Shortest ways over a grid of nodes, row by row: each node has a cost of the way through it

/** Cost of the way from the sources to every node, in nodes' widths, and the node each is reached from */
export interface Reach {
  cost: Float64Array; // doubles: a rounded cost would look improved by an equal way and be spread again
  from: Int32Array;
}

/**
 * Spread from the sources over the grid, the cheapest ways first.
 * `costs` is what a node's width of the way costs there; a node of infinite cost cannot be entered.
 * A source may stand where it cannot: it leaves at the cost of the node it steps onto.
 * `closed` shuts single steps, for what is thinner than a node: a bit a neighbour, see `getStepBit`.
 */
export function spread(
  cols: number,
  rows: number,
  sources: number[],
  costs: ArrayLike<number>,
  closed?: ArrayLike<number>
): Reach {
  const size = cols * rows;
  const cost = new Float64Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);

  // a binary heap of nodes by cost; a node may be in it more than once, the dearer copies are skipped
  let heapCost = new Float64Array(size);
  let heapNode = new Int32Array(size);
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
    push(0, source);
  }

  while (length) {
    const reached = heapCost[0];
    const node = pop();
    if (reached > cost[node]) continue;
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
        if (shut & getStepBit(dx, dy)) continue;
        // no cutting the corner of a node dearer than both ends of the step, nor of one that cannot be entered
        if (dx && dy) {
          const worst = Math.max(here === Infinity ? there : here, there);
          if (costs[row * cols + x] > worst || costs[y * cols + col] > worst) continue;
        }
        const step = ((dx && dy ? Math.SQRT2 : 1) * ((here === Infinity ? there : here) + there)) / 2;
        if (reached + step < cost[next]) {
          cost[next] = reached + step;
          from[next] = node;
          push(cost[next], next);
        }
      }
    }
  }

  return { cost, from };
}

/** The bit of a step to a neighbour in the `closed` mask of a node */
export const getStepBit = (dx: number, dy: number): number => 1 << ((dy + 1) * 3 + dx + 1);

/** Nodes of the way to a node, from the source on; empty when the node is not reached */
export function trace({ cost, from }: Reach, node: number): number[] {
  if (cost[node] === Infinity) return [];
  const way = [node];
  while (from[way[0]] !== -1) way.unshift(from[way[0]]);
  return way;
}

/** Whether the straight way between two points of a grid keeps off the nodes that are in the way */
export function isClear(
  cols: number,
  rows: number,
  size: number,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
  inWay: (node: number) => boolean
): boolean {
  const steps = Math.max(Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (size / 2)), 1);
  for (let i = 0; i <= steps; i++) {
    const col = Math.min(Math.max(Math.floor((x0 + ((x1 - x0) * i) / steps) / size), 0), cols - 1);
    const row = Math.min(Math.max(Math.floor((y0 + ((y1 - y0) * i) / steps) / size), 0), rows - 1);
    if (inWay(row * cols + col)) return false;
  }
  return true;
}

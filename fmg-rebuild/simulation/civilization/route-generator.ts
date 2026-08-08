import { Grid } from "../../core/types";
import { Burg } from "./burg-generator";

export interface Route {
  id: number;
  type: "road" | "sea";
  path: number[]; // Cell indices forming the path
}

// A* pathfinder
export function findPath(
  grid: Grid,
  heights: Uint8Array,
  start: number,
  end: number,
  type: "land" | "sea"
): number[] | null {
  const pointsN = heights.length;
  const closedSet = new Uint8Array(pointsN);
  const cameFrom = new Int32Array(pointsN).fill(-1);

  const gScore = new Float32Array(pointsN).fill(Infinity);
  gScore[start] = 0;

  const fScore = new Float32Array(pointsN).fill(Infinity);
  const heuristic = (cell1: number, cell2: number) => {
    const [x1, y1] = grid.points[cell1];
    const [x2, y2] = grid.points[cell2];
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  };
  fScore[start] = heuristic(start, end);

  const openSet = [start];

  while (openSet.length > 0) {
    // Sort openSet by fScore ascending
    openSet.sort((a, b) => fScore[a] - fScore[b]);
    const curr = openSet.shift()!;

    if (curr === end) {
      // Reconstruct path
      const path: number[] = [];
      let temp = curr;
      while (temp !== -1) {
        path.push(temp);
        temp = cameFrom[temp];
      }
      return path.reverse();
    }

    closedSet[curr] = 1;

    const neighbors = grid.cells.c[curr] || [];
    for (const n of neighbors) {
      if (closedSet[n] !== 0) continue;

      // Calculate traversal cost based on route type
      const hFrom = heights[curr];
      const hTo = heights[n];
      let cost = 1.0;

      if (type === "land") {
        if (hTo < 20) {
          cost = 100.0; // penalize water traversal for land routes
        } else {
          cost = 1.0 + Math.abs(hTo - hFrom) * 0.8;
        }
      } else {
        // sea route
        if (hTo >= 20) {
          cost = 80.0; // penalize land traversal for sea routes
        } else {
          cost = 1.0;
        }
      }

      const tentativeG = gScore[curr] + cost;
      if (tentativeG < gScore[n]) {
        cameFrom[n] = curr;
        gScore[n] = tentativeG;
        fScore[n] = tentativeG + heuristic(n, end);
        if (!openSet.includes(n)) {
          openSet.push(n);
        }
      }
    }
  }

  return null;
}

export function generateRoutes(
  grid: Grid,
  heights: Uint8Array,
  burgs: Burg[]
): Route[] {
  const routes: Route[] = [];
  if (burgs.length < 2) return routes;

  let nextRouteId = 1;

  // Connect each burg to its 2 closest neighbors
  for (let i = 0; i < burgs.length; i++) {
    const b1 = burgs[i];
    const neighbors = burgs
      .map((b, idx) => ({ idx, dist: Math.hypot(b.x - b1.x, b.y - b1.y) }))
      .filter(n => n.idx !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);

    for (const n of neighbors) {
      const b2 = burgs[n.idx];
      
      // Determine if they can share a sea lane (both are ports) or road
      const isSea = b1.port > 0 && b2.port > 0;
      const routeType = isSea ? "sea" : "road";

      const path = findPath(grid, heights, b1.cell, b2.cell, isSea ? "sea" : "land");
      if (path && path.length > 2) {
        routes.push({
          id: nextRouteId++,
          type: routeType,
          path
        });
      }
    }
  }

  return routes;
}

import type { Quadtree, QuadtreeInternalNode, QuadtreeLeaf } from "d3";

type QuadtreeNode<T> = QuadtreeInternalNode<T> | QuadtreeLeaf<T>;

interface Quad<T> {
  node: QuadtreeNode<T> | undefined;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Searches a quadtree for all data points within a given radius
 * Based on https://bl.ocks.org/lwthatcher/b41479725e0ff2277c7ac90df2de2b5e
 * @param x - the x coordinate of the search center
 * @param y - the y coordinate of the search center
 * @param radius - the search radius
 * @param tree - the d3 quadtree to search
 * @returns the data points within the radius, closest quadrants first
 */
export const findAllInQuadtree = <T>(x: number, y: number, radius: number, tree: Quadtree<T>): T[] => {
  const root = tree.root();
  const extent = tree.extent();
  if (!root || !extent) return [];

  const getX = tree.x();
  const getY = tree.y();

  const [[ex0, ey0], [ex1, ey1]] = extent;
  const quads: Quad<T>[] = [{ node: root, x0: ex0, y0: ey0, x1: ex1, y1: ey1 }];

  // search bounds
  const x0 = x - radius;
  const y0 = y - radius;
  const x3 = x + radius;
  const y3 = y + radius;
  const radius2 = radius * radius;

  const result: T[] = [];
  const isInternalNode = <T>(node: QuadtreeNode<T>): node is QuadtreeInternalNode<T> => node.length !== undefined;

  let quad = quads.pop();
  while (quad) {
    const { node, x0: x1, y0: y1, x1: x2, y1: y2 } = quad;

    // stop searching if this quadrant can't contain a closer node
    if (!node || x1 > x3 || y1 > y3 || x2 < x0 || y2 < y0) {
      quad = quads.pop();
      continue;
    }

    if (isInternalNode(node)) {
      // bisect the current quadrant
      const xm = (x1 + x2) / 2;
      const ym = (y1 + y2) / 2;

      quads.push(
        { node: node[3], x0: xm, y0: ym, x1: x2, y1: y2 },
        { node: node[2], x0: x1, y0: ym, x1: xm, y1: y2 },
        { node: node[1], x0: xm, y0: y1, x1: x2, y1: ym },
        { node: node[0], x0: x1, y0: y1, x1: xm, y1: ym }
      );

      // visit the closest quadrant first
      const closest = (+(y >= ym) << 1) | +(x >= xm);
      if (closest) {
        const last = quads.length - 1;
        [quads[last], quads[last - closest]] = [quads[last - closest], quads[last]];
      }
    } else {
      // visit this point (and any coincident points sharing the leaf)
      const dx = x - getX(node.data);
      const dy = y - getY(node.data);

      if (dx * dx + dy * dy < radius2) {
        let leaf: QuadtreeLeaf<T> | undefined = node;
        while (leaf) {
          result.push(leaf.data);
          leaf = leaf.next;
        }
      }
    }

    quad = quads.pop();
  }

  return result;
};

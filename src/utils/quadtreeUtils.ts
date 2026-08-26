/**
 * Searches a quadtree for all points within a given radius
 * Based on https://bl.ocks.org/lwthatcher/b41479725e0ff2277c7ac90df2de2b5e
 * @param {number} x - The x coordinate of the search center
 * @param {number} y - The y coordinate of the search center
 * @param {number} radius - The search radius
 * @param {Object} quadtree - The D3 quadtree to search
 * @returns {Array} - An array of found data points within the radius
 */
export const findAllInQuadtree = (x: number, y: number, radius: number, quadtree: any) => {
  let dx: number, dy: number, d2: number;

  const radiusSearchInit = (t: any, radius: number) => {
    t.result = [];
    t.x0 = t.x - radius;
    t.y0 = t.y - radius;
    t.x3 = t.x + radius;
    t.y3 = t.y + radius;
    t.radius = radius * radius;
  };

  const radiusSearchVisit = (t: any, d2: number) => {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      while (t.node) {
        t.result.push(t.node.data);
        t.node.data.selected = true;
        t.node = t.node.next;
      }
    }
  };

  class Quad {
    node: any;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    constructor(node: any, x0: number, y0: number, x1: number, y1: number) {
      this.node = node;
      this.x0 = x0;
      this.y0 = y0;
      this.x1 = x1;
      this.y1 = y1;
    }
  }

  const t: any = {
    x,
    y,
    x0: quadtree._x0,
    y0: quadtree._y0,
    x3: quadtree._x1,
    y3: quadtree._y1,
    quads: [],
    node: quadtree._root
  };
  if (t.node) t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3));
  radiusSearchInit(t, radius);

  var _i = 0;
  t.q = t.quads.pop();
  while (t.q) {
    _i++;

    t.node = t.q.node;
    t.x1 = t.q.x0;
    t.y1 = t.q.y0;
    t.x2 = t.q.x1;
    t.y2 = t.q.y1;

    // Stop searching if this quadrant can't contain a closer node.
    if (!t.node || t.x1 > t.x3 || t.y1 > t.y3 || t.x2 < t.x0 || t.y2 < t.y0) {
      t.q = t.quads.pop();
      continue;
    }

    // Bisect the current quadrant.
    if (t.node.length) {
      t.node.explored = true;
      const xm: number = (t.x1 + t.x2) / 2,
        ym: number = (t.y1 + t.y2) / 2;

      t.quads.push(
        new Quad(t.node[3], xm, ym, t.x2, t.y2),
        new Quad(t.node[2], t.x1, ym, xm, t.y2),
        new Quad(t.node[1], xm, t.y1, t.x2, ym),
        new Quad(t.node[0], t.x1, t.y1, xm, ym)
      );

      // Visit the closest quadrant first.
      t.i = (+(y >= ym) << 1) | +(x >= xm);
      if (t.i) {
        t.q = t.quads[t.quads.length - 1];
        t.quads[t.quads.length - 1] = t.quads[t.quads.length - 1 - t.i];
        t.quads[t.quads.length - 1 - t.i] = t.q;
      }
    }

    // Visit this point. (Visiting coincident points isn't necessary!)
    else {
      dx = x - +quadtree._x.call(null, t.node.data);
      dy = y - +quadtree._y.call(null, t.node.data);
      d2 = dx * dx + dy * dy;
      radiusSearchVisit(t, d2);
    }
    t.q = t.quads.pop();
  }
  return t.result;
};

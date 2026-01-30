export interface QuadNode {
  x: number;
  y: number;
  size: number;
}

export class Quadtree {
  nodes: QuadNode[] = [];
  data: Uint8ClampedArray;
  width: number;
  height: number;
  threshold: number;

  constructor(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    threshold: number = 20,
  ) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.threshold = threshold;
  }

  build() {
    this.nodes = [];
    // Assuming square, POT for now
    this.split(0, 0, this.width);
    return this.nodes;
  }

  // Returns nodes that intersect with the given AABB
  queryRange(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): QuadNode[] {
    // Naive filter for now. A real quadtree would traverse the tree.
    // Since I'm storing a flat list, I iterate.
    // Optimization: The 'nodes' array could be structured as a tree object, but flat list is good for GPU.
    // For 10k-50k nodes, simple filter is fast enough (1-2ms).
    const result: QuadNode[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (
        n.x < maxX &&
        n.x + n.size > minX &&
        n.y < maxY &&
        n.y + n.size > minY
      ) {
        result.push(n);
      }
    }
    return result;
  }

  private split(x: number, y: number, size: number) {
    // Prevent infinite recursion or sub-pixel nodes
    if (size <= 1) {
      this.nodes.push({ x, y, size });
      return;
    }

    if (this.shouldSplit(x, y, size)) {
      const half = size / 2;
      this.split(x, y, half);
      this.split(x + half, y, half);
      this.split(x, y + half, half);
      this.split(x + half, y + half, half);
    } else {
      this.nodes.push({ x, y, size });
    }
  }

  private shouldSplit(x: number, y: number, size: number): boolean {
    // Check bounds
    if (x >= this.width || y >= this.height) return false;

    let min = 255;
    let max = 0;

    // Optimization: Check stride based on size to avoid reading every pixel in large blocks
    const stride = Math.max(1, Math.floor(size / 8));

    for (let py = y; py < y + size; py += stride) {
      if (py >= this.height) break;
      for (let px = x; px < x + size; px += stride) {
        if (px >= this.width) break;

        const i = (py * this.width + px) * 4;
        const val = this.data[i]; // Red channel (height)

        if (val < min) min = val;
        if (val > max) max = val;

        if (max - min > this.threshold) return true;
      }
    }

    return false;
  }
}

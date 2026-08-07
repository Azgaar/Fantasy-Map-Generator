import { Grid } from "../../core/types";
import { createPRNG, PRNG } from "../../core/random";

// Round height value to [0, 100]
function lim(h: number): number {
  return Math.min(Math.max(Math.round(h), 0), 100);
}

// Find grid cell based on x and y coordinates
function findGridCell(x: number, y: number, grid: Grid, width: number, height: number): number {
  return (
    Math.floor(Math.min(y / grid.spacing, grid.cellsY - 1)) * grid.cellsX +
    Math.floor(Math.min(x / grid.spacing, grid.cellsX - 1))
  );
}

// Parse value range like "35-55" or "1" or "2-3"
function getNumberInRange(range: string, rng: PRNG): number {
  if (!range) return 0;
  if (!range.includes("-")) return parseFloat(range);
  const parts = range.split("-");
  const min = parseFloat(parts[0]);
  const max = parseFloat(parts[1]);
  return rng() * (max - min) + min;
}

// Get point in coordinate range like "45-55" of length
function getPointInRange(range: string, length: number, rng: PRNG): number {
  if (range === "all") return rng() * length;
  const parts = range.split("-");
  const min = parseInt(parts[0], 10) / 100 || 0;
  const max = parseInt(parts[1], 10) / 100 || min;
  return rng() * (max - min) * length + min * length;
}

const blobPowerMap: Record<number, number> = {
  1000: 0.93,
  2000: 0.95,
  5000: 0.97,
  10000: 0.98,
  20000: 0.99,
  50000: 0.994,
  100000: 0.9973
};

const linePowerMap: Record<number, number> = {
  1000: 0.75,
  2000: 0.77,
  5000: 0.79,
  10000: 0.81,
  20000: 0.82,
  50000: 0.86,
  100000: 0.93
};

export class HeightmapGenerator {
  heights: Uint8Array;
  grid: Grid;
  width: number;
  height: number;
  blobPower: number;
  linePower: number;
  rng: PRNG;

  constructor(grid: Grid, width: number, height: number, seed: string) {
    this.grid = grid;
    this.width = width;
    this.height = height;
    this.heights = new Uint8Array(grid.points.length);
    this.rng = createPRNG(seed);

    const cells = grid.cellsDesired;
    this.blobPower = blobPowerMap[cells] || 0.98;
    this.linePower = linePowerMap[cells] || 0.81;
  }

  addHill(countStr: string, heightStr: string, rangeX: string, rangeY: string): void {
    const count = getNumberInRange(countStr, this.rng);
    for (let i = 0; i < count; i++) {
      const h = lim(getNumberInRange(heightStr, this.rng));
      let start = 0;
      let limit = 0;
      do {
        const x = getPointInRange(rangeX, this.width, this.rng);
        const y = getPointInRange(rangeY, this.height, this.rng);
        start = findGridCell(x, y, this.grid, this.width, this.height);
        limit++;
      } while (this.heights[start] + h > 90 && limit < 50);

      const change = new Uint8Array(this.heights.length);
      change[start] = h;
      const queue = [start];

      while (queue.length) {
        const q = queue.shift() as number;
        for (const c of this.grid.cells.c[q]) {
          if (change[c] !== 0) continue;
          change[c] = Math.pow(change[q], this.blobPower) * (this.rng() * 0.2 + 0.9);
          if (change[c] > 1) queue.push(c);
        }
      }

      this.heights = this.heights.map((val, idx) => lim(val + change[idx]));
    }
  }

  addPit(countStr: string, heightStr: string, rangeX: string, rangeY: string): void {
    const count = getNumberInRange(countStr, this.rng);
    for (let i = 0; i < count; i++) {
      let h = lim(getNumberInRange(heightStr, this.rng));
      let start = 0;
      let limit = 0;
      do {
        const x = getPointInRange(rangeX, this.width, this.rng);
        const y = getPointInRange(rangeY, this.height, this.rng);
        start = findGridCell(x, y, this.grid, this.width, this.height);
        limit++;
      } while (this.heights[start] < 20 && limit < 50);

      const used = new Uint8Array(this.heights.length);
      const queue = [start];
      while (queue.length) {
        const q = queue.shift() as number;
        h = Math.pow(h, this.blobPower) * (this.rng() * 0.2 + 0.9);
        if (h < 1) break;

        for (const c of this.grid.cells.c[q]) {
          if (used[c] !== 0) continue;
          this.heights[c] = lim(this.heights[c] - h * (this.rng() * 0.2 + 0.9));
          used[c] = 1;
          queue.push(c);
        }
      }
    }
  }

  addRange(countStr: string, heightStr: string, rangeX: string, rangeY: string): void {
    const count = getNumberInRange(countStr, this.rng);
    for (let k = 0; k < count; k++) {
      let h = lim(getNumberInRange(heightStr, this.rng));
      const startX = getPointInRange(rangeX, this.width, this.rng);
      const startY = getPointInRange(rangeY, this.height, this.rng);

      let dist = 0;
      let limit = 0;
      let endX = 0;
      let endY = 0;
      do {
        endX = this.rng() * this.width * 0.8 + this.width * 0.1;
        endY = this.rng() * this.height * 0.7 + this.height * 0.15;
        dist = Math.abs(endY - startY) + Math.abs(endX - startX);
        limit++;
      } while ((dist < this.width / 8 || dist > this.width / 3) && limit < 50);

      const startCellId = findGridCell(startX, startY, this.grid, this.width, this.height);
      const endCellId = findGridCell(endX, endY, this.grid, this.width, this.height);

      const used = new Uint8Array(this.heights.length);
      const getRidgeRange = (cur: number, end: number) => {
        const range = [cur];
        used[cur] = 1;
        while (cur !== end) {
          let min = Infinity;
          let next = cur;
          for (const e of this.grid.cells.c[cur]) {
            if (used[e] !== 0) continue;
            let diff = Math.pow(this.grid.points[end][0] - this.grid.points[e][0], 2) +
                       Math.pow(this.grid.points[end][1] - this.grid.points[e][1], 2);
            if (this.rng() > 0.85) diff = diff / 2;
            if (diff < min) {
              min = diff;
              next = e;
            }
          }
          if (min === Infinity) return range;
          cur = next;
          range.push(cur);
          used[cur] = 1;
        }
        return range;
      };

      const ridge = getRidgeRange(startCellId, endCellId);
      let queue = ridge.slice();
      let stepCount = 0;

      while (queue.length) {
        const frontier = queue.slice();
        queue = [];
        stepCount++;
        for (const idx of frontier) {
          this.heights[idx] = lim(this.heights[idx] + h * (this.rng() * 0.3 + 0.85));
        }
        h = Math.pow(h, this.linePower) - 1;
        if (h < 2) break;

        for (const f of frontier) {
          for (const c of this.grid.cells.c[f]) {
            if (used[c] === 0) {
              queue.push(c);
              used[c] = 1;
            }
          }
        }
      }

      // Add prominences/downhill details
      ridge.forEach((cur: number, d: number) => {
        if (d % 6 !== 0) return;
        for (let l = 0; l < stepCount; l++) {
          let minVal = Infinity;
          let downhill = cur;
          for (const e of this.grid.cells.c[cur]) {
            if (this.heights[e] < minVal) {
              minVal = this.heights[e];
              downhill = e;
            }
          }
          if (downhill === cur) continue;
          this.heights[downhill] = Math.round((this.heights[cur] * 2 + this.heights[downhill]) / 3);
          cur = downhill;
        }
      });
    }
  }

  addTrough(countStr: string, heightStr: string, rangeX: string, rangeY: string): void {
    const count = getNumberInRange(countStr, this.rng);
    for (let k = 0; k < count; k++) {
      let h = lim(getNumberInRange(heightStr, this.rng));
      let startCellId = 0;
      let limit = 0;
      let startX = 0;
      let startY = 0;
      do {
        startX = getPointInRange(rangeX, this.width, this.rng);
        startY = getPointInRange(rangeY, this.height, this.rng);
        startCellId = findGridCell(startX, startY, this.grid, this.width, this.height);
        limit++;
      } while (this.heights[startCellId] < 20 && limit < 50);

      limit = 0;
      let endX = 0;
      let endY = 0;
      let dist = 0;
      do {
        endX = this.rng() * this.width * 0.8 + this.width * 0.1;
        endY = this.rng() * this.height * 0.7 + this.height * 0.15;
        dist = Math.abs(endY - startY) + Math.abs(endX - startX);
        limit++;
      } while ((dist < this.width / 8 || dist > this.width / 2) && limit < 50);

      const endCellId = findGridCell(endX, endY, this.grid, this.width, this.height);
      const used = new Uint8Array(this.heights.length);

      const getRidgeRange = (cur: number, end: number) => {
        const range = [cur];
        used[cur] = 1;
        while (cur !== end) {
          let min = Infinity;
          let next = cur;
          for (const e of this.grid.cells.c[cur]) {
            if (used[e] !== 0) continue;
            let diff = Math.pow(this.grid.points[end][0] - this.grid.points[e][0], 2) +
                       Math.pow(this.grid.points[end][1] - this.grid.points[e][1], 2);
            if (this.rng() > 0.8) diff = diff / 2;
            if (diff < min) {
              min = diff;
              next = e;
            }
          }
          if (min === Infinity) return range;
          cur = next;
          range.push(cur);
          used[cur] = 1;
        }
        return range;
      };

      const ridge = getRidgeRange(startCellId, endCellId);
      let queue = ridge.slice();
      let stepCount = 0;

      while (queue.length) {
        const frontier = queue.slice();
        queue = [];
        stepCount++;
        for (const idx of frontier) {
          this.heights[idx] = lim(this.heights[idx] - h * (this.rng() * 0.3 + 0.85));
        }
        h = Math.pow(h, this.linePower) - 1;
        if (h < 2) break;

        for (const f of frontier) {
          for (const c of this.grid.cells.c[f]) {
            if (used[c] === 0) {
              queue.push(c);
              used[c] = 1;
            }
          }
        }
      }
    }
  }

  addStrait(widthStr: string, direction = "vertical"): void {
    const desiredWidth = Math.min(getNumberInRange(widthStr, this.rng), this.grid.cellsX / 3);
    if (desiredWidth < 1) return;
    const used = new Uint8Array(this.heights.length);
    const vert = direction === "vertical";
    const startX = vert ? Math.floor(this.rng() * this.width * 0.4 + this.width * 0.3) : 5;
    const startY = vert ? 5 : Math.floor(this.rng() * this.height * 0.4 + this.height * 0.3);
    const endX = vert
      ? Math.floor(this.width - startX - this.width * 0.1 + this.rng() * this.width * 0.2)
      : this.width - 5;
    const endY = vert
      ? this.height - 5
      : Math.floor(this.height - startY - this.height * 0.1 + this.rng() * this.height * 0.2);

    const start = findGridCell(startX, startY, this.grid, this.width, this.height);
    const end = findGridCell(endX, endY, this.grid, this.width, this.height);

    const getRidgeRange = (cur: number, end: number) => {
      const range = [];
      while (cur !== end) {
        let min = Infinity;
        let next = cur;
        for (const e of this.grid.cells.c[cur]) {
          let diff = Math.pow(this.grid.points[end][0] - this.grid.points[e][0], 2) +
                     Math.pow(this.grid.points[end][1] - this.grid.points[e][1], 2);
          if (this.rng() > 0.8) diff = diff / 2;
          if (diff < min) {
            min = diff;
            next = e;
          }
        }
        cur = next;
        range.push(cur);
      }
      return range;
    };

    let range = getRidgeRange(start, end);
    const step = 0.1 / desiredWidth;
    for (let i = 0; i < desiredWidth; i++) {
      const remainingWidth = desiredWidth - i;
      const exp = 0.9 - step * remainingWidth;
      const query: number[] = [];
      range.forEach((r: number) => {
        for (const e of this.grid.cells.c[r]) {
          if (used[e] !== 0) continue;
          used[e] = 1;
          query.push(e);
          this.heights[e] = lim(Math.pow(this.heights[e], exp));
          if (this.heights[e] > 100) this.heights[e] = 5;
        }
      });
      range = query;
    }
  }

  modify(range: string, add: number, mult: number, power?: number): void {
    const min = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
    const max = range === "land" || range === "all" ? 100 : +range.split("-")[1];
    const isLand = min === 20;

    this.heights = this.heights.map(h => {
      if (h < min || h > max) return h;
      if (add) h = isLand ? Math.max(h + add, 20) : h + add;
      if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
      if (power) h = isLand ? Math.pow(h - 20, power) + 20 : Math.pow(h, power);
      return lim(h);
    });
  }

  smooth(fr = 2, add = 0): void {
    this.heights = this.heights.map((h, i) => {
      const a = [h];
      this.grid.cells.c[i].forEach((c: number) => {
        a.push(this.heights[c]);
      });
      const mean = a.reduce((sum, v) => sum + v, 0) / a.length;
      if (fr === 1) return mean + add;
      return lim((h * (fr - 1) + mean + add) / fr);
    });
  }

  mask(power = 1): void {
    const fr = power ? Math.abs(power) : 1;
    this.heights = this.heights.map((h, i) => {
      const [x, y] = this.grid.points[i];
      const nx = (2 * x) / this.width - 1;
      const ny = (2 * y) / this.height - 1;
      let distance = (1 - nx * nx) * (1 - ny * ny);
      if (power < 0) distance = 1 - distance;
      const masked = h * distance;
      return lim((h * (fr - 1) + masked) / fr);
    });
  }

  invert(count: number, axes: string): void {
    if (this.rng() > count) return;
    const invertX = axes !== "y";
    const invertY = axes !== "x";
    const { cellsX, cellsY } = this.grid;

    const inverted = this.heights.map((_h: number, i: number) => {
      const x = i % cellsX;
      const y = Math.floor(i / cellsX);
      const nx = invertX ? cellsX - x - 1 : x;
      const ny = invertY ? cellsY - y - 1 : y;
      const invertedI = nx + ny * cellsX;
      return this.heights[invertedI] || 0;
    });

    this.heights = inverted;
  }

  executeTemplate(template: string): Uint8Array {
    const steps = template.split("\n");
    for (const step of steps) {
      const trimmed = step.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const tool = parts[0];
      const a2 = parts[1] || "";
      const a3 = parts[2] || "";
      const a4 = parts[3] || "";
      const a5 = parts[4] || "";

      if (tool === "Hill") this.addHill(a2, a3, a4, a5);
      else if (tool === "Pit") this.addPit(a2, a3, a4, a5);
      else if (tool === "Range") this.addRange(a2, a3, a4, a5);
      else if (tool === "Trough") this.addTrough(a2, a3, a4, a5);
      else if (tool === "Strait") this.addStrait(a2, a3);
      else if (tool === "Mask") this.mask(parseFloat(a2));
      else if (tool === "Invert") this.invert(parseFloat(a2), a3);
      else if (tool === "Add") this.modify(a3, parseFloat(a2), 1);
      else if (tool === "Multiply") this.modify(a3, 0, parseFloat(a2));
      else if (tool === "Smooth") this.smooth(parseFloat(a2));
    }
    return this.heights;
  }
}

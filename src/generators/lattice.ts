// Grid point lattices: rows of `cellsX` slots, one point per slot, so row-and-column readers work on every sampling
import type { Point } from "@/types/global";
import { rn } from "@/utils";

export const SAMPLINGS = ["square", "hexPointy", "hexFlat", "diamond", "triangle"] as const;
export type Sampling = (typeof SAMPLINGS)[number];
export const MAX_JITTER = 0.9; // at 1 neighbouring points can coincide and the Voronoi step drops one of them
export const DEFAULT_JITTER = 0.9; // the classic grid

interface LatticeSettings {
  sampling: Sampling;
  width: number;
  height: number;
  spacing: number;
  jitter: number;
}

interface LatticePoints {
  cellsX: number;
  cellsY: number;
  points: Point[];
  boundary: Point[]; // pseudo-points outside the map, they clip the edge cells but get no cells of their own
}

interface LatticeGraph {
  sampling: Sampling;
  spacing: number;
  cellsX: number;
  cellsY: number;
}

/** slot size and lattice offsets; every slot covers spacing² */
interface LatticeSteps {
  dx: number;
  dy: number;
  rowOffset: number; // odd rows sit this far right of even rows
  triangleShift: number; // triangle centroids sit this far off the row middle
  neighborDistance: number;
}

const SQRT3 = Math.sqrt(3);
const HEX_SIDE = Math.sqrt(2 / SQRT3); // hexagon across-flats width with an area of 1

class LatticeModule {
  getSteps(sampling: Sampling, spacing: number): LatticeSteps {
    if (sampling === "hexPointy") {
      const dx = spacing * HEX_SIDE;
      return { dx, dy: (dx * SQRT3) / 2, rowOffset: dx / 2, triangleShift: 0, neighborDistance: dx };
    }
    if (sampling === "hexFlat") {
      const column = (spacing * HEX_SIDE * SQRT3) / 2; // half-height rows, each holds every other column
      return {
        dx: column * 2,
        dy: (spacing * HEX_SIDE) / 2,
        rowOffset: column,
        triangleShift: 0,
        neighborDistance: spacing * HEX_SIDE
      };
    }
    if (sampling === "diamond") {
      const half = spacing / Math.SQRT2;
      return { dx: spacing * Math.SQRT2, dy: half, rowOffset: half, triangleShift: 0, neighborDistance: spacing };
    }
    if (sampling === "triangle") {
      const side = spacing * Math.sqrt(4 / SQRT3);
      const dy = (side * SQRT3) / 2;
      return { dx: side / 2, dy, rowOffset: 0, triangleShift: dy / 6, neighborDistance: side / SQRT3 };
    }
    return { dx: spacing, dy: spacing, rowOffset: 0, triangleShift: 0, neighborDistance: spacing };
  }

  /** grid points on the sampling lattice, each moved randomly by up to `jitter` × half the neighbour distance */
  placePoints(settings: LatticeSettings, random: () => number): LatticePoints {
    const { sampling, width, height, spacing, jitter } = settings;
    const steps = this.getSteps(sampling, spacing);
    const { dx, dy, rowOffset, triangleShift, neighborDistance } = steps;
    const cellsX = Math.floor((width - rowOffset / 2 + 0.5 * dx - 1e-10) / dx);
    const cellsY = Math.floor((height - triangleShift + 0.5 * dy - 1e-10) / dy);

    // two rolls per point at any jitter keep the random stream after the grid the same.
    // Off the square lattice neighbours sit at an angle, so a point moves within a circle to keep them apart
    const maxJitter = (neighborDistance / 2) * jitter;
    const jitterRange = maxJitter * 2;
    const rollAxis = () => random() * jitterRange - maxJitter;
    const rollJitter = (): Point => {
      if (sampling === "square") return [rollAxis(), rollAxis()];
      const radius = maxJitter * Math.sqrt(random());
      const angle = 2 * Math.PI * random();
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    };
    const clampTo = (value: number, max: number) => Math.max(0, Math.min(value, max));

    const points: Point[] = [];
    for (let row = 0, y = dy / 2; row < cellsY; row++, y += dy) {
      for (let col = 0, x = dx / 2 + this.getRowShift(row, rowOffset); col < cellsX; col++, x += dx) {
        const slotY = triangleShift ? y + this.getTriangleShift(row, col, triangleShift) : y;
        const [jitterX, jitterY] = rollJitter();
        points.push([clampTo(rn(x + jitterX, 2), width), clampTo(rn(slotY + jitterY, 2), height)]);
      }
    }

    const isClassic = sampling === "square" && jitter === DEFAULT_JITTER;
    const boundary = isClassic
      ? this.getEdgePoints(width, height, spacing)
      : this.getLatticeRing(steps, cellsX, cellsY, width, height);
    return { cellsX, cellsY, points, boundary };
  }

  /** the slot the point falls into: the cell itself on a regular square lattice, a close guess otherwise */
  findSlot(x: number, y: number, { sampling, spacing, cellsX, cellsY }: LatticeGraph): number {
    const { dx, dy, rowOffset } = this.getSteps(sampling, spacing);
    const row = Math.max(0, Math.floor(Math.min(y / dy, cellsY - 1)));
    const col = Math.max(0, Math.floor(Math.min((x - this.getRowShift(row, rowOffset)) / dx, cellsX - 1)));
    return row * cellsX + col;
  }

  /** even rows move left and odd rows right by half the offset, so offset lattices stay centred */
  private getRowShift(row: number, rowOffset: number): number {
    return ((row & 1) - 0.5) * rowOffset;
  }

  /** triangle centroids sit below the middle of an upward triangle and above it in a downward one */
  private getTriangleShift(row: number, col: number, shift: number): number {
    return (row + col) & 1 ? -shift : shift;
  }

  /** two rings of lattice slots around the map, only the ones outside it */
  private getLatticeRing(steps: LatticeSteps, cellsX: number, cellsY: number, width: number, height: number): Point[] {
    const { dx, dy, rowOffset, triangleShift } = steps;
    const ring: Point[] = [];

    for (let row = -2; row < cellsY + 2; row++) {
      const inside = row >= 0 && row < cellsY;
      for (let col = -2; col < cellsX + 2; col = inside && col === -1 ? cellsX : col + 1) {
        const x = dx / 2 + col * dx + this.getRowShift(row, rowOffset);
        const y = dy / 2 + row * dy + this.getTriangleShift(row, col, triangleShift);
        if (x <= 0 || y <= 0 || x >= width || y >= height) ring.push([rn(x, 2), rn(y, 2)]);
      }
    }

    return ring;
  }

  /** pseudo-points along the map edge every two spacings: the classic grid's boundary */
  private getEdgePoints(width: number, height: number, spacing: number): Point[] {
    const offset = rn(-1 * spacing);
    const bSpacing = spacing * 2;
    const w = width - offset * 2;
    const h = height - offset * 2;
    const numberX = Math.ceil(w / bSpacing) - 1;
    const numberY = Math.ceil(h / bSpacing) - 1;
    const points: Point[] = [];

    for (let i = 0.5; i < numberX; i++) {
      const x = Math.ceil((w * i) / numberX + offset);
      points.push([x, offset], [x, h + offset]);
    }

    for (let i = 0.5; i < numberY; i++) {
      const y = Math.ceil((h * i) / numberY + offset);
      points.push([offset, y], [w + offset, y]);
    }

    return points;
  }
}

export const Lattice = new LatticeModule();

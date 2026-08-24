import type { Point } from "@/types/global";

export interface MeanderOptions {
  anchors?: Point[];
  bounds?: { height: number; width: number };
  cellCount?: number;
  isWaterCell?: boolean[];
  meandering?: number;
  startStep?: number;
}

const WATER_MEANDER_SCALE = 0.25;
const RELAX_ITERATIONS = 4;

export const meander = (cells: number[], cellPositions: Point[], options: MeanderOptions = {}) => {
  const meandering = options.meandering ?? 0.5;
  const customAnchors = options.anchors;
  const bounds = options.bounds;
  const startStep = options.startStep ?? 10;
  const cellCount = options.cellCount ?? cells.length;
  const isWaterCell = options.isWaterCell;

  const anchorPoints: Point[] = cells.map((cell, index) => {
    if (customAnchors?.[index]) return customAnchors[index];
    if (cell === -1) {
      const previousCell = cells[index - 1];
      const previous: Point = previousCell !== undefined && previousCell >= 0 ? cellPositions[previousCell] : [0, 0];
      return bounds ? projectToNearestEdge(previous, bounds.width, bounds.height) : previous;
    }
    return cellPositions[cell];
  });

  const points: Point[] = [];
  const anchorIndices: number[] = [];
  const lastStep = cells.length - 1;
  let step = startStep;

  for (let index = 0; index <= lastStep; index++, step++) {
    const [startX, startY] = anchorPoints[index];
    anchorIndices.push(points.length);
    points.push([startX, startY]);

    if (index === lastStep) break;

    const nextCell = cells[index + 1];
    if (nextCell === -1) continue;

    const [endX, endY] = anchorPoints[index + 1];
    const distanceSquared = (endX - startX) ** 2 + (endY - startY) ** 2;
    if (distanceSquared <= 25 && cellCount >= 6) continue;

    let offset = meandering + 1 / step + Math.max(meandering - step / 100, 0);
    if (isWaterCell && (isWaterCell[index] || isWaterCell[index + 1])) offset *= WATER_MEANDER_SCALE;
    const angle = Math.atan2(endY - startY, endX - startX);
    const sinOffset = Math.sin(angle) * offset;
    const cosOffset = Math.cos(angle) * offset;

    if (step < 20 && (distanceSquared > 64 || (distanceSquared > 36 && cellCount < 5))) {
      points.push(
        [(startX * 2 + endX) / 3 - sinOffset, (startY * 2 + endY) / 3 + cosOffset],
        [(startX + endX * 2) / 3 + sinOffset / 2, (startY + endY * 2) / 3 - cosOffset / 2]
      );
    } else if (distanceSquared > 25 || cellCount < 6) {
      points.push([(startX + endX) / 2 - sinOffset, (startY + endY) / 2 + cosOffset]);
    }
  }

  relaxAcuteAngles(points, anchorIndices);
  return { anchorIndices, points };
};

const cornerCos = (first: Point, vertex: Point, last: Point): number => {
  const firstX = first[0] - vertex[0];
  const firstY = first[1] - vertex[1];
  const lastX = last[0] - vertex[0];
  const lastY = last[1] - vertex[1];
  const firstLength = Math.hypot(firstX, firstY);
  const lastLength = Math.hypot(lastX, lastY);
  if (firstLength === 0 || lastLength === 0) return -1;
  return (firstX * lastX + firstY * lastY) / (firstLength * lastLength);
};

const reflectAcrossLine = (point: Point, start: Point, end: Point): Point => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return [point[0], point[1]];
  const position = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  const footX = start[0] + position * dx;
  const footY = start[1] + position * dy;
  return [2 * footX - point[0], 2 * footY - point[1]];
};

const relaxAcuteAngles = (points: Point[], anchorIndices: number[]): void => {
  const pointCount = points.length;
  if (pointCount < 3) return;

  const isAnchor = new Uint8Array(pointCount);
  for (const index of anchorIndices) isAnchor[index] = 1;

  const previousAnchor = new Int32Array(pointCount).fill(-1);
  const nextAnchor = new Int32Array(pointCount).fill(-1);
  for (let index = 0, last = -1; index < pointCount; index++) {
    previousAnchor[index] = last;
    if (isAnchor[index]) last = index;
  }
  for (let index = pointCount - 1, last = -1; index >= 0; index--) {
    nextAnchor[index] = last;
    if (isAnchor[index]) last = index;
  }

  const acuteCost = (position: (index: number) => Point, index: number): number => {
    if (index <= 0 || index >= pointCount - 1) return 0;
    return Math.max(cornerCos(position(index - 1), position(index), position(index + 1)), 0);
  };

  for (let iteration = 0; iteration < RELAX_ITERATIONS; iteration++) {
    const snapshot = points.map(point => [point[0], point[1]] as Point);
    const at = (index: number) => snapshot[index];
    let changed = false;

    for (let index = 1; index < pointCount - 1; index++) {
      if (isAnchor[index]) continue;
      const previous = previousAnchor[index];
      const next = nextAnchor[index];
      if (previous < 0 || next < 0) continue;

      const reflected = reflectAcrossLine(snapshot[index], snapshot[previous], snapshot[next]);
      const withReflection = (candidate: number) => (candidate === index ? reflected : snapshot[candidate]);
      const before = acuteCost(at, index - 1) + acuteCost(at, index) + acuteCost(at, index + 1);
      const after =
        acuteCost(withReflection, index - 1) + acuteCost(withReflection, index) + acuteCost(withReflection, index + 1);

      if (after < before - 1e-6) {
        points[index][0] = reflected[0];
        points[index][1] = reflected[1];
        changed = true;
      }
    }

    if (!changed) break;
  }
};

export const projectToNearestEdge = (point: Point, width: number, height: number): Point => {
  const [x, y] = point;
  const minimumDistance = Math.min(y, height - y, x, width - x);
  if (minimumDistance === y) return [x, 0];
  if (minimumDistance === height - y) return [x, height];
  if (minimumDistance === x) return [0, y];
  return [width, y];
};

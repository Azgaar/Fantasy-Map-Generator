import { max } from "d3";
import {
  drawPath,
  drawPoint,
  findClosestCell,
  minmax,
  rn,
  splitInTwo,
} from "../utils";

// Define specific label types
export interface StateLabel {
  i: string;
  type: "state";
  name: string;
  stateId: number;
  points: [number, number][];
  startOffset: number;
  fontSize: number;
  letterSpacing: number;
  transform: string;
}

export interface BurgLabel {
  i: string;
  type: "burg";
  name: string;
  group: string;
  burgId: number;
}

export type Label = StateLabel | BurgLabel | CustomLabel;

export interface CustomLabel {
  i: string;
  type: "custom";
  name: string;
  group?: string;
  points?: [number, number][];
  pathData?: string;
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
  transform?: string;
}

declare global {
  var generateStateLabels: (stateIds?: number[]) => StateLabel[];
  var generateBurgLabels: () => BurgLabel[];
}

interface Ray {
  angle: number;
  length: number;
  x: number;
  y: number;
}

interface AngleData {
  angle: number;
  dx: number;
  dy: number;
}

type PathPoints = [number, number][];

// Constants for raycasting
const ANGLE_STEP = 9; // increase to 15 or 30 to make it faster and more horizontal; decrease to 5 to improve accuracy
const LENGTH_START = 5;
const LENGTH_STEP = 5;
const LENGTH_MAX = 300;

/**
 * Generate label data for state labels
 * @param stateIds - Optional array of specific state IDs to generate labels for
 * @returns Array of state label data objects
 */
function generateStateLabelsData(stateIds?: number[]): StateLabel[] {
  TIME && console.time("generateStateLabels");

  const { cells, states, features } = pack;
  const cellStateIds = cells.state;
  const angles = precalculateAngles(ANGLE_STEP);
  const labels: StateLabel[] = [];

  for (const state of states) {
    if (!state.i || state.removed || state.lock) continue;
    if (stateIds && !stateIds.includes(state.i)) continue;

    const offset = getOffsetWidth(state.cells!);
    const maxLakeSize = state.cells! / 20;
    const [x0, y0] = state.pole!;

    // Generate rays in all directions from state pole
    const rays: Ray[] = angles.map(({ angle, dx, dy }) => {
      const { length, x, y } = raycast({
        stateId: state.i,
        x0,
        y0,
        dx,
        dy,
        maxLakeSize,
        offset,
        cellStateIds,
        features,
        cells,
      });
      return { angle, length, x, y };
    });

    const [ray1, ray2] = findBestRayPair(rays);

    const pathPoints: PathPoints = [
      [ray1.x, ray1.y],
      state.pole!,
      [ray2.x, ray2.y],
    ];
    if (ray1.x > ray2.x) pathPoints.reverse();

    if (DEBUG.stateLabels) {
      drawPoint(state.pole!, { color: "black", radius: 1 });
      drawPath(pathPoints, { color: "black", width: 0.2 });
    }

    // Create label data object
    labels.push({
      i: `stateLabel${state.i}`,
      type: "state",
      name: state.name!, // Will be updated with formatting later
      stateId: state.i,
      points: pathPoints,
      startOffset: 50,
      fontSize: 100,
      letterSpacing: 0,
      transform: "",
    });
  }

  TIME && console.timeEnd("generateStateLabels");
  return labels;
}

/**
 * Generate label data for burg labels
 * @returns Array of burg label data objects
 */
function generateBurgLabelsData(): BurgLabel[] {
  TIME && console.time("generateBurgLabels");

  const labels: BurgLabel[] = [];
  const burgGroups = options.burgs.groups as { name: string; order: number }[];

  for (const { name } of burgGroups) {
    const burgsInGroup = pack.burgs.filter(
      (b) => b.group === name && !b.removed,
    );

    for (const burg of burgsInGroup) {
      labels.push({
        i: `burgLabel${burg.i}`,
        type: "burg",
        name: burg.name!,
        group: name,
        burgId: burg.i!,
      });
    }
  }

  TIME && console.timeEnd("generateBurgLabels");
  return labels;
}

/**
 * Precalculate angle data for raycasting
 */
function precalculateAngles(step: number): AngleData[] {
  const angles: AngleData[] = [];
  const RAD = Math.PI / 180;

  for (let angle = 0; angle < 360; angle += step) {
    const dx = Math.cos(angle * RAD);
    const dy = Math.sin(angle * RAD);
    angles.push({ angle, dx, dy });
  }

  return angles;
}

/**
 * Cast a ray from state pole to find label path endpoints
 */
function raycast({
  stateId,
  x0,
  y0,
  dx,
  dy,
  maxLakeSize,
  offset,
  cellStateIds,
  features,
  cells,
}: {
  stateId: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  maxLakeSize: number;
  offset: number;
  cellStateIds: number[];
  features: any[];
  cells: any;
}): { length: number; x: number; y: number } {
  let ray = { length: 0, x: x0, y: y0 };

  for (let length = LENGTH_START; length < LENGTH_MAX; length += LENGTH_STEP) {
    const [x, y] = [x0 + length * dx, y0 + length * dy];
    // offset points are perpendicular to the ray
    const offset1: [number, number] = [x + -dy * offset, y + dx * offset];
    const offset2: [number, number] = [x + dy * offset, y + -dx * offset];

    if (DEBUG.stateLabels) {
      drawPoint([x, y], {
        color: isInsideState(x, y) ? "blue" : "red",
        radius: 0.8,
      });
      drawPoint(offset1, {
        color: isInsideState(...offset1) ? "blue" : "red",
        radius: 0.4,
      });
      drawPoint(offset2, {
        color: isInsideState(...offset2) ? "blue" : "red",
        radius: 0.4,
      });
    }

    const inState =
      isInsideState(x, y) &&
      isInsideState(...offset1) &&
      isInsideState(...offset2);
    if (!inState) break;
    ray = { length, x, y };
  }

  return ray;

  function isInsideState(x: number, y: number): boolean {
    if (x < 0 || x > graphWidth || y < 0 || y > graphHeight) return false;
    const cellId = findClosestCell(x, y, undefined, pack) as number;

    const feature = features[cells.f[cellId]];
    if (feature.type === "lake")
      return isInnerLake(feature) || isSmallLake(feature);

    return cellStateIds[cellId] === stateId;
  }

  function isInnerLake(feature: { shoreline: number[] }): boolean {
    return feature.shoreline.every(
      (cellId) => cellStateIds[cellId] === stateId,
    );
  }

  function isSmallLake(feature: { cells: number }): boolean {
    return feature.cells <= maxLakeSize;
  }
}

/**
 * Find the best pair of rays for label placement
 */
function findBestRayPair(rays: Ray[]): [Ray, Ray] {
  let bestPair: [Ray, Ray] | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < rays.length; i++) {
    const score1 = rays[i].length * scoreRayAngle(rays[i].angle);

    for (let j = i + 1; j < rays.length; j++) {
      const score2 = rays[j].length * scoreRayAngle(rays[j].angle);
      const pairScore =
        (score1 + score2) * scoreCurvature(rays[i].angle, rays[j].angle);

      if (pairScore > bestScore) {
        bestScore = pairScore;
        bestPair = [rays[i], rays[j]];
      }
    }
  }

  return bestPair!;
}

/**
 * Score ray based on its angle (prefer horizontal)
 */
function scoreRayAngle(angle: number): number {
  const normalizedAngle = Math.abs(angle % 180); // [0, 180]
  const horizontality = Math.abs(normalizedAngle - 90) / 90; // [0, 1]

  if (horizontality === 1) return 1; // Best: horizontal
  if (horizontality >= 0.75) return 0.9; // Very good: slightly slanted
  if (horizontality >= 0.5) return 0.6; // Good: moderate slant
  if (horizontality >= 0.25) return 0.5; // Acceptable: more slanted
  if (horizontality >= 0.15) return 0.2; // Poor: almost vertical
  return 0.1; // Very poor: almost vertical
}

/**
 * Score the curvature between two rays
 */
function scoreCurvature(angle1: number, angle2: number): number {
  const delta = getAngleDelta(angle1, angle2);
  const similarity = evaluateArc(angle1, angle2);

  if (delta === 180) return 1; // straight line: best
  if (delta < 90) return 0; // acute: not allowed
  if (delta < 120) return 0.6 * similarity;
  if (delta < 140) return 0.7 * similarity;
  if (delta < 160) return 0.8 * similarity;

  return similarity;
}

/**
 * Get the delta between two angles
 */
function getAngleDelta(angle1: number, angle2: number): number {
  let delta = Math.abs(angle1 - angle2) % 360;
  if (delta > 180) delta = 360 - delta; // [0, 180]
  return delta;
}

/**
 * Compute arc similarity towards x-axis
 */
function evaluateArc(angle1: number, angle2: number): number {
  const proximity1 = Math.abs((angle1 % 180) - 90);
  const proximity2 = Math.abs((angle2 % 180) - 90);
  return 1 - Math.abs(proximity1 - proximity2) / 90;
}

/**
 * Get offset width based on state size
 */
function getOffsetWidth(cellsNumber: number): number {
  if (cellsNumber < 40) return 0;
  if (cellsNumber < 200) return 5;
  return 10;
}

/**
 * Calculate lines and font ratio for state labels
 */
export function getLinesAndRatio(
  mode: string,
  name: string,
  fullName: string,
  pathLength: number,
): [string[], number] {
  if (mode === "short") return getShortOneLine();
  if (pathLength > fullName.length * 2) return getFullOneLine();
  return getFullTwoLines();

  function getShortOneLine(): [string[], number] {
    const ratio = pathLength / name.length;
    return [[name], minmax(rn(ratio * 60), 50, 150)];
  }

  function getFullOneLine(): [string[], number] {
    const ratio = pathLength / fullName.length;
    return [[fullName], minmax(rn(ratio * 70), 70, 170)];
  }

  function getFullTwoLines(): [string[], number] {
    const lines = splitInTwo(fullName);
    const longestLineLength = max(lines.map((line) => line.length)) || 0;
    const ratio = pathLength / longestLineLength;
    return [lines, minmax(rn(ratio * 60), 70, 150)];
  }
}

/**
 * Check whether multi-lined label is mostly inside the state
 */
export function checkIfLabelFitsState(
  textElement: SVGTextPathElement,
  angleRad: number,
  halfwidth: number,
  halfheight: number,
  stateIds: number[],
  stateId: number,
): boolean {
  const bbox = textElement.getBBox();
  const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];

  const points: [number, number][] = [
    [-halfwidth, -halfheight],
    [+halfwidth, -halfheight],
    [+halfwidth, halfheight],
    [-halfwidth, halfheight],
    [0, halfheight],
    [0, -halfheight],
  ];

  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);
  const rotatedPoints = points.map(([x, y]): [number, number] => [
    cx + x * cos - y * sin,
    cy + x * sin + y * cos,
  ]);

  let pointsInside = 0;
  for (const [x, y] of rotatedPoints) {
    const isInside =
      stateIds[findClosestCell(x, y, undefined, pack) as number] === stateId;
    if (isInside) pointsInside++;
    if (pointsInside > 4) return true;
  }

  return false;
}

// Expose module functions globally
window.generateStateLabels = generateStateLabelsData;
window.generateBurgLabels = generateBurgLabelsData;

export { generateStateLabelsData, generateBurgLabelsData };

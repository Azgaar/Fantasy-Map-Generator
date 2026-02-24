import { findClosestCell } from "../utils/graphUtils";

export interface Ray {
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

interface RaycastParams {
  stateId: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  maxLakeSize: number;
  offset: number;
}

// increase step to 15 or 30 to make it faster and more horizontal
// decrease step to 5 to improve accuracy
const ANGLE_STEP = 9;
export const ANGLES = precalculateAngles(ANGLE_STEP);

const LENGTH_START = 5;
const LENGTH_STEP = 5;
const LENGTH_MAX = 300;

/**
 * Cast a ray from a point in a given direction until it exits a state.
 * Checks both the ray point and offset points perpendicular to it.
 */
export function raycast({
  stateId,
  x0,
  y0,
  dx,
  dy,
  maxLakeSize,
  offset,
}: RaycastParams): { length: number; x: number; y: number } {
  const { cells, features } = pack;
  const stateIds = cells.state;
  let ray = { length: 0, x: x0, y: y0 };

  for (let length = LENGTH_START; length < LENGTH_MAX; length += LENGTH_STEP) {
    const [x, y] = [x0 + length * dx, y0 + length * dy];
    // offset points are perpendicular to the ray
    const offset1: [number, number] = [x + -dy * offset, y + dx * offset];
    const offset2: [number, number] = [x + dy * offset, y + -dx * offset];

    const inState =
      isInsideState(x, y, stateId) &&
      isInsideState(...offset1, stateId) &&
      isInsideState(...offset2, stateId);
    if (!inState) break;
    ray = { length, x, y };
  }

  return ray;

  function isInsideState(x: number, y: number, stateId: number): boolean {
    if (x < 0 || x > graphWidth || y < 0 || y > graphHeight) return false;
    const cellId = findClosestCell(x, y, undefined, pack) as number;

    const feature = features[cells.f[cellId]];
    if (feature.type === "lake")
      return isInnerLake(feature) || isSmallLake(feature);

    return stateIds[cellId] === stateId;
  }

  function isInnerLake(feature: { shoreline: number[] }): boolean {
    return feature.shoreline.every((cellId) => stateIds[cellId] === stateId);
  }

  function isSmallLake(feature: { cells: number }): boolean {
    return feature.cells <= maxLakeSize;
  }
}

/**
 * Score a ray angle based on how horizontal it is.
 * Horizontal rays (0° or 180°) are preferred for label placement.
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
 * Calculate the angle delta between two angles (0-180 degrees).
 */
function getAngleDelta(angle1: number, angle2: number): number {
  let delta = Math.abs(angle1 - angle2) % 360;
  if (delta > 180) delta = 360 - delta; // [0, 180]
  return delta;
}

/**
 * Evaluate how similar the arc between two angles is.
 * Computes proximity of both angles towards the x-axis.
 */
function evaluateArc(angle1: number, angle2: number): number {
  const proximity1 = Math.abs((angle1 % 180) - 90);
  const proximity2 = Math.abs((angle2 % 180) - 90);
  return 1 - Math.abs(proximity1 - proximity2) / 90;
}

/**
 * Score a ray pair based on the delta angle between them and their arc similarity.
 * Penalizes acute angles (<90°), favors straight lines (180°).
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
 * Precompute angles and their vector components for raycast directions.
 * Used to sample rays around a point at regular angular intervals.
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
 * Find the best pair of rays for label placement along a curved path.
 * Prefers horizontal rays and well-separated angles.
 */
export function findBestRayPair(rays: Ray[]): [Ray, Ray] {
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

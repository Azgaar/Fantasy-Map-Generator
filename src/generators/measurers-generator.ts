import type { Point } from "./voronoi";

export type MeasurerType = "Ruler" | "Opisometer" | "RouteOpisometer" | "Planimeter";

export interface Measurer {
  i?: number;
  type: MeasurerType;
  points: Point[];
}

function create(type: MeasurerType, points: Point[]): Measurer {
  ensureMeasurerIds(pack.measurers);
  const measurer: Measurer = { i: getNextMeasurerId(pack.measurers), type, points };
  pack.measurers.push(measurer);
  return measurer;
}

export function ensureMeasurerIds(measurers: Measurer[]): void {
  const used = new Set(measurers.flatMap(measurer => (measurer.i === undefined ? [] : [measurer.i])));
  let next = used.size ? Math.max(...used) + 1 : 0;
  for (const measurer of measurers) {
    if (measurer.i !== undefined) continue;
    while (used.has(next)) next++;
    measurer.i = next;
    used.add(next++);
  }
}

export function getNextMeasurerId(measurers: Measurer[]): number {
  const ids = measurers.flatMap(measurer => (measurer.i === undefined ? [] : [measurer.i]));
  return ids.length ? Math.max(...ids) + 1 : 0;
}

function remove(measurer: Measurer): void {
  const index = pack.measurers.indexOf(measurer);
  if (index !== -1) pack.measurers.splice(index, 1);
}

// default ruler across the largest landmass, created on map generation
function createDefaultRuler(): void {
  TIME && console.time("createDefaultRuler");
  const { features, vertices } = pack;

  const areas = features.map(f => (f.land ? f.area || 0 : -Infinity));
  const largestLand = areas.indexOf(Math.max(...areas));
  const featureVertices = features[largestLand].vertices;

  const MIN_X = 100;
  const MAX_X = graphWidth - 100;
  const MIN_Y = 100;
  const MAX_Y = graphHeight - 100;

  let leftmostVertex: Point = [graphWidth - MIN_X, graphHeight / 2];
  let rightmostVertex: Point = [MIN_X, graphHeight / 2];

  for (const vertex of featureVertices) {
    const [x, y] = vertices.p[vertex];
    if (y < MIN_Y || y > MAX_Y) continue;
    if (x < leftmostVertex[0] && x >= MIN_X) leftmostVertex = [x, y];
    if (x > rightmostVertex[0] && x <= MAX_X) rightmostVertex = [x, y];
  }

  pack.measurers = [];
  create("Ruler", [leftmostVertex, rightmostVertex]);

  TIME && console.timeEnd("createDefaultRuler");
}

export const Measurers = { create, remove, createDefaultRuler };

type MeasurersModule = typeof Measurers;
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var Measurers: MeasurersModule;
}
window.Measurers = Measurers;

import { formatTemperature } from "@/utils/temperature";
import type {
  CircleBatchPrimitive,
  LabelBatchPrimitive,
  LabelRunPrimitive,
  PolygonPathBatchPrimitive,
  PolygonPathPrimitive,
  SceneBounds,
  SceneRevision
} from "../primitives";
import type { ClimateRenderGrid } from "../render-world";

export interface ClimateSceneBounds {
  height: number;
  width: number;
}

export interface TemperatureScene {
  bands: PolygonPathBatchPrimitive;
  labels: LabelBatchPrimitive;
  maximum: number;
  minimum: number;
  step: number;
}

export function buildPrecipitationScene(climate: ClimateRenderGrid, revision: SceneRevision = 0): CircleBatchPrimitive {
  const modifier = (Math.max(1, climate.requestedCells) / 10_000) ** 0.25;
  const circles: Array<{ domainId: number; radius: number; x: number; y: number }> = [];
  for (const cellId of climate.cells.i) {
    const precipitation = climate.cells.prec[cellId];
    const point = climate.points[cellId];
    if (climate.cells.h[cellId] < 20 || !precipitation || !point) continue;
    const radius = Math.round((Math.sqrt(precipitation / 4) / modifier) * 100) / 100;
    if (!Number.isFinite(radius) || radius <= 0) continue;
    circles.push({ domainId: cellId, radius, x: point[0], y: point[1] });
  }

  return {
    bounds: getCircleBounds(circles),
    circles,
    domainIds: circles.map(circle => circle.domainId),
    kind: "circle-batch",
    layer: "precipitation",
    revision
  };
}

export function buildTemperatureScene(
  climate: ClimateRenderGrid,
  bounds: ClimateSceneBounds,
  revision: SceneRevision = 0
): TemperatureScene {
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || !Number.isFinite(bounds.height) || bounds.height <= 0) {
    throw new Error(`Invalid temperature bounds: ${bounds.width}x${bounds.height}`);
  }

  let minimum = 0;
  let maximum = 0;
  if (climate.cells.temp.length) {
    minimum = Infinity;
    maximum = -Infinity;
    for (const temperature of climate.cells.temp) {
      minimum = Math.min(minimum, temperature);
      maximum = Math.max(maximum, temperature);
    }
  }
  const step = Math.max(Math.round(Math.abs(minimum - maximum) / 5), 1);
  const isolines = createRange(minimum + step, maximum, step);
  const checked = new Uint8Array(climate.cells.i.length);
  const contours: Array<{ points: readonly [number, number][]; temperature: number }> = [];
  const labels: LabelRunPrimitive[] = [];

  for (const cellId of climate.cells.i) {
    const temperature = climate.cells.temp[cellId];
    if (checked[cellId] || !isolines.includes(temperature)) continue;
    const start = findBoundaryStart(climate, cellId, temperature);
    if (start === undefined) continue;
    checked[cellId] = 1;

    const isInside = (candidate: number) => climate.cells.temp[candidate] >= temperature;
    const chain = connectBoundary(climate, start, isInside, candidate => {
      if (candidate < checked.length) checked[candidate] = 1;
    });
    const relaxed = chain.filter(
      (vertexId, index) => index % 4 === 0 || climate.vertices.c[vertexId].some(cell => cell >= climate.cells.i.length)
    );
    if (relaxed.length < 6) continue;

    const points = relaxed.map(vertexId => climate.vertices.p[vertexId] as [number, number]);
    contours.push({ points, temperature });
    addTemperatureLabels(labels, points, temperature, bounds, climate.temperatureScale);
  }

  contours.sort((left, right) => left.temperature - right.temperature);
  const polygons: PolygonPathPrimitive[] = [
    {
      domainId: `temperature:base:${minimum}`,
      points: [
        [0, 0],
        [bounds.width, 0],
        [bounds.width, bounds.height],
        [0, bounds.height]
      ],
      role: `base:${minimum}`
    },
    ...contours.map(({ points, temperature }, index) => ({
      domainId: `temperature:${temperature}:${index}`,
      points,
      role: String(temperature)
    }))
  ];
  const sceneBounds: SceneBounds = { maxX: bounds.width, maxY: bounds.height, minX: 0, minY: 0 };

  return {
    bands: {
      bounds: sceneBounds,
      domainIds: polygons.map(polygon => polygon.domainId),
      kind: "polygon-path-batch",
      layer: "temperature",
      polygons,
      revision
    },
    labels: {
      bounds: sceneBounds,
      domainIds: labels.map(label => label.domainId),
      kind: "label-batch",
      labels,
      layer: "temperature",
      revision
    },
    maximum,
    minimum,
    step
  };
}

function createRange(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value < end; value += step) values.push(value);
  return values;
}

function findBoundaryStart(climate: ClimateRenderGrid, cellId: number, temperature: number): number | undefined {
  if (climate.cells.b[cellId]) {
    return climate.cells.v[cellId].find(vertexId =>
      climate.vertices.c[vertexId].some(candidate => candidate >= climate.cells.i.length)
    );
  }
  const neighborIndex = climate.cells.c[cellId].findIndex(
    candidate => climate.cells.temp[candidate] < temperature || !climate.cells.temp[candidate]
  );
  return neighborIndex < 0 ? undefined : climate.cells.v[cellId][neighborIndex];
}

function connectBoundary(
  climate: ClimateRenderGrid,
  start: number,
  isInside: (cellId: number) => boolean,
  markChecked: (cellId: number) => void
): number[] {
  const chain: number[] = [];
  let next = start;
  for (let iteration = 0; iteration <= climate.vertices.c.length; iteration++) {
    const previous = chain.at(-1);
    const current = next;
    chain.push(current);
    const adjacentCells = climate.vertices.c[current];
    adjacentCells.filter(isInside).forEach(markChecked);

    const [c1, c2, c3] = adjacentCells.map(isInside);
    const [v1, v2, v3] = climate.vertices.v[current];
    let candidate: number | undefined;
    if (v1 !== previous && c1 !== c2) candidate = v1;
    else if (v2 !== previous && c2 !== c3) candidate = v2;
    else if (v3 !== previous && c1 !== c3) candidate = v3;
    if (candidate === undefined || candidate >= climate.vertices.c.length || candidate === current) return [];
    next = candidate;
    if (next === start) return chain;
  }
  return [];
}

function addTemperatureLabels(
  labels: LabelRunPrimitive[],
  points: readonly [number, number][],
  temperature: number,
  bounds: ClimateSceneBounds,
  scale: ClimateRenderGrid["temperatureScale"]
): void {
  const horizontalCenter = bounds.width / 2;
  const top = points.reduce((best, point) =>
    point[1] + Math.abs(point[0] - horizontalCenter) / 2 < best[1] + Math.abs(best[0] - horizontalCenter) / 2
      ? point
      : best
  );
  pushLabel(top, "top");

  if (points.length > 20) {
    const bottom = points.reduce((best, point) =>
      point[1] - Math.abs(point[0] - horizontalCenter) / 2 > best[1] - Math.abs(best[0] - horizontalCenter) / 2
        ? point
        : best
    );
    const distanceSquared = (top[0] - bottom[0]) ** 2 + (top[1] - bottom[1]) ** 2;
    if (distanceSquared > 100) pushLabel(bottom, "bottom");
  }

  function pushLabel(point: readonly [number, number], position: string): void {
    if (point[0] < 20 || point[0] > bounds.width - 20 || point[1] < 20 || point[1] > bounds.height - 20) return;
    labels.push({
      anchor: point,
      domainId: `temperature-label:${temperature}:${position}:${labels.length}`,
      role: String(temperature),
      text: formatTemperature(temperature, scale)
    });
  }
}

function getCircleBounds(circles: readonly { radius: number; x: number; y: number }[]): SceneBounds | null {
  if (!circles.length) return null;
  return circles.reduce<SceneBounds>(
    (bounds, circle) => ({
      maxX: Math.max(bounds.maxX, circle.x + circle.radius),
      maxY: Math.max(bounds.maxY, circle.y + circle.radius),
      minX: Math.min(bounds.minX, circle.x - circle.radius),
      minY: Math.min(bounds.minY, circle.y - circle.radius)
    }),
    { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity }
  );
}

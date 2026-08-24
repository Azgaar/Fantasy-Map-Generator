import type { LinePathPrimitive, SceneBounds, SceneRevision } from "../primitives";

export const COORDINATE_STEPS = [0.5, 1, 2, 5, 10, 15, 30] as const;

export interface MapCoordinateExtent {
  latN: number;
  latS: number;
  latT: number;
  lonE: number;
  lonT: number;
  lonW: number;
}

export interface CoordinateRenderState {
  extent: Partial<MapCoordinateExtent>;
  height: number;
  width: number;
}

export interface CoordinateSceneLabel {
  axis: "latitude" | "longitude";
  domainId: string;
  text: string;
  value: number;
  x: number;
  y: number;
}

export interface CoordinateSceneGroup {
  labels: readonly CoordinateSceneLabel[];
  paths: readonly LinePathPrimitive[];
  step: number;
}

export interface CoordinateScene {
  bounds: SceneBounds | null;
  groups: readonly CoordinateSceneGroup[];
  revision: SceneRevision;
  valid: boolean;
}

export function buildCoordinateScene(state: CoordinateRenderState, revision: SceneRevision = 0): CoordinateScene {
  const extent = normalizeExtent(state.extent);
  if (
    !extent ||
    !Number.isFinite(state.width) ||
    state.width <= 0 ||
    !Number.isFinite(state.height) ||
    state.height <= 0
  ) {
    return { bounds: null, groups: [], revision, valid: false };
  }

  const groups = COORDINATE_STEPS.map(step => buildCoordinateGroup(extent, state.width, state.height, step));
  return {
    bounds: { maxX: state.width, maxY: state.height, minX: 0, minY: 0 },
    groups,
    revision,
    valid: true
  };
}

export function selectCoordinateStep(longitudeSpan: number, cameraScale: number): number {
  const goal = longitudeSpan / Math.max(cameraScale, 0.01) / 10;
  return COORDINATE_STEPS.reduce((previous, current) =>
    Math.abs(current - goal) < Math.abs(previous - goal) ? current : previous
  );
}

export function formatCoordinate(value: number, axis: CoordinateSceneLabel["axis"]): string {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value;
  if (!Number.isInteger(normalized)) return "";
  if (normalized === 0) return "0";
  if (axis === "latitude") return `${Math.abs(normalized)}°${normalized < 0 ? "S" : "N"}`;
  return `${Math.abs(normalized)}°${normalized < 0 ? "W" : "E"}`;
}

function buildCoordinateGroup(
  extent: MapCoordinateExtent,
  width: number,
  height: number,
  step: number
): CoordinateSceneGroup {
  const paths: LinePathPrimitive[] = [];
  const labels: CoordinateSceneLabel[] = [];
  for (const longitude of getStepValues(extent.lonW, extent.lonE, step)) {
    const x = ((longitude - extent.lonW) / extent.lonT) * width;
    const domainId = `coordinate:longitude:${step}:${longitude}`;
    paths.push({
      domainId,
      points: [
        [x, 0],
        [x, height]
      ]
    });
    const text = formatCoordinate(longitude, "longitude");
    if (text) labels.push({ axis: "longitude", domainId: `${domainId}:label`, text, value: longitude, x, y: 0 });
  }
  for (const latitude of getStepValues(extent.latS, extent.latN, step)) {
    const y = ((extent.latN - latitude) / extent.latT) * height;
    const domainId = `coordinate:latitude:${step}:${latitude}`;
    paths.push({
      domainId,
      points: [
        [0, y],
        [width, y]
      ]
    });
    const text = formatCoordinate(latitude, "latitude");
    if (text) labels.push({ axis: "latitude", domainId: `${domainId}:label`, text, value: latitude, x: 0, y });
  }
  return { labels, paths, step };
}

function getStepValues(minimum: number, maximum: number, step: number): number[] {
  const start = Math.ceil((minimum - 1e-9) / step);
  const end = Math.floor((maximum + 1e-9) / step);
  const values: number[] = [];
  for (let multiple = start; multiple <= end; multiple++) values.push(roundCoordinate(multiple * step));
  return values;
}

function normalizeExtent(extent: Partial<MapCoordinateExtent>): MapCoordinateExtent | null {
  const values = [extent.latN, extent.latS, extent.latT, extent.lonE, extent.lonT, extent.lonW];
  if (!values.every(value => Number.isFinite(value))) return null;
  const normalized = extent as MapCoordinateExtent;
  if (normalized.latT <= 0 || normalized.lonT <= 0) return null;
  if (normalized.latN <= normalized.latS || normalized.lonE <= normalized.lonW) return null;
  return normalized;
}

function roundCoordinate(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

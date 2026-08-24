export interface ViewportSize {
  height: number;
  width: number;
}

export interface CameraPoint {
  x: number;
  y: number;
}

export interface MapCamera extends ViewportSize {
  scale: number;
  x: number;
  y: number;
}

export const DEFAULT_MAP_CAMERA: Readonly<MapCamera> = {
  height: 1,
  scale: 1,
  width: 1,
  x: 0,
  y: 0
};

export function normalizeCamera(camera: MapCamera): MapCamera {
  return {
    height: normalizeDimension(camera.height),
    scale: Number.isFinite(camera.scale) && camera.scale > 0 ? camera.scale : 1,
    width: normalizeDimension(camera.width),
    x: Number.isFinite(camera.x) ? camera.x : 0,
    y: Number.isFinite(camera.y) ? camera.y : 0
  };
}

export function camerasEqual(left: MapCamera, right: MapCamera): boolean {
  return (
    left.height === right.height &&
    left.scale === right.scale &&
    left.width === right.width &&
    left.x === right.x &&
    left.y === right.y
  );
}

export function screenToWorld(point: CameraPoint, camera: MapCamera): CameraPoint {
  const normalized = normalizeCamera(camera);
  return {
    x: (point.x - normalized.x) / normalized.scale,
    y: (point.y - normalized.y) / normalized.scale
  };
}

export function worldToScreen(point: CameraPoint, camera: MapCamera): CameraPoint {
  const normalized = normalizeCamera(camera);
  return {
    x: point.x * normalized.scale + normalized.x,
    y: point.y * normalized.scale + normalized.y
  };
}

export function clientToViewport(point: CameraPoint, bounds: Pick<DOMRect, "left" | "top">): CameraPoint {
  return { x: point.x - bounds.left, y: point.y - bounds.top };
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

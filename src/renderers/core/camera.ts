export interface ViewportSize {
  height: number;
  width: number;
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

function normalizeDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

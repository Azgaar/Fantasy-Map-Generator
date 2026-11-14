// What part of the battle field is in sight: pure, so the screen and the exports frame a battle the same way

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraField {
  width: number;
  height: number;
  front: number; // a full battalion's
}

export interface CameraTroop {
  x: number;
  y: number;
  width: number;
  depth: number;
  present: boolean; // still on the field: not fled, not destroyed
}

export type CameraMode = "follow" | "field" | "manual";

/** The view in sight, and the framing it eases toward */
export interface Camera {
  view: View;
  target: View;
}

const MARGIN = 2; // battalion fronts round the troops
const LEAST = 6; // battalion fronts the view is wide at the least
const SETTLE = 0.3; // seconds: the view eases most of the way in a second
const STEADY = 0.04; // a framing that moved less than this share of the held one is ignored

export const getFieldView = ({ width, height }: CameraField): View => ({ x: 0, y: 0, width, height });

export const createCamera = (field: CameraField): Camera => ({
  view: getFieldView(field),
  target: getFieldView(field)
});

/** In the field's proportions, inside it, no narrower than a few battalion fronts */
export function clampView(field: CameraField, { x, y, width }: View): View {
  const aspect = field.width / field.height;
  const wide = Math.min(Math.max(width, field.front * LEAST), field.width);
  const high = wide / aspect;
  const left = Math.min(Math.max(x, 0), field.width - wide);
  const top = Math.min(Math.max(y, 0), field.height - high);
  return { x: left, y: top, width: wide, height: high };
}

/** Every battalion on the field, with a margin */
export function frameTroops(field: CameraField, troops: CameraTroop[]): View {
  const present = troops.filter(troop => troop.present);
  if (!present.length) return getFieldView(field);
  const pad = MARGIN * field.front;
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { x, y, width, depth } of present) {
    const reach = Math.max(width, depth) / 2 + pad;
    left = Math.min(left, x - reach);
    top = Math.min(top, y - reach);
    right = Math.max(right, x + reach);
    bottom = Math.max(bottom, y + reach);
  }
  const width = Math.max(right - left, ((bottom - top) * field.width) / field.height);
  const height = (width * field.height) / field.width;
  return clampView(field, { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height });
}

const isNear = (a: View, b: View): boolean =>
  Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < b.width * STEADY &&
  Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < b.height * STEADY &&
  Math.abs(a.width - b.width) < b.width * STEADY;

/** The camera `elapsed` seconds of screen time later, whatever the playback speed */
export function moveCamera(
  camera: Camera,
  field: CameraField,
  troops: CameraTroop[],
  mode: CameraMode,
  elapsed: number
): Camera {
  if (mode === "field") return { view: getFieldView(field), target: getFieldView(field) };
  if (mode === "manual") {
    const view = clampView(field, camera.view);
    return { view, target: view };
  }
  const framed = frameTroops(field, troops);
  const target = isNear(framed, camera.target) ? camera.target : framed;
  const ease = 1 - Math.exp(-Math.max(elapsed, 0) / SETTLE);
  const glide = (from: number, to: number): number => from + (to - from) * ease;
  const { view } = camera;
  const width = glide(view.width, target.width);
  const near = Math.abs(width - target.width) < target.width * 5e-3; // the last bit unseen
  const next = near
    ? target
    : { x: glide(view.x, target.x), y: glide(view.y, target.y), width, height: (width * field.height) / field.width };
  return { view: next, target };
}

/** The view zoomed `factor` times in, keeping the field point under the pointer where it is */
export function zoomView(field: CameraField, view: View, factor: number, [px, py]: [number, number]): View {
  const width = view.width / factor;
  const zoomed = clampView(field, { ...view, width });
  const share = zoomed.width / view.width;
  return clampView(field, { ...zoomed, x: px - (px - view.x) * share, y: py - (py - view.y) * share });
}

/** The view moved by so many field units */
export const panView = (field: CameraField, view: View, dx: number, dy: number): View =>
  clampView(field, { ...view, x: view.x + dx, y: view.y + dy });

/** Battalions as the camera sees them: the fled and the destroyed are off the field */
export const toCameraTroops = (blocks: { x: number; y: number; width: number; depth: number; status: string }[]) =>
  blocks.map(({ x, y, width, depth, status }) => ({
    x,
    y,
    width,
    depth,
    present: status !== "fled" && status !== "destroyed"
  }));

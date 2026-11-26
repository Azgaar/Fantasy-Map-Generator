// What part of the battle field is in sight: pure, so the screen and the exports frame a battle the same way

import type { CameraChoice } from "@/data/battle-options";
import { COLS, ROWS, SURROUND, VIEW_ASPECT } from "@/model/political/battle/battle-scale";

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

export type CameraMode = CameraChoice | "manual";

/** The view in sight, and the framing it eases toward */
export interface Camera {
  view: View;
  target: View;
}

const MARGIN = 2; // battalion fronts round the troops
const LEAST = 6; // battalion fronts the view is wide at the least
const SETTLE = 0.3; // seconds: the view eases most of the way in a second
const STEADY = 0.04; // a framing that moved less than this share of the held one is ignored

class BattleCameraModule {
  /** The scene: the field and the ground drawn round it */
  getSceneBox({ width, height }: CameraField): View {
    const [across, down] = [(width / COLS) * SURROUND[0], (height / ROWS) * SURROUND[1]];
    return { x: -across, y: -down, width: width + across * 2, height: height + down * 2 };
  }

  create(field: CameraField): Camera {
    return {
      view: this.getSceneBox(field),
      target: this.getSceneBox(field)
    };
  }

  /** In the scene's proportions, inside it, no narrower than a few battalion fronts */
  clampView(field: CameraField, { x, y, width }: View): View {
    const whole = this.getSceneBox(field);
    const wide = Math.min(Math.max(width, field.front * LEAST), whole.width);
    const high = wide / VIEW_ASPECT;
    const left = Math.min(Math.max(x, whole.x), whole.x + whole.width - wide);
    const top = Math.min(Math.max(y, whole.y), whole.y + whole.height - high);
    return { x: left, y: top, width: wide, height: high };
  }

  /** Every battalion on the field, with a margin */
  frameTroops(field: CameraField, troops: CameraTroop[]): View {
    const present = troops.filter(troop => troop.present);
    if (!present.length) return this.getSceneBox(field);
    const pad = MARGIN * field.front;
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const { x, y, width, depth } of present) {
      const reach = Math.max(width, depth) / 2 + pad;
      left = Math.min(left, x - reach);
      top = Math.min(top, y - reach);
      right = Math.max(right, x + reach);
      bottom = Math.max(bottom, y + reach);
    }
    const width = Math.max(right - left, (bottom - top) * VIEW_ASPECT);
    const height = width / VIEW_ASPECT;
    return this.clampView(field, { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height });
  }

  private isNear(a: View, b: View): boolean {
    return (
      Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < b.width * STEADY &&
      Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < b.height * STEADY &&
      Math.abs(a.width - b.width) < b.width * STEADY
    );
  }

  /** The camera `elapsed` seconds of screen time later, whatever the playback speed */
  move(camera: Camera, field: CameraField, troops: CameraTroop[], mode: CameraMode, elapsed: number): Camera {
    if (mode === "field") return { view: this.getSceneBox(field), target: this.getSceneBox(field) };
    if (mode === "manual") {
      const view = this.clampView(field, camera.view);
      return { view, target: view };
    }
    const framed = this.frameTroops(field, troops);
    const target = this.isNear(framed, camera.target) ? camera.target : framed;
    const ease = 1 - Math.exp(-Math.max(elapsed, 0) / SETTLE);
    const glide = (from: number, to: number): number => from + (to - from) * ease;
    const { view } = camera;
    const width = glide(view.width, target.width);
    const near = Math.abs(width - target.width) < target.width * 5e-3; // the last bit unseen
    const next = near
      ? target
      : { x: glide(view.x, target.x), y: glide(view.y, target.y), width, height: width / VIEW_ASPECT };
    return { view: next, target };
  }

  /** The view zoomed `factor` times in, keeping the field point under the pointer where it is */
  zoomView(field: CameraField, view: View, factor: number, [px, py]: [number, number]): View {
    const width = view.width / factor;
    const zoomed = this.clampView(field, { ...view, width });
    const share = zoomed.width / view.width;
    return this.clampView(field, { ...zoomed, x: px - (px - view.x) * share, y: py - (py - view.y) * share });
  }

  /** The view moved by so many field units */
  panView(field: CameraField, view: View, dx: number, dy: number): View {
    return this.clampView(field, { ...view, x: view.x + dx, y: view.y + dy });
  }

  /** Battalions as the camera sees them: the fled and the destroyed are off the field */
  toCameraTroops(battalions: { x: number; y: number; width: number; depth: number; status: string }[]) {
    return battalions.map(({ x, y, width, depth, status }) => ({
      x,
      y,
      width,
      depth,
      present: status !== "fled" && status !== "destroyed"
    }));
  }
}

export const BattleCamera = new BattleCameraModule();

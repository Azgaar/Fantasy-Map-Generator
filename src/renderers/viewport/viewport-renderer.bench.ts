// @vitest-environment jsdom
import { bench, describe } from "vitest";
import { ViewportRenderer } from "./viewport-renderer";

// vitest.dev/api/vi#vi-stubglobal isn't needed here: we just want rAF to run synchronously
// so schedule()'s pending render is observable within the same tick.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0);
  return 0;
}) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = () => {};

const LABEL_COUNT = 5000;
const GESTURE_FRAMES = 60; // ~1s of wheel-zoom at 60fps

// Mirrors the cost shape of labels-renderer's reconcileGroup: scan every label and
// filter to what's visible in the current bounds.
function makeLabels(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i, x: (i * 37) % 2000, y: (i * 53) % 2000 }));
}

function createRenderer(overscanPixels: number, guardPixels: number) {
  const scale = 1;
  let x = 0;
  let y = 0;
  const width = 1000;
  const height = 600;

  const renderer = new ViewportRenderer({
    getViewport: () => ({ scale, x, y, width, height }),
    overscanPixels,
    guardPixels
  });

  const labels = makeLabels(LABEL_COUNT);
  renderer.register({
    id: "labels",
    render: context => {
      const { x0, y0, x1, y1 } = context.bounds;
      labels.filter(label => label.x >= x0 && label.x <= x1 && label.y >= y0 && label.y <= y1);
    }
  });

  return {
    renderer,
    pan: (dx: number, dy: number) => {
      x += dx;
      y += dy;
    }
  };
}

describe("ViewportRenderer during a zoom/pan gesture", () => {
  bench("reconcile on every guard-band escape (pre-#1599 per-frame behavior)", () => {
    const { renderer, pan } = createRenderer(80, 40);
    for (let frame = 0; frame < GESTURE_FRAMES; frame++) {
      pan(50, 0); // steady drift, crossing the guard band repeatedly over the gesture
      renderer.schedule();
    }
  });

  bench("reconcile once at gesture end (#1599 behavior)", () => {
    const { renderer, pan } = createRenderer(80, 40);
    for (let frame = 0; frame < GESTURE_FRAMES; frame++) {
      pan(50, 0);
    }
    renderer.renderNow();
  });
});

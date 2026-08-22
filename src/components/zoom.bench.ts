// @vitest-environment jsdom

// Drives the real zoom.ts + ViewportRenderer pipeline through a synthetic pan gesture
// (mousedown/mousemove.../mouseup dispatched on jsdom), the same code path a real drag
// takes. Guards the fix in PR #1599 (github.com/Azgaar/Fantasy-Map-Generator/pull/1599):
// every guard-band escape during a gesture used to re-run the viewport reconcile, so a
// long drag recalculated labels many times over instead of once at the end.
import { bench, describe, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: () => {}, isOn: () => true, has: () => false } }));
vi.mock("@/renderers/draw-emblems", () => ({ redrawEmblemGroup: () => {} }));

import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { applyZoomBehavior } from "./zoom";

const LABEL_COUNT = 5000;
const GESTURE_MOVES = 30; // ~0.5s of a mouse-drag pan at 60fps

function makeLabels(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i, x: (i * 37) % 2000, y: (i * 53) % 2000 }));
}

function setUpDom() {
  document.body.innerHTML = /* html */ `
    <svg id="map">
      <g id="viewbox"></g>
      <g id="labels"></g>
      <g id="emblems" style="display: none"></g>
      <g id="statesHalo"></g>
      <g id="markers"></g>
    </svg>
    <select id="shapeRendering"><option value="optimizeSpeed" selected></option></select>
  `;
  const map = document.getElementById("map")!;
  Object.defineProperties(map, {
    width: { value: { baseVal: { value: 1000 } } },
    height: { value: { baseVal: { value: 600 } } }
  });
  Object.assign(globalThis, {
    scale: 1,
    viewX: 0,
    viewY: 0,
    svgWidth: 1000,
    svgHeight: 600,
    customization: 0,
    options: { labels: { resizeOnZoom: false } },
    pack: { markers: [] }
  });
}

// jsdom's MouseEventInit.view WebIDL check rejects `window` as "not of type Window" under
// vitest's jsdom pool (a realm mismatch), so construct without `view` and patch it after.
function mouseEvent(type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "view", { value: window, configurable: true });
  return event;
}

function runPanGesture(labels: ReturnType<typeof makeLabels>) {
  let rafQueue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    rafQueue = [];
  });
  const flushRAF = () => {
    const queue = rafQueue;
    rafQueue = [];
    for (const cb of queue) cb(0);
  };

  const handle = ViewportLayers.register({
    id: "bench-labels",
    render: context => {
      const { x0, y0, x1, y1 } = context.bounds;
      labels.filter(label => label.x >= x0 && label.x <= x1 && label.y >= y0 && label.y <= y1);
    }
  });

  applyZoomBehavior();
  const map = document.getElementById("map")!;

  map.dispatchEvent(mouseEvent("mousedown", 500, 300));
  flushRAF();

  for (let i = 1; i <= GESTURE_MOVES; i++) {
    window.dispatchEvent(mouseEvent("mousemove", 500 - i * 15, 300));
    flushRAF();
    vi.advanceTimersByTime(16);
  }
  window.dispatchEvent(mouseEvent("mouseup", 500 - GESTURE_MOVES * 15, 300));
  flushRAF();

  handle.unregister();
}

describe("zoom pan gesture reconcile cost", () => {
  const labels = makeLabels(LABEL_COUNT);

  bench(
    "reconcile viewport layers via a full drag gesture",
    () => {
      setUpDom();
      runPanGesture(labels);
    },
    {
      setup: () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      },
      teardown: () => {
        vi.useRealTimers();
      }
    }
  );
});

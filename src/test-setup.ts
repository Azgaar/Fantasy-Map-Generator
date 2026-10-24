import { log } from "@/utils/logger";

// Make window === globalThis, as in the browser, for modules that touch window in Node
if (typeof window === "undefined") {
  (globalThis as Record<string, unknown>).window = globalThis;
}

// Stub DOM Node so utils/index.ts can patch its prototype without crashing.
// Must be a real class: vitest matchers (e.g. toContain) do `instanceof Node`,
// which throws "Right-hand side of 'instanceof' is not callable" on a plain object.
if (typeof Node === "undefined") {
  class NodeStub {
    addEventListener() {}
    removeEventListener() {}
  }
  (globalThis as Record<string, unknown>).Node = NodeStub;
}

// Stub document so utils/index.ts DOMContentLoaded guard doesn't crash
if (typeof document === "undefined") {
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null
  };
}

// jsdom implements no layout, so Range never got getBoundingClientRect/getClientRects; Quill's
// focus/scroll-into-view path calls them, so stub a zero-size DOMRect (jsdom-specific gap, see
// https://github.com/jsdom/jsdom/issues/3729)
if (typeof Range !== "undefined" && typeof Range.prototype.getBoundingClientRect !== "function") {
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({})
  });
  Range.prototype.getBoundingClientRect = zeroRect;
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {}
    }) as unknown as DOMRectList;
}

// Tests run silent; a test that checks a log turns its level back on
Object.assign(log.enabled, { time: false, info: false, warn: false, error: false });

// The configuration global the app installs at boot, so a unit test gets the same defaults. The
// model is loaded last and dynamically: it reaches the modules that own each default, and those
// expect the stubs above to be in place
const { Options } = await import("@/model/options/options-model");

(globalThis as Record<string, unknown>).options ??= Options.getDefaultOptions();

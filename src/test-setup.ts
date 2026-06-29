// Make window === globalThis so module side-effects (window.rn = ...) work in Node
if (typeof window === "undefined") {
  (globalThis as Record<string, unknown>).window = globalThis;
}

// Stub DOM Node so utils/index.ts can patch its prototype without crashing
if (typeof Node === "undefined") {
  (globalThis as Record<string, unknown>).Node = {
    prototype: {
      addEventListener: () => {},
      removeEventListener: () => {}
    }
  };
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

// Stub the tooltip globals (defined in classic ui/general.js) so the registry's
// lazy-load loading tip doesn't throw outside the browser
if (typeof globalThis.tip === "undefined") {
  (globalThis as Record<string, unknown>).tip = () => {};
}
if (typeof globalThis.clearMainTip === "undefined") {
  (globalThis as Record<string, unknown>).clearMainTip = () => {};
}

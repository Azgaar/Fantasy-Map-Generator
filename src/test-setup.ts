// Make window === globalThis so module side-effects (window.rn = ...) work in Node
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

// Stub the tooltip globals (registered by services/tooltips) so the registry's
// lazy-load loading tip doesn't throw outside the browser
if (typeof window.tip === "undefined") {
  window.tip = () => {};
}
if (typeof window.clearMainTip === "undefined") {
  window.clearMainTip = () => {};
}

// Logging flags declared in public/main.js and referenced bare by bundled modules
for (const flag of ["INFO", "TIME", "ERROR", "WARN", "DEBUG"]) {
  if (typeof (globalThis as Record<string, unknown>)[flag] === "undefined") {
    (globalThis as Record<string, unknown>)[flag] = false;
  }
}

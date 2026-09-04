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

// Logging flags owned by services/logging.ts and referenced bare by bundled modules
for (const flag of ["INFO", "TIME", "ERROR", "WARN", "DEBUG"]) {
  if (typeof (globalThis as Record<string, unknown>)[flag] === "undefined") {
    (globalThis as Record<string, unknown>)[flag] = false;
  }
}

// The configuration globals the app installs at boot, so a unit test gets the same defaults. The
// models are loaded last and dynamically: they reach the modules that own each default, and those
// expect the stubs above to be in place
const { getDefaultFacts } = await import("@/components/facts-model");
const { getDefaultOptions } = await import("@/components/options-model");

(globalThis as Record<string, unknown>).facts ??= getDefaultFacts();
(globalThis as Record<string, unknown>).options ??= getDefaultOptions();

// Those imports pull in the real tooltip module, which needs a DOM node no unit test renders.
// A test that wants the real one imports it itself, and that assignment lands after this
window.tip = () => {};
window.clearMainTip = () => {};

// Node stand-ins for the browser globals the economy modules touch at load, as src/test-setup.ts does
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.Node ??= class {
  addEventListener() {}
  removeEventListener() {}
};
g.document ??= {
  readyState: "complete",
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null
};
g.localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

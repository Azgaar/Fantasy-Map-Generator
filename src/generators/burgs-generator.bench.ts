// @vitest-environment jsdom
import { bench, describe } from "vitest";

// Builds a synthetic, fully-populated square grid of `cellCount` cells so
// Burgs.generate() has to run its real capital/town placement search
// (score sort + quadtree spacing search) at increasing scale. No rivers or
// coastline are set up, since we only want to stress the placement search
// itself, not the (already covered) port-assignment logic in
// burgs-generator.test.ts.
function buildSyntheticPack(cellCount: number) {
  const side = Math.ceil(Math.sqrt(cellCount));
  const p: [number, number][] = [];
  const s: number[] = [];
  const culture: number[] = [];
  const h: number[] = [];
  const g: number[] = [];
  const r: number[] = [];
  const fl: number[] = [];
  const f: number[] = [];
  const haven: number[] = [];
  const harbor: number[] = [];
  const v: number[][] = [];

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      p.push([x * 4, y * 4]);
      s.push(5 + ((x * 7 + y * 13) % 20)); // varied suitability score
      culture.push(1);
      h.push(25);
      g.push(0);
      r.push(0);
      fl.push(0);
      f.push(1);
      haven.push(0);
      harbor.push(0);
      v.push([]);
    }
  }

  return {
    cells: { p, s, culture, h, g, r, fl, f, haven, harbor, v, i: p.map((_, i) => i), burg: undefined as any },
    features: [null, { i: 1, type: "island" }],
    vertices: { c: [], p: [] },
    rivers: [] as any[],
    cultures: [null, { base: 0 }] as any[],
    burgs: [] as any[]
  };
}

function setupDom(statesNumber: number) {
  document.body.innerHTML = /* html */ `
    <input id="statesNumber" type="number" value="${statesNumber}" />
    <input id="manorsInput" type="number" value="1000" />
  `;
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  globalThis.WARN = false;
  await import("./names-generator");
  await import("./features");
  await import("./river-generator");
  await import("./burgs-generator");
  return (globalThis as any).Burgs;
}

function primePack(cellCount: number, statesNumber: number) {
  (globalThis as unknown as { graphWidth: number }).graphWidth = Math.ceil(Math.sqrt(cellCount)) * 4;
  (globalThis as unknown as { graphHeight: number }).graphHeight = Math.ceil(Math.sqrt(cellCount)) * 4;
  const synthetic = buildSyntheticPack(cellCount);
  globalThis.grid = { points: synthetic.cells.p, cells: { temp: new Array(cellCount).fill(20) } } as any;
  globalThis.pack = synthetic as unknown as typeof globalThis.pack;
  setupDom(statesNumber);
}

describe("Burgs.generate", async () => {
  const Burgs = await setupModule();

  bench(
    "small map (2,500 cells, 10 states)",
    () => {
      Burgs.generate();
    },
    {
      iterations: 20,
      setup: () => primePack(2_500, 10)
    }
  );

  bench(
    "medium map (10,000 cells, 20 states)",
    () => {
      Burgs.generate();
    },
    {
      iterations: 10,
      setup: () => primePack(10_000, 20)
    }
  );

  bench(
    "large map (30,000 cells, 40 states)",
    () => {
      Burgs.generate();
    },
    {
      iterations: 5,
      setup: () => primePack(30_000, 40)
    }
  );
});

import { BufferAttribute, BufferGeometry } from "three";
import { bench, describe } from "vitest";
import { RELIEF_SYMBOLS } from "../config/relief-config";
import type { ReliefIcon } from "../modules/relief-generator";

// Standalone geometry harness — mirrors production buildSetMesh() without modifying source.
// BufferGeometry and BufferAttribute are pure-JS objects; no GPU/WebGL context required.
function buildSetMeshBench(
  entries: Array<{ icon: ReliefIcon; tileIndex: number }>,
  set: string,
): BufferGeometry {
  const ids = RELIEF_SYMBOLS[set] ?? [];
  const n = ids.length || 1;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const positions = new Float32Array(entries.length * 4 * 3);
  const uvs = new Float32Array(entries.length * 4 * 2);
  const indices = new Uint32Array(entries.length * 6);
  let vi = 0;
  let ii = 0;
  for (const { icon: r, tileIndex } of entries) {
    const col = tileIndex % cols;
    const row = Math.floor(tileIndex / cols);
    const u0 = col / cols;
    const u1 = (col + 1) / cols;
    const v0 = row / rows;
    const v1 = (row + 1) / rows;
    const x0 = r.x;
    const x1 = r.x + r.s;
    const y0 = r.y;
    const y1 = r.y + r.s;
    const base = vi;
    positions.set([x0, y0, 0], vi * 3);
    uvs.set([u0, v0], vi * 2);
    vi++;
    positions.set([x1, y0, 0], vi * 3);
    uvs.set([u1, v0], vi * 2);
    vi++;
    positions.set([x0, y1, 0], vi * 3);
    uvs.set([u0, v1], vi * 2);
    vi++;
    positions.set([x1, y1, 0], vi * 3);
    uvs.set([u1, v1], vi * 2);
    vi++;
    indices.set([base, base + 1, base + 3, base, base + 3, base + 2], ii);
    ii += 6;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(new BufferAttribute(indices, 1));
  return geo;
}

function makeIcons(n: number): Array<{ icon: ReliefIcon; tileIndex: number }> {
  return Array.from({ length: n }, (_, i) => ({
    icon: {
      i,
      href: "#relief-mount-1",
      x: (i % 100) * 10,
      y: Math.floor(i / 100) * 10,
      s: 8,
    },
    tileIndex: i % 9,
  }));
}

describe("draw-relief-icons geometry build benchmarks", () => {
  bench("buildSetMesh — 1,000 icons (NFR-P1 proxy)", () => {
    buildSetMeshBench(makeIcons(1000), "simple");
  });

  bench("buildSetMesh — 10,000 icons (NFR-P2 proxy)", () => {
    buildSetMeshBench(makeIcons(10000), "simple");
  });
});

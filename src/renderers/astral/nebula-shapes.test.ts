import { describe, expect, test } from "vitest";
import { getNebulae, NEBULA_GROUPS } from "./nebula-shapes";

const PARAMS = { width: 1440, height: 900, count: 4, size: 18, seed: "nebula-test", filters: true };

describe("nebula shapes", () => {
  test("one cluster per count, each into one gas palette", () => {
    const clusters = getNebulae(PARAMS);
    expect(clusters).toHaveLength(PARAMS.count);
    for (const cluster of clusters) {
      expect(NEBULA_GROUPS).toContain(cluster.group);
      expect(cluster.ellipses.length).toBeGreaterThanOrEqual(5);
      expect(cluster.ellipses.length).toBeLessThanOrEqual(9);
    }
  });

  test("stays on the map and keeps positive radii", () => {
    for (const { ellipses } of getNebulae(PARAMS)) {
      for (const { cx, cy, rx, ry, opacity } of ellipses) {
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThanOrEqual(PARAMS.width);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThanOrEqual(PARAMS.height);
        expect(rx).toBeGreaterThan(0);
        expect(ry).toBeGreaterThan(0);
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  test("is deterministic for a seed and differs between seeds", () => {
    expect(getNebulae(PARAMS)).toEqual(getNebulae(PARAMS));
    expect(getNebulae(PARAMS)).not.toEqual(getNebulae({ ...PARAMS, seed: "other-seed" }));
  });

  test("names a filter per cluster, or none in the speed preset", () => {
    for (const [index, cluster] of getNebulae(PARAMS).entries())
      expect(cluster.filter).toBe(`url(#nebulae-filter-${index})`);
    for (const cluster of getNebulae({ ...PARAMS, filters: false })) expect(cluster.filter).toBe("");
  });

  test("draws nothing for a zero count", () => {
    expect(getNebulae({ ...PARAMS, count: 0 })).toEqual([]);
  });
});

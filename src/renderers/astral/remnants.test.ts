import { describe, expect, it } from "vitest";
import type { ReliefIcon, ReliefIconRef } from "@/generators/relief-generator";
import { collectRemnants, isMountFamily, remnantClass } from "./remnants";

describe("remnant classification", () => {
  it("keeps the mount family and drops everything else", () => {
    const ref = (type: ReliefIconRef["type"]) => ({ type, x: 0, y: 0, s: 1 });
    expect(isMountFamily(ref("mount"))).toBe(true);
    expect(isMountFamily(ref("mountSnow"))).toBe(true);
    expect(isMountFamily(ref("vulcan"))).toBe(true);
    expect(isMountFamily(ref("hill"))).toBe(false);
    expect(isMountFamily(ref("conifer"))).toBe(false);
    expect(isMountFamily({ icon: "any-icon", x: 0, y: 0, s: 1 } as ReliefIcon)).toBe(false);
  });

  it("reads the class off the elevation ladder", () => {
    expect(remnantClass(80)).toBe("blackHole");
    expect(remnantClass(100)).toBe("blackHole");
    expect(remnantClass(79)).toBe("pulsar");
    expect(remnantClass(70)).toBe("pulsar");
    expect(remnantClass(69)).toBe("neutron");
    expect(remnantClass(20)).toBe("neutron");
  });

  it("collects one remnant per mount icon from the height under its centre", () => {
    const relief = [
      { type: "mount", x: 10, y: 20, s: 4 }, // centre 12,22 → cell 1 (h 85 → blackHole)
      { type: "hill", x: 40, y: 40, s: 4 }, // not the mount family
      { type: "mountSnow", x: 50, y: 50, s: 4 }, // centre 52,52 → cell 2 (h 72 → pulsar)
      { type: "vulcan", x: 70, y: 70, s: 4 }, // centre 72,72 → cell 3 (h 30 → neutron)
      { type: "mount", x: 90, y: 90, s: 4 } // centre 92,92 → no cell: off the graph
    ] as ReliefIcon[];

    const seen: [number, number][] = [];
    const cellAt = (x: number, y: number): number | undefined => {
      seen.push([x, y]);
      if (x === 12 && y === 22) return 1;
      if (x === 52 && y === 52) return 2;
      if (x === 72 && y === 72) return 3;
      return undefined;
    };

    expect(collectRemnants(relief, cellAt, [0, 85, 72, 30])).toEqual([
      { index: 0, x: 12, y: 22, cls: "blackHole" },
      { index: 2, x: 52, y: 52, cls: "pulsar" },
      { index: 3, x: 72, y: 72, cls: "neutron" }
    ]);
    expect(seen).toHaveLength(4); // the hill is filtered before its cell is ever resolved
  });

  it("finds nothing on a map with no mountains", () => {
    const relief = [
      { type: "hill", x: 0, y: 0, s: 1 },
      { icon: "palm", x: 0, y: 0, s: 1 }
    ] as ReliefIcon[];
    expect(collectRemnants(relief, () => 0, [50])).toEqual([]);
  });
});

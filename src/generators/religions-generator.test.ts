import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Religion } from "./religions-generator";

interface TestableReligionsModule {
  add(center: number): void;
  combineReligions(namedReligions: Religion[], lockedReligions: Religion[]): Religion[];
  createHeresy(parent: Religion, center: number, i: number, codes: string[]): Religion;
  defineOrigins(religionIds: Uint16Array, indexedReligions: Religion[]): Religion[];
  generateHeresies(religions: Religion[], religionIds: Uint16Array): Religion[];
  generateReligionName(variety: string, form: string, deity: string, center: number): [string, string];
  normalizeHeresiesForExpansion(religions: Religion[], religionIds: Uint16Array): Religion[];
  recalculate(): void;
}

describe("ReligionsModule origins", () => {
  let Religions: TestableReligionsModule;

  beforeAll(async () => {
    await import("./religions-generator");
    Religions = globalThis.Religions as unknown as TestableReligionsModule;
  });

  beforeEach(() => {
    globalThis.pack = {
      cells: {
        c: [[1], [0, 2], [1, 3], [2]],
        p: [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0]
        ]
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a heresy that inherits its organized parent", () => {
    vi.spyOn(Religions, "generateReligionName").mockReturnValue(["Test Heresy", "global"]);
    globalThis.pack.cells.culture = Uint16Array.from([1]);
    const parent = {
      i: 2,
      name: "Organized faith",
      type: "Organized",
      form: "Monotheism",
      culture: 1,
      center: 0,
      expansion: "global",
      expansionism: 5,
      deity: "The Parent Deity",
      color: "#336699"
    } satisfies Religion;

    const result = Religions.createHeresy(parent, 0, 4, ["OF"]);

    expect(result).toMatchObject({
      i: 4,
      type: "Heresy",
      origins: [2],
      center: 0,
      form: "Monotheism",
      deity: "The Parent Deity"
    });
  });

  it("does not generate heresies without an organized parent", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Nearby cult",
        type: "Cult",
        form: "Cult",
        culture: 1,
        center: 0,
        expansion: "global",
        expansionism: 5,
        deity: "Cult deity",
        color: "#993366"
      }
    ] as Religion[];

    expect(Religions.generateHeresies(religions, Uint16Array.from([1]))).toEqual([]);
  });

  it("does not generate heresies from a locked organized religion", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Locked organized religion",
        type: "Organized",
        form: "Monotheism",
        culture: 1,
        center: 0,
        expansion: "global",
        expansionism: 5,
        deity: "Locked deity",
        color: "#336699",
        lock: true
      }
    ] as Religion[];

    expect(Religions.generateHeresies(religions, Uint16Array.from([1]))).toEqual([]);
  });

  it("preserves origins of a locked religion", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Folk belief",
        type: "Folk",
        form: "Animism",
        culture: 1,
        center: 0,
        expansion: "culture"
      },
      {
        i: 2,
        name: "Organized faith",
        type: "Organized",
        form: "Monotheism",
        culture: 1,
        center: 1,
        expansion: "global"
      },
      {
        i: 3,
        name: "Locked cult",
        type: "Cult",
        form: "Cult",
        culture: 1,
        center: 3,
        expansion: "global",
        origins: [2],
        lock: true
      }
    ] as Religion[];
    const religionIds = Uint16Array.from([1, 1, 1, 3]);

    const result = Religions.defineOrigins(religionIds, religions);

    expect(result[3].origins).toEqual([2]);
  });

  it("keeps a sparse locked religion and its origins while combining regenerated religions", () => {
    const lockedReligion = {
      i: 3,
      name: "Locked cult",
      type: "Cult",
      form: "Cult",
      culture: 1,
      center: 3,
      expansion: "global",
      expansionism: 1,
      deity: "Cult deity",
      color: "#993366",
      origins: [2],
      lock: true
    } satisfies Religion;

    const result = Religions.combineReligions([], [lockedReligion]);

    expect(result[2]).toMatchObject({ i: 2, removed: true });
    expect(result[3]).toMatchObject({ i: 3, name: "Locked cult", origins: [2], lock: true });
  });

  it("does not add an origin that would create a cycle with a locked religion", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Locked organized religion",
        type: "Organized",
        form: "Monotheism",
        culture: 1,
        center: 0,
        expansion: "global",
        origins: [3],
        lock: true
      },
      {
        i: 2,
        name: "Folk belief",
        type: "Folk",
        form: "Animism",
        culture: 1,
        center: 2,
        expansion: "culture"
      },
      {
        i: 3,
        name: "Generated organized religion",
        type: "Organized",
        form: "Polytheism",
        culture: 1,
        center: 3,
        expansion: "global"
      }
    ] as Religion[];
    const religionIds = Uint16Array.from([1, 1, 1, 1]);

    const result = Religions.defineOrigins(religionIds, religions);

    expect(result[1].origins).toEqual([3]);
    expect(result[3].origins?.includes(1)).toBe(false);
  });

  it("does not add a transitive origin cycle through a generated religion", () => {
    globalThis.pack.cells.c = [[1], [0, 2], [1]];
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Locked organized religion",
        type: "Organized",
        form: "Monotheism",
        culture: 0,
        center: 0,
        expansion: "global",
        origins: [3],
        lock: true
      },
      {
        i: 2,
        name: "First generated religion",
        type: "Organized",
        form: "Polytheism",
        culture: 0,
        center: 1,
        expansion: "global"
      },
      {
        i: 3,
        name: "Second generated religion",
        type: "Cult",
        form: "Cult",
        culture: 0,
        center: 2,
        expansion: "global"
      }
    ] as Religion[];

    const result = Religions.defineOrigins(Uint16Array.from([1, 2, 3]), religions);

    expect(result[1].origins).toEqual([3]);
    expect(result[2].origins).toEqual([1]);
    expect(result[3].origins).toEqual([0]);
  });

  it("normalizes a legacy heresy to one organized parent before recalculation", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Folk belief",
        type: "Folk",
        form: "Animism",
        culture: 1,
        center: 0,
        expansion: "culture",
        expansionism: 0,
        deity: null,
        color: "#aaaaaa"
      },
      {
        i: 2,
        name: "Organized faith",
        type: "Organized",
        form: "Monotheism",
        culture: 1,
        center: 1,
        expansion: "global",
        expansionism: 5,
        deity: "The Parent Deity",
        color: "#336699"
      },
      {
        i: 3,
        name: "Legacy heresy",
        type: "Heresy",
        form: "Polytheism",
        culture: 1,
        center: 1,
        expansion: "global",
        expansionism: 1,
        deity: "Wrong deity",
        color: "#669933",
        origins: [1, 2]
      }
    ] as Religion[];

    const result = Religions.normalizeHeresiesForExpansion(religions, Uint16Array.from([1, 2]));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ origins: [2], form: "Monotheism", deity: "The Parent Deity" });
  });

  it("retires a legacy heresy when no acyclic organized parent exists", () => {
    const religions = [
      { i: 0, name: "No religion" },
      {
        i: 1,
        name: "Organized faith",
        type: "Organized",
        form: "Monotheism",
        culture: 1,
        center: 0,
        expansion: "global",
        expansionism: 5,
        deity: "The Parent Deity",
        color: "#336699",
        origins: [2]
      },
      {
        i: 2,
        name: "Cyclic legacy heresy",
        type: "Heresy",
        form: "Monotheism",
        culture: 1,
        center: 0,
        expansion: "global",
        expansionism: 1,
        deity: "The Parent Deity",
        color: "#669933",
        origins: [1]
      }
    ] as Religion[];

    const result = Religions.normalizeHeresiesForExpansion(religions, Uint16Array.from([1]));

    expect(result).toEqual([]);
    expect(religions[1].origins).toEqual([0]);
    expect(religions[2]).toMatchObject({ removed: true, origins: [0], cells: 0 });
  });

  it("links a manually added heresy only to its organized parent", () => {
    const randomValues = [0.99, 0.25, 0.75, 0.99];
    let randomIndex = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      if (randomIndex < randomValues.length) return randomValues[randomIndex++];
      return randomIndex++ % 2 ? 0.25 : 0.75;
    });
    globalThis.Names = { getCulture: () => "Test" } as any;
    globalThis.pack = {
      cells: {
        c: [[]],
        culture: Uint16Array.from([1]),
        religion: Uint16Array.from([2])
      },
      cultures: [{ i: 0 }, { i: 1, name: "Test", color: "#aaaaaa" }],
      religions: [
        { i: 0, name: "No religion" },
        { i: 1, name: "Folk belief", type: "Folk", culture: 1, color: "#aaaaaa" },
        {
          i: 2,
          name: "Organized faith",
          type: "Organized",
          form: "Monotheism",
          culture: 1,
          deity: "The Parent Deity",
          color: "#336699",
          code: "OF"
        }
      ]
    } as any;

    Religions.add(0);

    expect(globalThis.pack.religions[3]).toMatchObject({
      type: "Heresy",
      form: "Monotheism",
      deity: "The Parent Deity",
      origins: [2]
    });
  });
});

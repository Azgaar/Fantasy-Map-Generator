// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const on = new Set<string>();
  const layers = {
    draw: vi.fn(),
    has: vi.fn(() => true),
    isOn: vi.fn((id: string) => on.has(id)),
    show: vi.fn((...ids: string[]) => {
      for (const id of ids) on.add(id);
    }),
    hide: vi.fn((...ids: string[]) => {
      for (const id of ids) on.delete(id);
    })
  };
  const legend = {
    drawLegend: vi.fn(),
    clearLegend: vi.fn(),
    hasLegend: vi.fn(() => false),
    getLegendData: vi.fn()
  };
  return { layers, legend, on };
});

vi.mock("@/components/layers", () => ({ Layers: mocks.layers }));
vi.mock("@/renderers/draw-legend", () => mocks.legend);
vi.mock("@/conquest/ui/layers/index", () => ({ twLayerIds: () => ["twArmies", "twFronts"] }));

import { Layers } from "@/components/layers";
import { drawLegend, hasLegend } from "@/renderers/draw-legend";
import { goToPresent, isInPast, scrubRange, scrubToYear, showEpoch, viewedEpoch } from "./historical-view";

const CELLS = 10;
const PRESENT_STATE = new Uint16Array(CELLS).fill(7);

const polities = [
  { id: 17, name: "Aleth", form: "Kingdom", capital: 1, cells: 4, color: "#aa0000", founded: 100 },
  { id: 9, name: "Bren", form: "Empire", capital: 2, cells: 6, color: "#00aa00", founded: 80 },
  { id: 4, name: "Castel", form: "Union", capital: 3, cells: 0, color: "#0000aa", founded: 90 }
];

const snapshot0 = Uint16Array.from([9, 9, 17, 0, 17, 0, 0, 9, 17, 9]);
const snapshot1 = Uint16Array.from([17, 17, 0, 0, 0, 0, 0, 0, 0, 0]);

beforeEach(() => {
  globalThis.customization = 0;
  globalThis.mapHistory = [mapEntry(5)];
  globalThis.options = {
    map: { seed: "s1", lore: { calendar: { year: 1000, era: "Present Age" } } }
  } as unknown as typeof options;

  globalThis.pack = {
    cells: {
      i: Array.from({ length: CELLS }, (_, index) => index),
      state: Uint16Array.from(PRESENT_STATE),
      p: Array.from({ length: CELLS }, (_, index) => [index * 10, index * 10]),
      c: Array.from({ length: CELLS }, () => [] as number[]),
      culture: Array.from({ length: CELLS }, () => 0)
    },
    burgs: [
      { i: 0 },
      { i: 1, x: 11, y: 22, cell: 0, culture: 0 },
      { i: 2, x: 33, y: 44, cell: 1, culture: 1 },
      { i: 3, x: 55, y: 66, cell: 2, culture: 1 }
    ],
    cultures: [
      { i: 0, name: "A", type: "Mountains" },
      { i: 1, name: "B", type: "Generic" }
    ],
    states: [
      { i: 0, name: "Neutrals", color: "#dddddd" },
      { i: 1, name: "Olda", color: "#123123" },
      { i: 2, name: "Oldb", color: "#456456" }
    ],
    history: {
      events: [],
      realms: [],
      eras: [],
      epochs: [
        { i: 0, from: 100, to: 500, era: "Age of Ruins", polities, snapshot: 0 },
        { i: 1, from: 500, to: 1000, era: "Present Age", polities: [polities[0]], snapshot: 1 }
      ],
      polities,
      snapshots: [snapshot0, snapshot1]
    }
  } as unknown as typeof pack;

  mocks.layers.draw.mockReset();
  mocks.layers.hide.mockReset();
  mocks.layers.show.mockReset();
  mocks.layers.has.mockReturnValue(true);
  mocks.legend.drawLegend.mockReset();
  mocks.legend.clearLegend.mockReset();
  mocks.legend.hasLegend.mockReturnValue(false);
  mocks.legend.getLegendData.mockReturnValue(undefined);
  mocks.on.clear();
  for (const id of ["states", "borders", "labels", "emblems", "military"]) mocks.on.add(id);
});

afterEach(() => {
  goToPresent();
});

const mapEntry = (
  registeredAt: number
): { seed: string; width: number; height: number; template: string; created: number; registeredAt: number } => ({
  seed: "s1",
  width: 0,
  height: 0,
  template: "",
  created: 0,
  registeredAt
});

describe("showEpoch", () => {
  it("swaps the pack to the epoch's remapped cast and redraws the political layers", () => {
    showEpoch(0);

    expect(Array.from(pack.cells.state)).toEqual([2, 2, 1, 0, 1, 0, 0, 2, 1, 2]); // compact ids
    expect(pack.states[0].name).toBe("Neutrals");
    expect(pack.states[1].name).toBe("Aleth");
    expect(pack.states[1].color).toBe("#aa0000");
    expect(pack.states[1].capital).toBe(1);
    expect(pack.states[1].fullName).toBe("Kingdom of Aleth"); // non-adjectival form
    expect(pack.states[2].name).toBe("Bren");
    expect(pack.states[2].fullName).toMatch(/ Empire$/); // the adjectival scheme reads "Adjective Empire"
    expect(pack.states[2].pole).toEqual([33, 44]);
    expect(pack.states[2].type).toBe("Generic");
    expect(pack.states).toHaveLength(4); // neutral + the epoch's cast (including the empty one)
    expect(customization).toBe(100);
    expect(Layers.draw).toHaveBeenCalledWith("states", "borders", "labels");
    expect(viewedEpoch()?.era).toBe("Age of Ruins");
  });

  it("draws the polities in the era legend, the largest first, skipping empty ones", () => {
    showEpoch(0);

    expect(vi.mocked(drawLegend).mock.calls[0]).toEqual([
      "States · Age of Ruins",
      [
        [9, "#00aa00", "Bren"],
        [17, "#aa0000", "Aleth"]
      ]
    ]);
  });

  it("replaces the open present States legend with the era's polities", () => {
    vi.mocked(hasLegend).mockReturnValue(true);
    vi.mocked(mocks.legend.getLegendData).mockReturnValue([["1", "#111111", "The old landmark"]]);

    showEpoch(0);
    expect(mocks.legend.clearLegend).toHaveBeenCalledWith("States");
    expect(drawLegend).toHaveBeenCalledWith("States · Age of Ruins", [
      [9, "#00aa00", "Bren"],
      [17, "#aa0000", "Aleth"]
    ]);

    goToPresent();
    expect(mocks.legend.clearLegend).toHaveBeenCalledWith("States · Age of Ruins");
    expect(drawLegend).toHaveBeenLastCalledWith("States", [["1", "#111111", "The old landmark"]]);
  });

  it("moves between epochs and restores the present exactly on the way back", () => {
    const presentState = pack.cells.state;
    const presentStates = pack.states;

    showEpoch(0);
    showEpoch(1);
    expect(Array.from(pack.cells.state)).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);

    goToPresent();
    expect(pack.cells.state).toBe(presentState);
    expect(pack.states).toBe(presentStates);
    expect(Array.from(presentState)).toEqual(Array.from(PRESENT_STATE));
    expect(customization).toBe(0);
    expect(isInPast()).toBe(false);
    expect(viewedEpoch()).toBeNull();
  });

  it("hides the present-only layers and restores them on the way back", () => {
    showEpoch(0);
    expect(mocks.layers.hide).toHaveBeenCalledWith("emblems");
    expect(mocks.layers.hide).toHaveBeenCalledWith("military");

    goToPresent();
    expect(mocks.layers.show).toHaveBeenCalledWith("emblems");
    expect(mocks.layers.show).toHaveBeenCalledWith("military");
    expect(mocks.on.has("emblems")).toBe(true);
  });

  it("refuses an epoch without a matching snapshot and stays in the present", () => {
    (pack.history as { snapshots: Uint16Array[] }).snapshots = [snapshot0.subarray(0, 5), snapshot1];

    showEpoch(0);
    expect(isInPast()).toBe(false);
    expect(customization).toBe(0);
    expect(mocks.layers.draw).not.toHaveBeenCalled();
  });

  it("restores the pack even when a renderer throws mid-swap", () => {
    const presentState = pack.cells.state;
    mocks.layers.draw.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(() => showEpoch(0)).toThrow("boom");
    expect(pack.cells.state).toBe(presentState);
    expect(Array.from(presentState)).toEqual(Array.from(PRESENT_STATE));
    expect(isInPast()).toBe(false);
    expect(customization).toBe(0);
  });
});

describe("scrubToYear", () => {
  it("lands on the epoch the year belongs to", () => {
    scrubToYear(600);
    expect(viewedEpoch()?.i).toBe(1);

    scrubToYear(150);
    expect(viewedEpoch()?.i).toBe(0);

    scrubToYear(50); // before any epoch began: the oldest era it has
    expect(viewedEpoch()?.i).toBe(0);
  });

  it("a present year leaves the view", () => {
    showEpoch(0);
    expect(isInPast()).toBe(true);

    scrubToYear(1000);
    expect(isInPast()).toBe(false);
  });
});

describe("scrubRange", () => {
  it("spans the first epoch's start and the present year", () => {
    expect(scrubRange()).toEqual({ min: 100, max: 1000 });
  });

  it("is null when the world has no epochs or no snapshots", () => {
    delete (pack.history as { epochs?: unknown[] }).epochs;
    expect(scrubRange()).toBeNull();

    (pack.history as { epochs: unknown[] }).epochs = [
      { i: 0, from: 100, to: 500, era: "Age of Ruins", polities, snapshot: 0 }
    ];
    delete (pack.history as { snapshots?: unknown[] }).snapshots;
    expect(scrubRange()).toBeNull();
  });
});

describe("a world replaced under a scrubbing view", () => {
  it("a stale restore never overwrites the new map, and the view still resets", () => {
    showEpoch(0);
    const pastState = pack.cells.state;

    globalThis.mapHistory.push(mapEntry(99)); // a new world registered
    goToPresent();

    expect(pack.cells.state).toBe(pastState); // the new world owns its arrays
    expect(customization).toBe(0);
    expect(isInPast()).toBe(false);
  });

  it("leaving when the map is already at the present is a no-op", () => {
    goToPresent();
    expect(customization).toBe(0);
    expect(isInPast()).toBe(false);
  });
});

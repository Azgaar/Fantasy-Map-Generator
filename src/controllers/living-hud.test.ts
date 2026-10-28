// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    enabled: true,
    tick: 0,
    season: 0,
    seed: "test-living",
    snapshotIntervalYears: 10,
    promptOnPlayerBattles: false,
    states: {} as Record<number, unknown>,
    provinces: {} as Record<number, unknown>,
    burgs: {} as Record<number, unknown>,
    recentNews: [] as unknown[]
  };

  const living = {
    getState: vi.fn(() => state),
    formatSeasonDate: vi.fn(() => "Spring, 1000 AD"),
    tick: vi.fn(),
    syncWorld: vi.fn(),
    sparkRebellion: vi.fn(() => true),
    smiteRuler: vi.fn(() => true),
    forceWar: vi.fn(() => true),
    pacifyBurg: vi.fn(() => true),
    completeAsset: vi.fn(() => true)
  };

  return { state, living };
});

vi.mock("@/generators/living-generator", () => ({ Living: mocks.living }));
vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/zoom", () => ({ zoomTo: vi.fn() }));
vi.mock("@/generators/journeys/journey-places", () => ({ getCellPoint: vi.fn(() => [10, 10]) }));
vi.mock("@/conquest/content/store", () => ({
  currentContent: () => ({ content: { buildings: [{ id: "market1", name: "Market" }] }, config: {} })
}));
vi.mock("@/controllers", () => ({
  Controllers: {
    LegendsOverview: { open: vi.fn() },
    StatesEditor: { open: vi.fn() },
    BurgEditor: { open: vi.fn() },
    RegimentsOverview: { open: vi.fn() }
  }
}));

import { Layers } from "@/components/layers";
import { zoomTo } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { Living } from "@/generators/living-generator";
import { LivingHud } from "./living-hud";

function makePack() {
  return {
    cells: {
      i: [0, 1, 2],
      state: new Uint16Array([0, 1, 1]),
      province: new Uint16Array([0, 1, 1]),
      burg: new Uint16Array([0, 1, 2]),
      culture: new Uint16Array([0, 1, 1]),
      religion: new Uint16Array([0, 1, 1]),
      c: [[1], [0, 2], [1]],
      p: [
        [0, 0],
        [10, 10],
        [20, 20]
      ]
    },
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Aeloran" }
    ],
    states: [
      { i: 0, name: "Neutrals" },
      {
        i: 1,
        name: "Aeloria",
        fullName: "Kingdom of Aeloria",
        center: 1,
        capital: 1,
        culture: 1,
        military: [],
        diplomacy: []
      }
    ],
    burgs: [
      { i: 0 },
      { i: 1, name: "Aelor", cell: 1, state: 1, population: 18, capital: 1 },
      { i: 2, name: "Oakford", cell: 2, state: 1, population: 4, capital: 0 }
    ],
    provinces: [{ i: 0 }, { i: 1, state: 1, burg: 1, center: 1 }],
    history: {
      living: mocks.state,
      events: [],
      eras: [],
      figures: [
        {
          i: 0,
          name: "Queen Lyra",
          culture: 1,
          birth: 970,
          roles: [{ type: "ruler", target: { kind: "state", id: 1 }, from: 1000 }],
          alignment: "good",
          virtues: ["bold"],
          vices: []
        }
      ]
    }
  };
}

function makeSimulation() {
  return {
    states: {
      1: {
        stateId: 1,
        rulerId: 0,
        agenda: { kind: "develop", label: "Developing Aelor", progress: 2, required: 4 },
        unravel: 30,
        warExhaustion: 10,
        capacity: {
          m: { gen: 10, load: 4 },
          w: { gen: 8, load: 9 },
          s: { gen: 6, load: 2 },
          c: { gen: 2, load: 1 }
        },
        claims: [{ burgId: 2, lostYear: 999, heldByStateId: 2 }],
        grudges: [{ id: 0, reason: "conquest", year: 999, weight: 4, summary: "Aeloria took Oakford" }]
      }
    },
    burgs: {
      1: {
        burgId: 1,
        baseTier: 5,
        development: 0,
        developmentProgress: 0,
        buildings: ["market1"],
        construction: null,
        unrest: 0
      },
      2: {
        burgId: 2,
        baseTier: 2,
        development: 0,
        developmentProgress: 0,
        buildings: [],
        construction: { buildingId: "market1", turnsLeft: 2, checks: { m: true, w: false, s: false }, pityBonus: 0 },
        unrest: 40
      }
    }
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();

  globalThis.options = {
    map: { seed: "test-living", lore: { calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" } } }
  } as unknown as typeof options;
  globalThis.pack = makePack() as unknown as typeof pack;

  const simulation = makeSimulation();
  mocks.state.states = simulation.states;
  mocks.state.burgs = simulation.burgs;
  mocks.state.recentNews = [];
  mocks.living.getState.mockReturnValue(mocks.state);
});

afterEach(() => {
  LivingHud.close();
  vi.useRealTimers();
});

describe("LivingHud", () => {
  it("opens the bar with clock controls and the current date", () => {
    LivingHud.open();

    expect(document.getElementById("livingWorldHud")).toBeTruthy();
    expect(document.getElementById("livingInspector")).toBeTruthy();
    expect(document.getElementById("livingHudDate")?.textContent).toBe("Spring, 1000 AD");
    expect(document.getElementById("livingHudPause")?.textContent).toBe("Pause");
    expect(document.getElementById("livingHudStepSeason")?.textContent).toBe("Step +1 Season");
    expect(document.getElementById("livingHudStepYear")?.textContent).toBe("Step +1 Year");
    expect(document.getElementById("livingHudPlay")?.textContent).toBe("Play 1×");
    expect(document.getElementById("livingHudPlay4")?.textContent).toBe("Play 4×");
    expect(Living.getState).toHaveBeenCalled();
  });

  it("steps a season and redraws the political layers", () => {
    LivingHud.open();
    document.getElementById("livingHudStepSeason")?.click();

    expect(Living.tick).toHaveBeenCalledWith(1);
    expect(Living.syncWorld).toHaveBeenCalled();
    expect(Layers.draw).toHaveBeenCalledWith(
      "states",
      "borders",
      "provinces",
      "labels",
      "burgIcons",
      "military",
      "markers"
    );
  });

  it("advances four seasons from the year button", () => {
    LivingHud.open();
    document.getElementById("livingHudStepYear")?.click();

    expect(Living.tick).toHaveBeenCalledWith(4);
  });

  it("runs and pauses playback without leaking its interval", () => {
    vi.useFakeTimers();
    LivingHud.open();
    document.getElementById("livingHudPlay4")?.click();

    vi.advanceTimersByTime(700);
    expect(Living.tick).toHaveBeenCalledTimes(2);

    document.getElementById("livingHudPause")?.click();
    vi.advanceTimersByTime(2000);
    expect(Living.tick).toHaveBeenCalledTimes(2);
  });

  it("renders the news ticker and zooms to a clicked dispatch", () => {
    mocks.state.recentNews = [
      {
        tick: 1,
        year: 1000,
        season: 1,
        kind: "war",
        text: "Aeloria declared war on Khazadia.",
        cell: 2,
        stateId: 1
      }
    ];
    LivingHud.open();

    const item = document.querySelector<HTMLElement>("button.livingNewsItem");
    expect(item?.textContent).toContain("[1000 Summer]");
    expect(item?.textContent).toContain("Aeloria declared war");

    item?.click();
    expect(zoomTo).toHaveBeenCalledWith(10, 10, 8, 800);
    expect(document.getElementById("livingInspector")?.textContent).toContain("Kingdom of Aeloria");
  });

  it("shows the state diorama and runs the god-mode actions", () => {
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 2, kind: "succession", text: "A new ruler.", cell: 1, stateId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Queen Lyra");
    expect(inspector?.textContent).toContain("age 30");
    expect(inspector?.textContent).toContain("Developing Aelor");
    expect(inspector?.textContent).toContain("2 / 4");
    expect(inspector?.textContent).toContain("Aeloria took Oakford");
    expect(inspector?.textContent).toContain("Unravel");

    inspector?.querySelector<HTMLElement>('[data-god="spark"]')?.click();
    expect(Living.sparkRebellion).toHaveBeenCalledWith(1, undefined);

    document.querySelector<HTMLElement>('#livingInspector [data-god="smite"]')?.click();
    expect(Living.smiteRuler).toHaveBeenCalledWith(1);

    document.querySelector<HTMLElement>('#livingInspector [data-god="war"]')?.click();
    expect(Living.forceWar).toHaveBeenCalledWith(1);
    expect(document.getElementById("livingHudStatus")?.textContent).toBe("War has been declared.");
  });

  it("shows the burg diorama and completes its asset", () => {
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 3, kind: "revolt", text: "Oakford is restless.", cell: 2, burgId: 2 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Oakford");
    expect(inspector?.textContent).toContain("Unrest");
    expect(inspector?.textContent).toContain("Market");
    expect(inspector?.textContent).toContain("2 turns left");

    inspector?.querySelector<HTMLElement>('[data-god="pacify"]')?.click();
    expect(Living.pacifyBurg).toHaveBeenCalledWith(2);

    document.querySelector<HTMLElement>('#livingInspector [data-god="complete"]')?.click();
    expect(Living.completeAsset).toHaveBeenCalledWith(2);
  });

  it("opens the Legends browser from the date badge and toggles the HUD", () => {
    LivingHud.open();
    document.getElementById("livingHudDate")?.click();
    expect(Controllers.LegendsOverview.open).toHaveBeenCalled();

    LivingHud.close();
    expect(document.getElementById("livingWorldHud")).toBeNull();
    expect(document.getElementById("livingInspector")).toBeNull();

    LivingHud.toggle();
    expect(document.getElementById("livingWorldHud")).toBeTruthy();
  });
});

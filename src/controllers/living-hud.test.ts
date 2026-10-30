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
    completeAsset: vi.fn(() => true),
    spawnTrouble: vi.fn(() => ({ id: "monsters", level: 5 })),
    quellTrouble: vi.fn(() => true),
    resolveTrouble: vi.fn(() => true),
    promoteTroubleToState: vi.fn(() => 2),
    spawnLair: vi.fn(() => ({ id: "bandit_camp", name: "Bandit Camp", level: 6 })),
    smiteLair: vi.fn(() => true),
    assaultLair: vi.fn(() => true),
    sendAdventurersToLair: vi.fn(() => true),
    ascendLairToState: vi.fn(() => 2)
  };

  return { state, living };
});

vi.mock("@/model/physical/living-generator", () => ({ Living: mocks.living }));
vi.mock("@/renderers/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/ui/map/zoom", () => ({ zoomTo: vi.fn() }));
vi.mock("@/model/story/journeys/journey-places", () => ({ getCellPoint: vi.fn(() => [10, 10]) }));
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

import { Controllers } from "@/controllers";
import { Living } from "@/model/physical/living-generator";
import { Layers } from "@/renderers/layers";
import { zoomTo } from "@/ui/map/zoom";
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
    provinces: [{ i: 0 }, { i: 1, name: "Northmarch", state: 1, burg: 1, center: 1 }],
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
    expect(document.getElementById("livingHudPlay")?.textContent).toBe("Play 1Ã—");
    expect(document.getElementById("livingHudPlay4")?.textContent).toBe("Play 4Ã—");
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

  it("shows provincial lairs in the state inspector and runs lair god-mode actions", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 75,
        stability: 2,
        development: 1,
        lair: {
          id: "bandit_camp",
          name: "Forest Hideout",
          level: 6,
          theme: "ruin",
          originCell: 1,
          raidThreshold: 5,
          defenders: [{ type: "infantry", count: 25 }],
          fortified: true,
          raidPending: true,
          seasonsActive: 2
        }
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 2, kind: "succession", text: "A new ruler.", cell: 1, stateId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Forest Hideout");
    expect(inspector?.textContent).toContain("Lv 6");
    expect(inspector?.textContent).toContain("Raid: 5+");
    expect(inspector?.textContent).toContain("Defenders: 25");
    expect(inspector?.textContent).toContain("ðŸ° Fortified");
    expect(inspector?.textContent).toContain("âš ï¸ Raid Imminent");

    inspector?.querySelector<HTMLElement>('[data-god="assault-state-lair"]')?.click();
    expect(Living.assaultLair).toHaveBeenCalledWith(1, 1);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("Northmarch");

    inspector?.querySelector<HTMLElement>('[data-god="delve-state-lair"]')?.click();
    expect(Living.sendAdventurersToLair).toHaveBeenCalledWith(1, 1);

    inspector?.querySelector<HTMLElement>('[data-god="smite-state-lair"]')?.click();
    expect(Living.smiteLair).toHaveBeenCalledWith(1);
  });

  it("shows provincial lair on burg card and triggers burg lair interventions", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 60,
        stability: 1,
        development: 0,
        lair: {
          id: "ancient_evil",
          name: "Abyssal Rift",
          level: 8,
          theme: "ruin",
          originCell: 1,
          raidThreshold: 6,
          defenders: [{ type: "cavalry", count: 15 }],
          fortified: false,
          raidPending: false,
          seasonsActive: 4
        }
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 0, kind: "lair", text: "Abyssal Rift active.", cell: 1, burgId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Abyssal Rift");
    expect(inspector?.textContent).toContain("Lv 8");
    expect(inspector?.textContent).toContain("Raid: 6+");
    expect(inspector?.textContent).toContain("15 men");

    inspector?.querySelector<HTMLElement>('[data-god="assault-lair"]')?.click();
    expect(Living.assaultLair).toHaveBeenCalledWith(1, 1);

    inspector?.querySelector<HTMLElement>('[data-god="delve-lair"]')?.click();
    expect(Living.sendAdventurersToLair).toHaveBeenCalledWith(1, 1);

    inspector?.querySelector<HTMLElement>('[data-god="smite-lair"]')?.click();
    expect(Living.smiteLair).toHaveBeenCalledWith(1);
    expect(document.getElementById("livingHudStatus")?.textContent).toBe("The lair was smitten by divine wrath.");
  });

  it("allows spawning a lair when province has no active lair", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 90,
        stability: 3,
        development: 2,
        lair: null
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 0, kind: "peace", text: "Peace in Aelor.", cell: 1, burgId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("No active lair");

    const spawnBtn = inspector?.querySelector<HTMLElement>('[data-god="spawn-lair"]');
    expect(spawnBtn).toBeTruthy();
    spawnBtn?.click();
    expect(Living.spawnLair).toHaveBeenCalledWith(1);
    expect(document.getElementById("livingHudStatus")?.textContent).toBe("A lair has arisen in the province.");
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

  it("shows Promote to State button and badge only for state-promotable troubles", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 35,
        stability: 1,
        development: 0,
        trouble: {
          id: "demagogue",
          name: "Zealous Demagogue",
          level: 7,
          theme: "burg",
          pool: "s",
          save: "uprising",
          requiredRole: "prophet",
          seasonsUnchecked: 3,
          cell: 1
        }
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 0, kind: "trouble", text: "Demagogue in Aelor.", cell: 1, burgId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Revolutionary Tribune");

    const promoteBtn = inspector?.querySelector<HTMLElement>('[data-god="promote-trouble"]');
    expect(promoteBtn).toBeTruthy();
    promoteBtn?.click();
    expect(Living.promoteTroubleToState).toHaveBeenCalledWith(1, 1);

    // Non-promotable trouble omits the Promote to State button
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 35,
        stability: 1,
        development: 0,
        trouble: {
          id: "flooding",
          name: "Seasonal Flooding",
          level: 6,
          theme: "resource",
          pool: "w",
          save: "poverty",
          requiredRole: "merchant",
          seasonsUnchecked: 2,
          cell: 1
        }
      }
    };
    LivingHud.refresh();
    expect(inspector?.querySelector<HTMLElement>('[data-god="promote-trouble"]')).toBeNull();
  });

  it("shows Ascend Lair button and badge only for state-capable lairs on state and burg cards", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 40,
        stability: 1,
        development: 0,
        lair: {
          id: "demonic_master",
          name: "Infernal Fane",
          level: 8,
          theme: "ruin",
          cell: 1,
          raidThreshold: 5,
          defenders: [{ type: "infantry", count: 40 }],
          fortified: true,
          raidPending: false,
          seasonsActive: 6
        }
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 0, kind: "lair", text: "Infernal Fane.", cell: 1, stateId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Infernal Dominion");

    const stateAscendBtn = inspector?.querySelector<HTMLElement>('[data-god="ascend-state-lair"]');
    expect(stateAscendBtn).toBeTruthy();
    stateAscendBtn?.click();
    expect(Living.ascendLairToState).toHaveBeenCalledWith(1);

    // Non-capable lair (monster_nest) omits Ascend Lair button
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 40,
        stability: 1,
        development: 0,
        lair: {
          id: "monster_nest",
          name: "Monster Nest",
          level: 8,
          theme: "ruin",
          cell: 1,
          raidThreshold: 5,
          defenders: [{ type: "infantry", count: 40 }],
          fortified: false,
          raidPending: false,
          seasonsActive: 6
        }
      }
    };
    LivingHud.refresh();
    expect(inspector?.querySelector<HTMLElement>('[data-god="ascend-state-lair"]')).toBeNull();
  });
});

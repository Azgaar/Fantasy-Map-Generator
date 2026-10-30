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
    recentNews: [] as unknown[],
    guild: {
      tier: 1,
      gold: 0,
      renown: 0,
      ageCount: 0,
      sandboxGodMode: true,
      doctrine: "auto_bounties",
      favoredStateId: 1 as number | undefined,
      chapterBurgIds: [] as number[],
      roster: [] as number[],
      candidates: [] as number[],
      missions: [] as unknown[],
      relics: [] as unknown[],
      cooldowns: {} as Record<number, number>,
      excavatedMarkers: [] as number[],
      popups: [] as unknown[]
    }
  };

  const living = {
    getState: vi.fn(() => state),
    getGuild: vi.fn(() => state.guild),
    getMissions: vi.fn(() => state.guild.missions),
    claimPopup: vi.fn((_id: number): unknown => null),
    formatSeasonDate: vi.fn(() => "Spring, 1000 AD"),
    tick: vi.fn(),
    syncWorld: vi.fn(),
    setDoctrine: vi.fn((doctrine: string) => {
      state.guild.doctrine = doctrine;
    }),
    setSandboxGodMode: vi.fn((enabled: boolean) => {
      state.guild.sandboxGodMode = enabled;
    }),
    setFavoredState: vi.fn((stateId: number) => {
      state.guild.favoredStateId = stateId;
    }),
    recruitCost: vi.fn(() => 80),
    recruitCandidate: vi.fn(() => true),
    dispatchHero: vi.fn(() => true),
    dispatchBestHero: vi.fn(() => true),
    dispatchHeroToMarker: vi.fn(() => true),
    dispatchBestHeroToMarker: vi.fn(() => true),
    equipRelic: vi.fn(() => true),
    enshrineRelic: vi.fn(() => true),
    leaseRelic: vi.fn(() => true),
    recallRelic: vi.fn(() => true),
    excavateMarker: vi.fn(() => true),
    getRelics: vi.fn(() => state.guild.relics),
    getEschaton: vi.fn(() => 0),
    turnAge: vi.fn(() => ({ era: "The Second Age of Ash", year: 1150, realms: 1, successorStates: 2 })),
    resolvePetition: vi.fn(() => ({ summary: "Fund the Militia: the trouble was quelled.", gold: -30, renown: 8 })),
    retireHero: vi.fn(() => 5),
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

vi.mock("@/model/physical/living-generator", () => ({
  Living: mocks.living,
  figureLevel: (xp = 0) => 1 + Math.floor(xp / 60),
  GUILD_TIER_TITLES: [
    "Wayfarers' Lodge",
    "Chartered Company",
    "Grand Adventurers' Guild",
    "Sovereign Order",
    "Immortal Conclave"
  ],
  maxHeroesForTier: (tier: number) => [3, 4, 6, 8, 10][Math.min(4, Math.max(0, tier - 1))] ?? 3
}));
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
    markers: [],
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
        },
        {
          i: 1,
          name: "Bran Quickfoot",
          culture: 1,
          birth: 945,
          roles: [{ type: "adventurer", target: { kind: "culture", id: 1 }, from: 1000 }],
          alignment: "good",
          virtues: ["bold", "just"],
          vices: [],
          xp: 90,
          skills: { m: 3, w: 1, s: 0, c: 2 },
          cell: 1
        },
        {
          i: 2,
          name: "Sable Vane",
          culture: 1,
          birth: 980,
          roles: [{ type: "adventurer", target: { kind: "culture", id: 1 }, from: 1000 }],
          alignment: "neutral",
          virtues: [],
          vices: ["cruel"],
          xp: 0,
          skills: { m: 0, w: 0, s: 2, c: 1 },
          cell: 1
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
  document.body.innerHTML = `<svg id="map"><g id="viewbox"></g></svg>`;
  vi.clearAllMocks();

  globalThis.options = {
    map: { seed: "test-living", lore: { calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" } } }
  } as unknown as typeof options;
  globalThis.pack = makePack() as unknown as typeof pack;

  const simulation = makeSimulation();
  mocks.state.states = simulation.states;
  mocks.state.burgs = simulation.burgs;
  mocks.state.provinces = {};
  mocks.state.recentNews = [];
  Object.assign(mocks.state.guild, {
    tier: 2,
    gold: 40,
    renown: 75,
    ageCount: 0,
    sandboxGodMode: true,
    doctrine: "auto_bounties",
    favoredStateId: 1,
    chapterBurgIds: [1],
    roster: [],
    candidates: [],
    missions: [],
    relics: [],
    cooldowns: {},
    excavatedMarkers: [],
    popups: []
  });
  mocks.living.claimPopup.mockReturnValue(null);
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

  it("shows the guild wallet in the HUD", () => {
    LivingHud.open();

    expect(document.getElementById("livingHudWallet")?.textContent).toBe("⚜ 40g · 75r");
  });

  it("renders the guild bar with tier, wallet, doctrine and hero chips", () => {
    Object.assign(mocks.state.guild, {
      tier: 3,
      gold: 120,
      renown: 160,
      doctrine: "auto_lairs",
      roster: [1],
      candidates: [2]
    });
    LivingHud.open();

    const bar = document.getElementById("livingHudGuild");
    expect(bar?.textContent).toContain("⚜ T3");
    expect(bar?.textContent).toContain("Grand Adventurers' Guild");
    expect(bar?.textContent).toContain("120g");
    expect(bar?.textContent).toContain("160r");
    expect(bar?.textContent).toContain("1/6 heroes");
    expect(bar?.textContent).toContain("Bran Quickfoot");
    expect(bar?.textContent).toContain("Sable Vane");
    expect((document.getElementById("livingHudDoctrine") as HTMLSelectElement | null)?.value).toBe("auto_lairs");
  });

  it("changes the idle doctrine from the guild bar", () => {
    LivingHud.open();

    const select = document.getElementById("livingHudDoctrine") as HTMLSelectElement;
    select.value = "manual";
    select.dispatchEvent(new Event("change"));

    expect(Living.setDoctrine).toHaveBeenCalledWith("manual");
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("Manual Dispatch");
  });

  it("toggles between Guild Mode and Sandbox God Mode", () => {
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-mode="guild"]')?.click();
    expect(Living.setSandboxGodMode).toHaveBeenCalledWith(false);
    expect(
      document.querySelector<HTMLElement>('#livingHudGuild [data-mode="guild"]')?.classList.contains("pressed")
    ).toBe(true);

    document.querySelector<HTMLElement>('#livingHudGuild [data-mode="sandbox"]')?.click();
    expect(Living.setSandboxGodMode).toHaveBeenCalledWith(true);
  });

  it("replaces god buttons with guild operations in Guild Mode", () => {
    Object.assign(mocks.state.guild, { sandboxGodMode: false });
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
      { tick: 1, year: 1000, season: 1, kind: "trouble", text: "Demagogue in Aelor.", cell: 1, stateId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Guild Operations");
    expect(inspector?.querySelector<HTMLElement>("[data-god]")).toBeNull();

    inspector?.querySelector<HTMLElement>('[data-guild="dispatch-state"]')?.click();
    expect(Living.dispatchBestHero).toHaveBeenCalledWith(1);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("Northmarch");
  });

  it("dispatches a hero from a burg card in Guild Mode", () => {
    Object.assign(mocks.state.guild, { sandboxGodMode: false });
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        order: 60,
        stability: 1,
        development: 0,
        lair: {
          id: "bandit_camp",
          name: "Forest Hideout",
          level: 6,
          theme: "ruin",
          originCell: 1,
          raidThreshold: 5,
          defenders: [{ type: "infantry", count: 25 }],
          fortified: false,
          raidPending: false,
          seasonsActive: 2
        }
      }
    };
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 3, kind: "lair", text: "Forest Hideout active.", cell: 2, burgId: 2 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.querySelector<HTMLElement>("[data-god]")).toBeNull();
    inspector?.querySelector<HTMLElement>('[data-guild="dispatch"]')?.click();
    expect(Living.dispatchBestHero).toHaveBeenCalledWith(1);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("guild hero");
  });

  it("inspects a hero and retires a veteran from the figure card", () => {
    Object.assign(mocks.state.guild, { roster: [1] });
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect"][data-figure="1"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Bran Quickfoot");
    expect(inspector?.textContent).toContain("Level 2");
    expect(inspector?.textContent).toContain("Guild Hero");

    inspector?.querySelector<HTMLElement>('[data-guild="retire"]')?.click();
    expect(Living.retireHero).toHaveBeenCalledWith(1);
  });

  it("recruits a tavern candidate from the figure card", () => {
    Object.assign(mocks.state.guild, { candidates: [2], gold: 120 });
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect"][data-figure="2"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Sable Vane");
    expect(inspector?.textContent).toContain("Recruit — 80g");
    expect(inspector?.querySelector<HTMLElement>("[data-guild='recruit']")?.hasAttribute("disabled")).toBe(false);

    inspector?.querySelector<HTMLElement>('[data-guild="recruit"]')?.click();
    expect(Living.recruitCandidate).toHaveBeenCalledWith(2);
  });

  it("renders vault relics and excavation site chips in the guild bar", () => {
    Object.assign(mocks.state.guild, {
      relics: [
        {
          id: 1,
          name: "Crown of the Vhaelen Emperors",
          category: "regalia",
          lore: "Worn by the rulers of Vhaelen.",
          originYear: 812,
          originRealmId: 3,
          bonuses: { s: 2 },
          holder: { kind: "vault" }
        }
      ]
    });
    pack.markers = [
      { i: 0, type: "ruins", icon: "🏛️", x: 10, y: 10, cell: 1, name: "Old Vhaelen", chronicle: true },
      { i: 1, type: "volcano", icon: "🌋", x: 20, y: 20, cell: 2, name: "Mount Keld" }
    ] as unknown as typeof pack.markers;
    LivingHud.open();

    const bar = document.getElementById("livingHudGuild");
    expect(bar?.textContent).toContain("1 relics");
    expect(bar?.textContent).toContain("Crown of the Vhaelen Emperors");
    expect(bar?.textContent).toContain("vault");
    expect(bar?.textContent).toContain("Old Vhaelen");
    expect(bar?.textContent).not.toContain("Mount Keld");
  });

  it("inspects an excavation site from the guild bar and dispatches a hero", () => {
    pack.markers = [
      { i: 4, type: "dungeons", icon: "☠️", x: 10, y: 10, cell: 1, name: "The Ashen Deep" }
    ] as unknown as typeof pack.markers;
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect-marker"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("The Ashen Deep");
    expect(inspector?.textContent).toContain("DC 15");
    expect(inspector?.textContent).toContain("Dispatch Hero");

    inspector?.querySelector<HTMLElement>('[data-guild="dispatch-marker"]')?.click();
    expect(Living.dispatchBestHeroToMarker).toHaveBeenCalledWith(4);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("excavate the site");
  });

  it("shows the relic card with powers, lore and a recall action", () => {
    Object.assign(mocks.state.guild, {
      relics: [
        {
          id: 2,
          name: "Greataxe of General Kael",
          category: "weapon",
          lore: "Forged for General Kael.",
          originYear: 901,
          originFigureId: 1,
          bonuses: { m: 2 },
          holder: { kind: "figure", id: 1 }
        }
      ]
    });
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect-relic"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Greataxe of General Kael");
    expect(inspector?.textContent).toContain("Weapon");
    expect(inspector?.textContent).toContain("+2 M");
    expect(inspector?.textContent).toContain("Carried by Bran Quickfoot");

    inspector?.querySelector<HTMLElement>('[data-guild="recall"]')?.click();
    expect(Living.recallRelic).toHaveBeenCalledWith(2);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("Guild Vault");
  });

  it("offers a Send Expedition action for relics buried in a fallen capital's ruin", () => {
    Object.assign(mocks.state.guild, {
      relics: [
        {
          id: 3,
          name: "Golden Charter of Old Aelor",
          category: "charter",
          lore: "The trade writ that made Aelor rich.",
          originYear: 744,
          bonuses: { w: 2 },
          holder: { kind: "ruin", markerId: 9, cell: 1 }
        }
      ],
      excavatedMarkers: []
    });
    pack.markers = [
      { i: 9, type: "ruins", icon: "🏛️", x: 10, y: 10, cell: 1, name: "Ruins of Aelor", chronicle: true }
    ] as unknown as typeof pack.markers;
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect-relic"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Buried in Ruins of Aelor");

    inspector?.querySelector<HTMLElement>('[data-guild="dispatch-marker"]')?.click();
    expect(Living.dispatchBestHeroToMarker).toHaveBeenCalledWith(9);
  });

  it("equips a vault relic from the hero card", () => {
    Object.assign(mocks.state.guild, {
      roster: [1],
      relics: [
        {
          id: 5,
          name: "Codex of the Ashen Schism",
          category: "tome",
          lore: "Saved from the fires.",
          originYear: 890,
          bonuses: { c: 2 },
          holder: { kind: "vault" }
        }
      ]
    });
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect"][data-figure="1"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Equip Codex of the Ashen Schism");

    inspector?.querySelector<HTMLElement>('[data-guild="equip"]')?.click();
    expect(Living.equipRelic).toHaveBeenCalledWith(5, 1);
  });

  it("leases a vault relic to a state from the state card", () => {
    Object.assign(mocks.state.guild, {
      relics: [
        {
          id: 6,
          name: "Crown of the Vhaelen Emperors",
          category: "regalia",
          lore: "A symbol of legitimacy.",
          originYear: 812,
          bonuses: { s: 2 },
          holder: { kind: "vault" }
        }
      ]
    });
    mocks.state.recentNews = [
      { tick: 1, year: 1000, season: 0, kind: "develop", text: "Aeloria prospers.", cell: 1, stateId: 1 }
    ];
    LivingHud.open();
    document.querySelector<HTMLElement>("button.livingNewsItem")?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Lease Crown of the Vhaelen Emperors");

    inspector?.querySelector<HTMLElement>('[data-guild="lease"]')?.click();
    expect(Living.leaseRelic).toHaveBeenCalledWith(6, 1);
  });

  it("excavates a site instantly in Sandbox God Mode", () => {
    Object.assign(mocks.state.guild, { sandboxGodMode: true });
    pack.markers = [
      { i: 2, type: "necropolises", icon: "⚱️", x: 10, y: 10, cell: 1, name: "Barrow of Kings" }
    ] as unknown as typeof pack.markers;
    LivingHud.open();

    document.querySelector<HTMLElement>('#livingHudGuild [data-guild="inspect-marker"]')?.click();
    const inspector = document.getElementById("livingInspector");

    inspector?.querySelector<HTMLElement>('[data-god="excavate-marker"]')?.click();
    expect(Living.excavateMarker).toHaveBeenCalledWith(2);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("excavated instantly");
  });

  it("opens the dilemma card from a petition popup and decides it", () => {
    mocks.state.guild.popups = [
      {
        id: 3,
        kind: "guild_petition",
        cell: 1,
        title: "The Harsh Levy",
        subtitle: "Aeloria begs the Guild to put down the demagogue.",
        createdTick: 0,
        expiresAtTick: 5,
        provinceId: 1,
        stateId: 1,
        petitionId: "harsh_levy",
        rewardGold: 0,
        rewardRenown: 0
      }
    ];
    LivingHud.open();

    // clicking the popup opens the dilemma card instead of claiming a bounty
    document
      .querySelector<SVGElement>('.livingPopup[data-kind="guild_petition"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(Living.claimPopup).not.toHaveBeenCalled();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("The Harsh Levy");
    expect(inspector?.textContent).toContain("Fund the Militia");
    expect(inspector?.textContent).toContain("Let Them Squabble");

    inspector?.querySelector<HTMLElement>('[data-guild="petition"][data-choice="0"]')?.click();
    expect(Living.resolvePetition).toHaveBeenCalledWith(3, 0);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("the trouble was quelled");
  });

  it("lists awaiting petitions in the guild bar and opens one from its chip", () => {
    mocks.state.guild.popups = [
      {
        id: 4,
        kind: "guild_petition",
        cell: 1,
        title: "The Pretender's Bribe",
        subtitle: "An exiled lord seeks Guild recognition.",
        createdTick: 0,
        expiresAtTick: 4,
        provinceId: 1,
        stateId: 1,
        petitionId: "pretenders_bribe",
        rewardGold: 0,
        rewardRenown: 0
      }
    ];
    LivingHud.open();

    const bar = document.getElementById("livingHudGuild");
    expect(bar?.textContent).toContain("Petitions:");
    expect(bar?.textContent).toContain("The Pretender's Bribe");

    bar?.querySelector<HTMLElement>('[data-guild="inspect-petition"]')?.click();

    const inspector = document.getElementById("livingInspector");
    expect(inspector?.textContent).toContain("Back the Coup");
    expect(inspector?.textContent).toContain("Betray to the Crown");
  });

  it("illuminates the Wheel of Ages only when the age is ready to turn", () => {
    mocks.living.getEschaton.mockReturnValue(30);
    Object.assign(mocks.state.guild, { tier: 1 });
    LivingHud.open();

    expect(document.querySelector<HTMLButtonElement>("#livingHudGuild [data-wheel]")?.disabled).toBe(true);

    mocks.living.getEschaton.mockReturnValue(100);
    LivingHud.refresh();

    const wheel = document.querySelector<HTMLButtonElement>("#livingHudGuild [data-wheel]");
    expect(wheel?.disabled).toBe(false);
    wheel?.click();

    expect(Living.turnAge).toHaveBeenCalled();
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("The Second Age of Ash");
  });

  it("draws on-map bounty popups and claims one when clicked", () => {
    const popup = {
      id: 7,
      kind: "bounty_trouble",
      cell: 1,
      title: "Monsters in Northmarch",
      subtitle: "Level 5 trouble",
      createdTick: 0,
      expiresAtTick: 3,
      rewardGold: 32,
      rewardRenown: 3,
      provinceId: 1,
      stateId: 1
    };
    mocks.state.guild.popups = [popup];
    mocks.living.claimPopup.mockReturnValue(popup);

    LivingHud.open();

    const overlay = document.getElementById("livingOverlay");
    expect(overlay).toBeTruthy();

    const pin = overlay?.querySelector<SVGElement>('.livingPopup[data-popup-id="7"]');
    expect(pin).toBeTruthy();

    pin?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(Living.claimPopup).toHaveBeenCalledWith(7);
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("Bounty claimed");
    expect(document.getElementById("livingHudStatus")?.textContent).toContain("+32g");
  });
});

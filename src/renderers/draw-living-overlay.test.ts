// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    tick: 3,
    season: 1,
    states: {} as Record<number, unknown>,
    provinces: {} as Record<number, unknown>,
    burgs: {} as Record<number, unknown>,
    recentNews: [] as unknown[],
    guild: { tier: 1, gold: 0, renown: 0, popups: [] as unknown[] }
  };
  return { state, living: { getState: vi.fn(() => state) } };
});

vi.mock("@/model/physical/living-generator", () => ({ Living: mocks.living }));

import {
  collectLivingBadges,
  collectLivingVectors,
  drawLivingOverlay,
  removeLivingOverlay
} from "./draw-living-overlay";

function makePack() {
  return {
    cells: {
      p: [
        [0, 0],
        [10, 10],
        [20, 20],
        [30, 30]
      ],
      province: new Uint16Array([0, 1, 1, 1])
    },
    burgs: [
      { i: 0 },
      { i: 1, name: "Aelor", cell: 1, x: 10, y: 10, state: 1 },
      { i: 2, name: "Oakford", cell: 2, x: 20, y: 20, state: 1 }
    ],
    states: [{ i: 0 }, { i: 1, name: "Aeloria", capital: 1, center: 1 }]
  };
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  globalThis.pack = makePack() as unknown as typeof pack;

  mocks.state.tick = 3;
  mocks.state.states = {};
  mocks.state.provinces = {};
  mocks.state.recentNews = [];
  mocks.state.guild = { tier: 1, gold: 0, renown: 0, popups: [] };
});

afterEach(() => {
  removeLivingOverlay();
});

describe("collectLivingVectors", () => {
  it("draws raid lines for pending lairs and war arrows for conquer agendas", () => {
    mocks.state.provinces = {
      1: {
        provinceId: 1,
        lair: { cell: 3, raidPending: true, name: "Forest Hideout", level: 6 }
      }
    };
    mocks.state.states = {
      1: {
        stateId: 1,
        agenda: { kind: "conquer", targetBurgId: 2, label: "Take Oakford", progress: 1, required: 2 }
      }
    };

    const vectors = collectLivingVectors(mocks.state as never);

    expect(vectors.find(vector => vector.kind === "raid")).toMatchObject({ label: "Forest Hideout", from: [30, 30] });
    expect(vectors.find(vector => vector.kind === "war")).toMatchObject({
      label: "Aeloria",
      from: [10, 10],
      to: [20, 20]
    });
  });
});

describe("collectLivingBadges", () => {
  it("only surfaces outcomes from the season that just resolved", () => {
    mocks.state.recentNews = [
      { tick: 3, year: 1000, season: 1, kind: "battle", text: "Battle of Oakford!", cell: 2 },
      { tick: 2, year: 1000, season: 0, kind: "war", text: "Old news", cell: 1 }
    ];

    const badges = collectLivingBadges(mocks.state as never);

    expect(badges).toHaveLength(1);
    expect(badges[0].cell).toBe(2);
    expect(badges[0].text).toContain("Battle of Oakford");
  });
});

describe("drawLivingOverlay", () => {
  it("renders vectors, floating badges and clickable popups on the map", () => {
    mocks.state.provinces = {
      1: { provinceId: 1, lair: { cell: 3, raidPending: true, name: "Forest Hideout", level: 6 } }
    };
    mocks.state.states = {
      1: { stateId: 1, agenda: { kind: "conquer", targetBurgId: 2, label: "Take Oakford", progress: 1, required: 2 } }
    };
    mocks.state.recentNews = [{ tick: 3, year: 1000, season: 1, kind: "battle", text: "Battle of Oakford!", cell: 2 }];
    mocks.state.guild.popups = [
      {
        id: 7,
        kind: "bounty_trouble",
        cell: 1,
        title: "Monsters in Aelor",
        subtitle: "Level 5 trouble",
        createdTick: 0,
        expiresAtTick: 6,
        rewardGold: 32,
        rewardRenown: 3
      }
    ];

    drawLivingOverlay();

    const overlay = document.getElementById("livingOverlay");
    expect(overlay).toBeTruthy();
    expect(overlay?.querySelector(".livingVector-raid")).toBeTruthy();
    expect(overlay?.querySelector(".livingVector-war")).toBeTruthy();
    expect(overlay?.querySelector(".livingFloatBadge")).toBeTruthy();

    const popup = overlay?.querySelector('.livingPopup[data-popup-id="7"]');
    expect(popup).toBeTruthy();
    expect(popup?.querySelector("title")?.textContent).toContain("+32g");

    // countdown = expiresAtTick - tick (6 - 3)
    expect(popup?.querySelector(".livingPopupCountdown text")?.textContent).toBe("3");
  });

  it("is a no-op when the map is not mounted", () => {
    document.body.innerHTML = "";

    expect(() => drawLivingOverlay()).not.toThrow();
    expect(document.getElementById("livingOverlay")).toBeNull();
  });

  it("removes the overlay and its stylesheet", () => {
    drawLivingOverlay();
    expect(document.getElementById("livingOverlay")).toBeTruthy();

    removeLivingOverlay();

    expect(document.getElementById("livingOverlay")).toBeNull();
    expect(document.getElementById("livingOverlayStyle")).toBeNull();
  });
});

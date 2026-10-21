// The campaign's storage: a campaign is a session over a world, so it lives in the browser keyed
// by the map's id — not inside the `.map` file. These tests pin the round trip that makes a
// campaign survive a browser restart.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Command } from "@/conquest/engine/game/commandTypes";
import { campaignSlotOf, getSlot, SLOT_VERSION, setSlot } from "@/conquest/store/mod-slot";

const MAP_ID = 42;
const KEY = `conquest-${MAP_ID}`;

let store: Map<string, string>;

const campaign = campaignSlotOf(
  { id: "test-1-7", mapPackId: "world-1", factionId: 3, seed: 7, turn: 12, contentHash: "rules" },
  [{ type: "EndTurn" } as Command],
  "worldhash"
);

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("ldb", {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    })
  });
  vi.stubGlobal("Layers", { state: { active: ["states", "twArmies", "twRegions"] } });
  vi.stubGlobal("mapHistory", [{ created: MAP_ID }]);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the campaign store", () => {
  it("writes the campaign under the map's key", async () => {
    setSlot({ campaign });
    await vi.advanceTimersByTimeAsync(500); // the write is debounced

    expect(store.has(KEY)).toBe(true);
    const stored = JSON.parse(store.get(KEY)!);
    expect(stored.v).toBe(SLOT_VERSION);
    expect(stored.campaign.id).toBe("test-1-7");
    expect(stored.campaign.commands).toHaveLength(1);
  });

  it("records only the campaign's own layers", async () => {
    setSlot({ campaign });
    await vi.advanceTimersByTimeAsync(500);

    const stored = JSON.parse(store.get(KEY)!);
    expect(stored.ui.layers).toEqual(["twArmies", "twRegions"]); // the stock layers are not ours
  });

  it("reads a stored campaign back after a restart", async () => {
    store.set(KEY, JSON.stringify({ v: SLOT_VERSION, campaign }));
    vi.resetModules(); // a fresh page: the module starts with an empty slot
    const fresh = await import("@/conquest/store/mod-slot");

    await fresh.loadSlot();

    const pending = fresh.pendingSlot();
    expect(pending?.campaign?.id).toBe("test-1-7");
    expect(pending?.campaign?.turn).toBe(12);
    expect(fresh.getSlot().campaign?.factionId).toBe(3);
  });

  it("has nothing pending for a world with no stored campaign", async () => {
    vi.resetModules();
    const fresh = await import("@/conquest/store/mod-slot");

    await fresh.loadSlot();

    expect(fresh.pendingSlot()).toBeNull();
  });

  it("refuses a stored slot written by another build", async () => {
    store.set(KEY, JSON.stringify({ v: SLOT_VERSION + 1, campaign }));
    vi.resetModules();
    const fresh = await import("@/conquest/store/mod-slot");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await fresh.loadSlot();

    expect(fresh.pendingSlot()).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the slot's version when it is updated", () => {
    setSlot({ campaign });
    expect(getSlot().v).toBe(SLOT_VERSION);
  });
});

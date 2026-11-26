// The sample of history a generated map starts with
import { beforeAll, describe, expect, it, vi } from "vitest";
import { States } from "@/model/political/states-generator";
import { generateMap, living } from "@/model/real-map.testing";
import { Dates } from "./dates";
import { Events, type WarEvent } from "./events";

beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));

const wars = () => Events.list({ type: "war" });
const past = () => wars().filter(war => war.end !== undefined);
const pairKey = (war: WarEvent) => [war.attackers[0], war.defenders[0] ?? 0].sort((a, b) => a - b).join("-");

describe("Generated history", () => {
  it("keeps three past wars for five states, twenty at most", async () => {
    options.generation.states.limit = 25;
    await generateMap({ seed: "history-25" });
    expect(past()).toHaveLength(Math.min(20, Math.round(living(pack.states).length * 0.6)));
    options.generation.states.limit = 40;
    await generateMap({ seed: "history-40", points: 6000 });
    expect(past()).toHaveLength(20);
  });

  it("gives a neighbouring pair one past war at most, by its more expansionist state", async () => {
    options.generation.states.limit = 25;
    await generateMap({ seed: "history-pairs" });
    const keys = past()
      .filter(war => war.defenders.length)
      .map(pairKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const war of past()) {
      expect(war.tags).toContain("war");
      if (!war.defenders.length) continue; // a vanished foe
      const [attacker, defender] = [pack.states[war.attackers[0]], pack.states[war.defenders[0]]];
      expect(attacker.neighbors).toContain(defender.i);
      expect(attacker.expansionism >= defender.expansionism).toBe(true);
    }
  });

  it("generates wars alone: no battle is made up for them", async () => {
    await generateMap({ seed: "history-battles" });
    expect(wars().length).toBeGreaterThan(0);
    expect(Events.list({ type: "battle" })).toEqual([]);
  });

  it("gives ongoing wars their sides and every vassal its vassalage, none begun this year", async () => {
    await generateMap({ seed: "history-relations" });
    const present = Events.present();
    for (const war of Events.list({ type: "war", ongoing: true })) {
      expect(war.attackers.length && war.defenders.length).toBeTruthy();
      for (const a of war.attackers) for (const d of war.defenders) expect(pack.states[a].diplomacy![d]).toBe("Enemy");
      expect(Dates.compare(war.start, present)).toBeLessThan(0);
      const previous = past().filter(other => pairKey(other) === pairKey(war));
      for (const other of previous) expect(Dates.compare(other.end!, war.start)).toBeLessThan(0);
    }
    expect(Events.list({ type: "alliance" })).toEqual([]);
    const vassals = living(pack.states).flatMap(state =>
      (state.diplomacy ?? []).flatMap((relation, other) => (relation === "Vassal" ? [[state.i, other]] : []))
    );
    const vassalages = Events.list({ type: "vassalage" });
    expect(vassalages).toHaveLength(vassals.length);
    for (const event of vassalages) expect(Dates.compare(event.start, present)).toBeLessThan(0);

    States.generateDiplomacy();
    States.generateDiplomacy();
    const ongoing = Events.list().filter(event => event.type !== "battle" && event.end === undefined);
    const enemies = new Set(Events.list({ type: "war", ongoing: true }).map(pairKey));
    expect(enemies.size).toBe(Events.list({ type: "war", ongoing: true }).length);
    expect(ongoing.length).toBe(
      Events.list({ type: "war", ongoing: true }).length + Events.list({ type: "vassalage" }).length
    );
  });

  it("keeps founding notes and battlefields for states with no past war", async () => {
    await generateMap({ seed: "history-notes" });
    const quiet = living(pack.states).filter(state => !Events.list({ type: "war", state: state.i }).length);
    expect(quiet.length).toBeGreaterThan(0);
    for (const state of quiet)
      for (const regiment of state.military ?? []) expect(regiment.note).toMatch(/was formed in/);
  });
});

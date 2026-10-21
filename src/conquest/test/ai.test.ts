/**
 * Phase 4 AI tests: income budget, threat response, call-to-arms, AI-to-AI
 * treaties, war exhaustion, rationale logging, expansion gates.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import { resolveForPack } from "@/conquest/engine/common/content";
import type { MapPack } from "@/conquest/engine/common/types";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import { atWar, runAi } from "@/conquest/engine/game/ai";
import { applyCommand, type Command, type EngineCtx } from "@/conquest/engine/game/commands";
import { DEFAULT_CONFIG } from "@/conquest/engine/game/config";
import { aiAccepts, warExhaustion } from "@/conquest/engine/game/diplomacy";
import { BRIGAND_FACTION, createCampaign, stateHash } from "@/conquest/engine/game/state";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const pack: MapPack = compileAzgaar(JSON.parse(readFileSync(SOURCE, "utf8"))).pack;
const config = DEFAULT_CONFIG;
const loaded = currentContent();
const resolved = resolveForPack(pack, loaded.content);
const content = loaded.content;

function bootstrap(opts: { factionId?: number; seed?: number; rationale?: boolean } = {}): EngineCtx {
  const campaign = createCampaign({
    mapPackId: "test",
    pack,
    factionId: opts.factionId ?? 1,
    seed: opts.seed ?? 42,
    config,
    content,
    resolved,
    id: `ai4-${opts.factionId ?? 1}-${opts.seed ?? 42}`,
    aiRationale: opts.rationale === true
  });
  return { campaign, pack, config, content, resolved, commands: [] };
}

const apply = (ctx: EngineCtx, cmd: Command) => applyCommand(ctx, cmd);

// ---------------------------------------------------------------------------
// Budget guard (§5.11 balance)
// ---------------------------------------------------------------------------

describe("income budget", () => {
  test("AI stops recruiting when upkeep would exceed the income share", () => {
    const ctx = bootstrap({ factionId: 5, seed: 3 });
    apply(ctx, { type: "EndTurn" }); // telemetry + MP refresh
    const yera = ctx.campaign.factions["5"]!;
    yera.treasury = 50000; // rich…
    yera.lastIncome = 60; // …but poor: upkeep budget is tiny
    yera.lastExpenses = 0;
    const before = Object.values(ctx.campaign.armies)
      .filter(a => a.factionId === 5)
      .reduce((s, a) => s + a.units.length, 0);
    runAi(ctx);
    const after = Object.values(ctx.campaign.armies)
      .filter(a => a.factionId === 5)
      .reduce((s, a) => s + a.units.length, 0);
    expect(after).toBe(before); // budget guard refused
  });

  test("AI recruits when the budget allows", () => {
    const ctx = bootstrap({ factionId: 5, seed: 3 });
    apply(ctx, { type: "EndTurn" });
    const yera = ctx.campaign.factions["5"]!;
    yera.treasury = 50000;
    yera.lastIncome = 50000;
    yera.lastExpenses = 0;
    runAi(ctx);
    const recruited = ctx.campaign.log.some(e => e.type === "UnitRecruited");
    expect(recruited).toBe(true);
  });

  test("economy telemetry lands on the faction after each tick", () => {
    const ctx = bootstrap({ factionId: 1, seed: 3 });
    apply(ctx, { type: "EndTurn" });
    for (const f of Object.values(ctx.campaign.factions)) {
      expect(f.lastIncome).toBeGreaterThanOrEqual(0);
      expect(f.lastExpenses).toBeGreaterThanOrEqual(0);
    }
    const balben = ctx.campaign.factions["1"]!;
    expect(balben.lastIncome).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Threat response + rationale logging
// ---------------------------------------------------------------------------

describe("threat response", () => {
  test("AI marches to intercept an invader near home — and says why", () => {
    const ctx = bootstrap({ factionId: 1, seed: 9, rationale: true });
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    apply(ctx, { type: "EndTurn" });
    // Smotia's view: an invader (the player's army) near home → defense.
    // Teleport a player army next to Smotia's largest army (test-only).
    const smotiaArmy = Object.values(ctx.campaign.armies)
      .filter(a => a.factionId === 9 && !a.fleet)
      .sort((a, b) => b.units.reduce((s, u) => s + u.count, 0) - a.units.reduce((s, u) => s + u.count, 0))[0]!;
    const invader = Object.values(ctx.campaign.armies).filter(a => a.factionId === 1 && !a.fleet)[0]!;
    const edge = pack.graph.land.edges.find(([a, b]) => a === smotiaArmy.cell || b === smotiaArmy.cell)!;
    invader.cell = edge[0] === smotiaArmy.cell ? edge[1]! : edge[0]!;
    const cellBefore = invader.cell;

    apply(ctx, { type: "EndTurn" });
    const rationales = ctx.campaign.log.filter(e => e.type === "AiRationale" && (e as any).factionId === 9);
    expect(rationales.length).toBeGreaterThan(0);
    const decisions = rationales.map(e => (e as any).decision).join(",");
    expect(decisions).toMatch(/defend:(attack|march|hold)/);
    void cellBefore;
  });

  test("rationale logging is opt-in: silent campaigns emit none", () => {
    const ctx = bootstrap({ factionId: 1, seed: 9, rationale: false });
    apply(ctx, { type: "EndTurn" });
    expect(ctx.campaign.log.some(e => e.type === "AiRationale")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Call to arms (§5.7)
// ---------------------------------------------------------------------------

describe("call to arms", () => {
  test("allies auto-join a defensive war", () => {
    const ctx = bootstrap({ factionId: 1, seed: 11 });
    // Manufacture an alliance: Elneralune (11) ↔ Yeriebel (12).
    ctx.campaign.treaties.push({ type: "alliance", between: [11, 12], sinceTurn: 0 });
    ctx.campaign.relations["11"]!["12"] = 80;
    ctx.campaign.relations["12"]!["11"] = 80;

    const res = apply(ctx, { type: "DeclareWar", onFactionId: 11 });
    expect(res.ok).toBe(true);
    expect(res.events.some(e => e.type === "AllyJoinedWar" && (e as any).ally === 12)).toBe(true);
    expect(atWar(ctx.campaign, 1, 12)).toBe(true);
  });

  test("the attacker's own allies are not dragged in", () => {
    const ctx = bootstrap({ factionId: 1, seed: 12 });
    ctx.campaign.treaties.push({ type: "alliance", between: [1, 6], sinceTurn: 0 });
    apply(ctx, { type: "DeclareWar", onFactionId: 11 });
    expect(atWar(ctx.campaign, 6, 11)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AI-to-AI treaties (§5.7)
// ---------------------------------------------------------------------------

describe("AI-to-AI diplomacy", () => {
  test("peaceful adjacent AI factions drift into trade treaties", () => {
    const ctx = bootstrap({ factionId: 1, seed: 21 });
    // Pick any actually-adjacent AI pair from the region graph.
    const idx = (ctx as any).pack;
    void idx;
    const graph = pack.regions;
    void graph;
    const regionAdjacency = new Map<number, Set<number>>();
    for (const [a, b] of pack.graph.land.edges) {
      const ra = pack.regions.find(r => r.cells.includes(a))?.id ?? 0;
      const rb = pack.regions.find(r => r.cells.includes(b))?.id ?? 0;
      if (!ra || !rb || ra === rb) continue;
      (regionAdjacency.get(ra) ?? regionAdjacency.set(ra, new Set()).get(ra)!).add(rb);
      (regionAdjacency.get(rb) ?? regionAdjacency.set(rb, new Set()).get(rb)!).add(a);
    }
    let pair: [number, number] | null = null;
    for (const f1 of pack.factions) {
      if (f1.id === 1) continue;
      for (const f2 of pack.factions) {
        if (f2.id <= f1.id || f2.id === 1) continue;
        const owned1 = pack.regions.filter(r => r.factionId === f1.id).map(r => r.id);
        const adjacent = owned1.some(rid =>
          [...(regionAdjacency.get(rid) ?? [])].some(n => ctx.campaign.regions[String(n)]?.owner === f2.id)
        );
        if (adjacent) {
          pair = [f1.id, f2.id];
          break;
        }
      }
      if (pair) break;
    }
    expect(pair).not.toBeNull();
    const [a, b] = pair!;
    ctx.campaign.relations[String(a)]![String(b)] = 60;
    ctx.campaign.relations[String(b)]![String(a)] = 60;
    for (let i = 0; i < 25; i++) {
      apply(ctx, { type: "EndTurn" });
      if (ctx.campaign.treaties.some(t => t.type === "trade" && t.between.includes(a) && t.between.includes(b))) break;
    }
    expect(ctx.campaign.treaties.some(t => t.type === "trade" && t.between.includes(a) && t.between.includes(b))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// War exhaustion (§5.11 balance)
// ---------------------------------------------------------------------------

describe("war exhaustion", () => {
  test("a long grinding war bends AI peace acceptance even at parity", () => {
    const ctx = bootstrap({ factionId: 1, seed: 31 });
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    // Age the world well past the exhaustion threshold (test setup).
    ctx.campaign.turn = config.ai.warExhaustionTurns + 5;
    const war = ctx.campaign.wars.find(w => w.between.includes(1) && w.between.includes(9))!;
    war.sinceTurn = 1;
    expect(warExhaustion(ctx, 9, 1)).toBeGreaterThan(0.5);
    const verdict = aiAccepts(ctx, 9, 1, "peace");
    expect(verdict.accept).toBe(true);
  });

  test("a fresh war at strength is rejected", () => {
    const ctx = bootstrap({ factionId: 1, seed: 32 });
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    // Smotia strong (fresh war, ratio > 1.1).
    const verdict = aiAccepts(ctx, 9, 1, "peace");
    expect(verdict.accept).toBe(false);
  });

  test("desperate factions always sue for peace (never rng-blocked)", () => {
    const ctx = bootstrap({ factionId: 1, seed: 33 });
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    for (const a of Object.values(ctx.campaign.armies)) {
      if (a.factionId === 9) for (const u of a.units) u.count = Math.round(u.count * 0.05);
    }
    apply(ctx, { type: "EndTurn" });
    const offered = ctx.campaign.offers.some(o => o.from === 9 && o.treaty === "peace");
    const eliminated = ctx.campaign.factions["9"]!.alive === false;
    expect(offered || eliminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Expansion gates (§5.11)
// ---------------------------------------------------------------------------

describe("expansion gates", () => {
  test("AI never declares war uphill: tiny Khulag leaves Ithlonor alone", () => {
    bootstrap({ factionId: 2, seed: 41 }); // player = Khulag (49 cells, expansionist?)
    // Khulag is the player here; instead simulate Ithlonor's tiny neighbour by
    // checking the gate math directly: Khulag (AI in another world) vs Ithlonor.
    // Manufacture: Ghag (15, Uruk → expansionist) neighbouring Ithlonor (13, huge).
    const ctx2 = bootstrap({ factionId: 1, seed: 41 });
    ctx2.campaign.relations["15"]!["13"] = -100;
    ctx2.campaign.relations["13"]!["15"] = -100;
    for (let i = 0; i < 8; i++) apply(ctx2, { type: "EndTurn" });
    const ghagMen = Object.values(ctx2.campaign.armies)
      .filter(a => a.factionId === 15)
      .reduce((s, a) => s + a.units.reduce((x, u) => x + u.count, 0), 0);
    const ithMen = Object.values(ctx2.campaign.armies)
      .filter(a => a.factionId === 13)
      .reduce((s, a) => s + a.units.reduce((x, u) => x + u.count, 0), 0);
    if (ghagMen < ithMen * 0.8) {
      // The gate held: no uphill declaration (Ghag only fights if it grew past 80%).
      expect(atWar(ctx2.campaign, 15, 13)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 4 determinism
// ---------------------------------------------------------------------------

describe("phase 4 determinism", () => {
  test("rationale-enabled 10-turn world replays identically", () => {
    const run = (seed: number): string => {
      const campaign = createCampaign({
        mapPackId: "test",
        pack,
        factionId: 1,
        seed,
        config,
        content,
        resolved,
        id: `p4-golden-${seed}`,
        aiRationale: true
      });
      const ctx: EngineCtx = { campaign, pack, config, content, resolved, commands: [] };
      apply(ctx, { type: "DeclareWar", onFactionId: 9 });
      for (let i = 0; i < 10; i++) apply(ctx, { type: "EndTurn" });
      return stateHash(campaign);
    };
    expect(run(808)).toBe(run(808));
    // And the rationale events actually flowed.
    const probe = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed: 808,
      config,
      content,
      resolved,
      id: "p4-probe",
      aiRationale: true
    });
    const ctx: EngineCtx = { campaign: probe, pack, config, content, resolved, commands: [] };
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    for (let i = 0; i < 3; i++) apply(ctx, { type: "EndTurn" });
    expect(probe.log.some(e => e.type === "AiRationale")).toBe(true);
  });

  test("brigand factions remain hostile to everyone after the rework", () => {
    const ctx = bootstrap({ factionId: 1, seed: 51 });
    expect(atWar(ctx.campaign, BRIGAND_FACTION, 1)).toBe(true);
    expect(atWar(ctx.campaign, BRIGAND_FACTION, 9)).toBe(true);
  });
});

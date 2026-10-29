/**
 * Unified-figures slice 1 (docs/plans/unified-figures.md):
 *  - recruiting a character mints a figure into the map's roster and links it
 *  - xp, skill spends and death mirror onto the figure
 *  - a specialist roster unit musters under a named commander; no duplicates
 *  - the same seed rolls the same traits; legacy contexts (no roster) still run
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
import { grantXp, recruitCharacter, spendSkillPoint } from "@/conquest/engine/game/characters";
import { applyCommand, type Command, type EngineCtx } from "@/conquest/engine/game/commands";
import { type CampaignConfig, DEFAULT_CONFIG } from "@/conquest/engine/game/config";
import { syncCharacterFigure } from "@/conquest/engine/game/figures";
import { type Campaign, createCampaign } from "@/conquest/engine/game/state";
import type { HistoricalFigure } from "@/types/history";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack: MapPack = compileAzgaar(raw).pack;

const config = DEFAULT_CONFIG;
const loadedContent = currentContent();
const content = loadedContent.content;
const resolved = resolveForPack(pack, content);

function bootstrap(
  seed = 42,
  withRoster = true
): { ctx: EngineCtx; campaign: Campaign; commands: Command[]; figures: HistoricalFigure[] } {
  const commands: Command[] = [];
  const figures: HistoricalFigure[] = [];
  const campaign = createCampaign({
    mapPackId: "test",
    pack,
    factionId: 1,
    seed,
    config,
    content,
    resolved,
    id: `test-1-${seed}`
  });
  const ctx: EngineCtx = {
    campaign,
    pack,
    config,
    content,
    resolved,
    commands,
    ...(withRoster ? { figures } : {})
  };
  campaign.factions["1"]!.treasury = 100_000; // recruiting tests need a purse
  // the sample world binds faction 1 to a cultural roster; the specialists under
  // test live on the default one, so rebind for these recruiting tests
  resolved.factions["1"]!.roster = content.rosters[content.defaultRoster]!;
  // open every building and tech gate so unit recruiting tests reach the mint
  for (const region of Object.values(campaign.regions)) {
    if (region.owner !== 1) continue;
    for (const building of content.buildings)
      if (!region.buildings.includes(building.id)) region.buildings.push(building.id);
  }
  campaign.factions["1"]!.tech = content.tech.map(t => t.id);
  return { ctx, campaign, commands, figures };
}

describe("character → figure minting", () => {
  test("recruiting a lord mints a linked general figure", () => {
    const { ctx, figures } = bootstrap();
    const result = recruitCharacter(ctx, 1, "lord", Object.keys(ctx.campaign.armies)[0]);
    expect(result.ok).toBe(true);
    const character = Object.values(ctx.campaign.characters).find(c => c.figureId !== undefined)!;
    const figure = figures[character.figureId!];
    expect(figure).toBeDefined();
    expect(figure.name).toBe(character.name);
    expect(figure.roles).toHaveLength(1);
    expect(figure.roles[0]!.type).toBe("general");
    expect(figure.roles[0]!.target).toEqual({ kind: "state", id: 1 });
    expect(figure.alignment).toBeDefined();
    expect(figure.virtues!.length + figure.vices!.length).toBeGreaterThan(0);
  });

  test("the same seed rolls the same figure traits", () => {
    const first = bootstrap();
    recruitCharacter(first.ctx, 1, "assassin");
    const second = bootstrap();
    recruitCharacter(second.ctx, 1, "assassin");
    expect(second.figures).toEqual(first.figures);
  });

  test("recruited assassins and diplomats become agent figures", () => {
    const { ctx, figures } = bootstrap();
    recruitCharacter(ctx, 1, "assassin");
    recruitCharacter(ctx, 1, "diplomat");
    const roles = figures.flatMap(f => f.roles.map(r => `${r.type}/${r.specialty ?? "-"}`));
    expect(roles).toContain("agent/assassin");
    expect(roles).toContain("agent/diplomat");
  });

  test("replaying the same recruit reuses the figure instead of duplicating it", () => {
    const figures: HistoricalFigure[] = [];
    const first = bootstrap(42, true);
    first.ctx.figures = figures;
    recruitCharacter(first.ctx, 1, "diplomat");
    const count = figures.length;
    const replay = bootstrap(42, true);
    replay.ctx.figures = figures;
    recruitCharacter(replay.ctx, 1, "diplomat");
    expect(figures.length).toBe(count);
  });

  test("legacy contexts without a roster mint nothing", () => {
    const { ctx } = bootstrap(42, false);
    const result = recruitCharacter(ctx, 1, "lord");
    expect(result.ok).toBe(true);
    expect(Object.values(ctx.campaign.characters)[0]!.figureId).toBeUndefined();
  });
});

describe("character → figure mirroring", () => {
  test("grantXp writes lifetime xp onto the figure", () => {
    const { ctx, figures } = bootstrap();
    recruitCharacter(ctx, 1, "lord");
    const character = Object.values(ctx.campaign.characters)[0]!;
    grantXp(ctx, character.id, 30);
    expect(figures[character.figureId!]!.xp).toBe(30);
  });

  test("skill spends train the mapped pool (combat → m, campaign → c, economy → w)", () => {
    const { ctx, figures } = bootstrap();
    recruitCharacter(ctx, 1, "lord");
    const character = Object.values(ctx.campaign.characters)[0]!;
    character.skillPoints = 3;
    spendSkillPoint(ctx, character.id, "combat");
    spendSkillPoint(ctx, character.id, "campaign");
    spendSkillPoint(ctx, character.id, "economy");
    const skills = figures[character.figureId!]!.skills!;
    expect(skills).toEqual({ m: 1, w: 1, s: 0, c: 1 });
  });

  test("a slain character closes its figure's life", () => {
    const { ctx, figures } = bootstrap();
    recruitCharacter(ctx, 1, "assassin");
    const character = Object.values(ctx.campaign.characters)[0]!;
    character.alive = false;
    syncCharacterFigure(ctx, character);
    const figure = figures[character.figureId!]!;
    expect(figure.death).toBe(ctx.campaign.year);
    expect(figure.roles.every(r => r.to !== undefined)).toBe(true);
  });
});

describe("capacity mode: figures recruit on pools, not gold", () => {
  // docs/plans/unified-figures.md slice 1 rides the existing recruiting gates:
  // the pools are the economy, and gold only prices the flag-off legacy game.
  const capacityConfig: CampaignConfig = {
    ...DEFAULT_CONFIG,
    economy: { ...DEFAULT_CONFIG.economy, capacityMode: true }
  };

  test("a character recruits on free Social with an empty treasury", () => {
    const { ctx, figures } = bootstrap();
    ctx.config = capacityConfig;
    ctx.campaign.factions["1"]!.treasury = 0;
    const result = recruitCharacter(ctx, 1, "diplomat");
    expect(result.error ?? "ok").toBe("ok");
    const character = Object.values(ctx.campaign.characters).find(c => c.figureId !== undefined)!;
    expect(figures[character.figureId!]!.roles[0]!.specialty).toBe("diplomat");
    expect(ctx.campaign.factions["1"]!.treasury).toBe(0); // no gold moved
  });

  test("a specialist unit musters a commander on free pools with an empty treasury", () => {
    const { ctx, figures } = bootstrap();
    ctx.config = capacityConfig;
    ctx.campaign.factions["1"]!.treasury = 0;
    const army = Object.values(ctx.campaign.armies).find(a => a.factionId === 1)!;
    if (army.units.length > 15) army.units.splice(0, army.units.length - 15);
    const first = applyCommand(ctx, { type: "RecruitUnit", armyId: army.id, unitType: "guardsmen" });
    expect(first.error ?? "ok").toBe("ok");
    expect(figures.filter(f => f.roles.some(r => r.type === "specialist" && r.specialty === "guardsmen"))).toHaveLength(1);
    expect(ctx.campaign.factions["1"]!.treasury).toBe(0); // no gold moved
  });
});

describe("specialist roster roll-in", () => {
  test("recruiting a specialist unit mints one commander; re-recruiting reuses it", () => {
    const { ctx, figures } = bootstrap();
    const army = Object.values(ctx.campaign.armies).find(a => a.factionId === 1)!;
    if (army.units.length > 15) army.units.splice(0, army.units.length - 15);
    const first = applyCommand(ctx, { type: "RecruitUnit", armyId: army.id, unitType: "sage_coven" });
    expect(first.error ?? "ok").toBe("ok");
    const lores = figures.filter(f => f.roles.some(r => r.type === "specialist" && r.specialty === "sage"));
    expect(lores).toHaveLength(1);
    expect(lores[0]!.skills!.w).toBe(1);
    const again = applyCommand(ctx, { type: "RecruitUnit", armyId: army.id, unitType: "sage_coven" });
    expect(again.error ?? "ok").toBe("ok");
    expect(figures.filter(f => f.roles.some(r => r.type === "specialist" && r.specialty === "sage"))).toHaveLength(1);
  });

  test("the new agent units are recruitable and field no commander mint", () => {
    const { ctx, figures } = bootstrap();
    const army = Object.values(ctx.campaign.armies).find(a => a.factionId === 1)!;
    if (army.units.length > 15) army.units.splice(0, army.units.length - 15);
    const blades = applyCommand(ctx, { type: "RecruitUnit", armyId: army.id, unitType: "assassins" });
    expect(blades.error ?? "ok").toBe("ok");
    const envoys = applyCommand(ctx, { type: "RecruitUnit", armyId: army.id, unitType: "envoys" });
    expect(envoys.error ?? "ok").toBe("ok");
    // agents carry no troubleRole: they muster as bodies without a commander mint
    expect(figures.filter(f => f.roles.some(r => r.type === "specialist"))).toHaveLength(0);
  });
});

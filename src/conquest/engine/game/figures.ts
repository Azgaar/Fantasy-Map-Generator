/**
 * Figures (unified-figures slice 1): campaign characters link into the map's
 * figure roster (`pack.history.figures`). The figure is the named person —
 * identity, traits, position, lifetime xp — and the campaign `Character` is the
 * overlay. Minting never touches the campaign RNG stream: everything derives
 * from `traitsRng`, so replaying an old command log reproduces the same figures
 * without shifting any other roll.
 */

import { rollAlignment, rollFigureTraits, traitsRng } from "@/data/culture-traits";
import { UNIT_ROLE_POOLS } from "@/data/living-troubles";
import type { HistoricalFigure, HistoricalRoleType } from "@/types/history";
import type { TroubleUnitRole } from "@/types/living";
import type { EngineCtx } from "./context";
import type { Character } from "./state";

/** the chronicle role (and specialty) each conquest kind maps onto */
export const KIND_ROLES: Record<Character["kind"], { role: HistoricalRoleType; specialty?: string }> = {
  lord: { role: "general" },
  assassin: { role: "agent", specialty: "assassin" },
  diplomat: { role: "agent", specialty: "diplomat" },
  bodyguard: { role: "agent", specialty: "bodyguard" }
};

/** the figure pool each conquest skill branch trains */
export const BRANCH_POOL: Record<keyof Character["skills"], "m" | "w" | "s" | "c"> = {
  combat: "m",
  campaign: "c",
  economy: "w"
};

/** the numeric suffix of a campaign character id ("c12" → 12) */
export function characterNumber(id: string): number {
  return Number.parseInt(id.slice(1), 10) || 0;
}

function campaignTraits(ctx: EngineCtx, id: string) {
  const rng = traitsRng(String(ctx.campaign.seed), "campaign", characterNumber(id));
  const alignment = rollAlignment(rng);
  return { rng, alignment, ...rollFigureTraits(rng, alignment) };
}

/** The figure a character is linked to, if the roster is attached and the link resolves. */
export function figureOf(ctx: EngineCtx, character: Character): HistoricalFigure | undefined {
  if (character.figureId === undefined) return undefined;
  return ctx.figures?.[character.figureId];
}

function cultureOf(ctx: EngineCtx, factionId: number): number | undefined {
  const faction = ctx.pack.factions.find(f => f.id === factionId);
  return ctx.pack.cultures.find(c => c.i === faction?.culture)?.i;
}

/** a name from the faction's culture name pool, drawn on the given stream — never the campaign RNG */
function poolName(ctx: EngineCtx, factionId: number, rng: ReturnType<typeof traitsRng>): string {
  const faction = ctx.pack.factions.find(f => f.id === factionId);
  const culture = ctx.pack.cultures.find(c => c.i === faction?.culture);
  const pool = ctx.pack.namePools[String(culture?.base)] ?? [];
  return pool.length > 0 ? pool[rng.int(0, pool.length - 1)]! : `Commander of ${faction?.name ?? factionId}`;
}

/**
 * Mint the figure for a freshly recruited character and link it. Reuses an
 * existing figure of the same name, role and employer, so replaying a command
 * log (campaign load, rules swap) never duplicates people.
 */
export function mintCharacterFigure(ctx: EngineCtx, character: Character): HistoricalFigure | undefined {
  const figures = ctx.figures;
  if (!figures) return undefined;
  const { role, specialty } = KIND_ROLES[character.kind];
  const existing = figures.find(
    f =>
      f.name === character.name &&
      !f.death &&
      f.roles.some(
        r =>
          r.type === role &&
          r.specialty === specialty &&
          r.target.kind === "state" &&
          r.target.id === character.factionId
      )
  );
  if (existing) {
    character.figureId = existing.i;
    return existing;
  }

  const { rng, alignment, virtues, vices } = campaignTraits(ctx, character.id);
  const figure: HistoricalFigure = {
    i: figures.length,
    name: character.name,
    culture: cultureOf(ctx, character.factionId) ?? 0,
    birth: ctx.campaign.year - rng.int(22, 40),
    roles: [
      {
        type: role,
        ...(specialty !== undefined ? { specialty } : {}),
        target: { kind: "state", id: character.factionId },
        from: ctx.campaign.year
      }
    ],
    alignment,
    virtues,
    vices,
    cell: character.cell,
    xp: 0,
    skills: { m: 0, w: 0, s: 0, c: 0 }
  };
  figures.push(figure);
  character.figureId = figure.i;
  return figure;
}

/**
 * Mint (or reuse) the commander figure for a specialist roster unit, e.g. the
 * Loremaster behind a coven of Learned Sages. One living commander per state
 * and specialty; re-recruiting the same specialist type serves under the
 * commander that already exists, so a replayed log never doubles the court.
 */
export function mintSpecialistCommander(
  ctx: EngineCtx,
  factionId: number,
  specialty: string,
  cell: number,
  name?: string
): HistoricalFigure | undefined {
  const figures = ctx.figures;
  if (!figures) return undefined;
  const existing = figures.find(
    f =>
      !f.death &&
      f.roles.some(
        r =>
          r.type === "specialist" && r.specialty === specialty && r.target.kind === "state" && r.target.id === factionId
      )
  );
  if (existing) return existing;

  const { rng, alignment, virtues, vices } = campaignTraits(ctx, `s${figures.length}`);
  const skills = { m: 0, w: 0, s: 0, c: 0 };
  skills[UNIT_ROLE_POOLS[specialty as TroubleUnitRole]] = 1;
  const figure: HistoricalFigure = {
    i: figures.length,
    name: name ?? poolName(ctx, factionId, rng),
    culture: cultureOf(ctx, factionId) ?? 0,
    birth: ctx.campaign.year - rng.int(25, 45),
    roles: [{ type: "specialist", specialty, target: { kind: "state", id: factionId }, from: ctx.campaign.year }],
    alignment,
    virtues,
    vices,
    cell,
    xp: 0,
    skills
  };
  figures.push(figure);
  return figure;
}

/** Write-through: the figure carries death, position and lifetime xp for the chronicle. */
export function syncCharacterFigure(ctx: EngineCtx, character: Character): void {
  const figure = figureOf(ctx, character);
  if (!figure) return;
  figure.xp = character.xp;
  figure.cell = character.cell;
  if (!character.alive && figure.death === undefined) {
    figure.death = ctx.campaign.year;
    for (const role of figure.roles) if (role.to === undefined) role.to = ctx.campaign.year;
  }
}

/** A conquest skill spend also trains the figure's pool. */
export function trainFigureSkill(ctx: EngineCtx, character: Character, branch: keyof Character["skills"]): void {
  const figure = figureOf(ctx, character);
  if (!figure) return;
  figure.skills ??= { m: 0, w: 0, s: 0, c: 0 };
  figure.skills[BRANCH_POOL[branch]]++;
}

// Group reading and word picking for polities (states) and provinces across Astral and RPG Fantasy.
import { Names } from "@/model/society/names-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";

/** The culture sets that speak in the star-map register */
export const ASTRAL_SETS = ["astralTrek", "astralJammer", "grimdark"];

/** The culture sets that speak in the RPG fantasy register */
export const RPG_SETS = ["rpgFantasy"];

/** Is the map drawn from one of the Astral culture sets? */
export function isAstralMap(): boolean {
  return (ASTRAL_SETS as string[]).includes(options.map.cultures.set);
}

/** Is the map drawn from the RPG Fantasy culture set? */
export function isRpgMap(): boolean {
  return (RPG_SETS as string[]).includes(options.map.cultures.set);
}

/** The words a sector can be called when no provinces group is provided */
export const SECTOR_WORDS = ["Sector", "Reach", "Cluster", "Belt", "Orbit", "Shelf", "Quadrant", "Frontier"];

/**
 * A stable pick from a list, seeded by a string.
 */
export function pickFor(words: string[], seed: string): string | undefined {
  if (!words.length) return undefined;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return words[hash % words.length];
}

/** The name groups of the base a culture names from, when that base has groups */
export function groupsOf(cultureId: number): Record<string, string[]> | undefined {
  const baseId = pack.cultures[cultureId]?.base;
  if (!baseId) return undefined;
  const base = Names.getNameBase(baseId);
  return base?.groups?.polities?.length ? base.groups : undefined;
}

/**
 * The word a state should be called by, e.g. "United Federation" or "Kingdom".
 *
 * The word comes from the `polities` group of the culture's own base.
 * Words containing "of" are filtered out so they do not duplicate "of" in state titles.
 */
export function polityWordFor(cultureId: number, seed: string): string | undefined {
  const words = groupsOf(cultureId)?.polities;
  if (!words?.length) return undefined;
  return pickFor(
    words.filter(word => !/\bof\b/i.test(word)),
    seed
  );
}

/**
 * The word a province should be called by, e.g. "Sector" or "Duchy".
 *
 * When the culture's base defines a `provinces` group, picks from that group.
 * Falls back to SECTOR_WORDS when no `provinces` group is defined, preserving Astral behaviour.
 */
export function sectorWordFor(a: string | number, b?: string | number): string | undefined {
  const seed = typeof a === "string" ? a : typeof b === "string" ? b : "";
  const cultureId = typeof a === "number" ? a : typeof b === "number" ? b : undefined;
  const provinceWords = cultureId !== undefined ? groupsOf(cultureId)?.provinces : undefined;
  if (provinceWords?.length) {
    return pickFor(
      provinceWords.filter(word => !/\bof\b/i.test(word)),
      seed
    );
  }
  return pickFor(SECTOR_WORDS, seed);
}

/**
 * Give the polities their words and the provinces their regional forms.
 *
 * For Astral maps, states are also renamed to match their capitals.
 * For RPG maps, states retain their fantasy names while taking their polity forms.
 * A province takes its form according to the culture of its capital burg.
 */
export function applyNaming(): { polities: number; sectors: number; renamed: number } {
  const isAstral = isAstralMap();
  let polities = 0;
  let renamed = 0;
  for (const state of pack.states) {
    if (!state.i || state.removed || !state.name) continue;
    const culture = state.culture ?? 0;
    if (!groupsOf(culture)) continue;
    const capital = state.capital ? pack.burgs[state.capital] : undefined;
    const word = polityWordFor(culture, capital?.name || state.name);
    if (!word) continue;
    if (isAstral && capital?.name && state.name !== capital.name) {
      States.rename(state.i, capital.name);
      renamed++;
    }
    States.setForm(state.i, word);
    polities++;
  }

  let sectors = 0;
  for (const province of pack.provinces) {
    if (!province.i || province.removed || !province.name) continue;
    const culture = pack.burgs[province.burg]?.culture ?? 0;
    if (!groupsOf(culture)) continue;
    const word = sectorWordFor(province.name, culture);
    if (!word) continue;
    Provinces.setForm(province.i, word);
    sectors++;
  }

  return { polities, sectors, renamed };
}

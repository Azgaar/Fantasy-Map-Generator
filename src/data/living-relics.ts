// Relic definitions and lore templates for Guild excavation (slice 3).
// See docs/plans/living-idle-guild.md section 4.
import type { HistoricalRelic, RelicCategory } from "@/types/living";
import type { Rng } from "@/utils/rng";

/** Marker types the Guild can target with excavate missions */
export const EXCAVATION_MARKER_TYPES: readonly string[] = [
  "ruins",
  "battlefields",
  "dungeons",
  "necropolises",
  "statues",
  "libraries"
];

export const isExcavationMarker = (marker: { type?: string; hidden?: boolean }): boolean =>
  !marker.hidden && EXCAVATION_MARKER_TYPES.includes(marker.type ?? "");

/** Gold per season paid by a state leasing a relic */
export const RELIC_LEASE_TRIBUTE = 10;

export interface RelicDef {
  category: RelicCategory;
  label: string;
  icon: string;
  bonuses: { m?: number; w?: number; s?: number; c?: number };
  cursed?: boolean;
  names: readonly string[];
  lore: readonly string[];
}

export const RELIC_CATALOG: Record<RelicCategory, RelicDef> = {
  regalia: {
    category: "regalia",
    label: "Regalia",
    icon: "👑",
    bonuses: { s: 2 },
    names: ["Crown of the {realm} Emperors", "Sceptre of {realm}", "Diadem of {figure}", "Throne Seal of {realm}"],
    lore: [
      "Worn by the rulers of {realm} until the realm's fall in {year}.",
      "A symbol of {realm}'s legitimacy, lost when the empire shattered.",
      "Court records say {figure} clutched it as the old capital burned."
    ]
  },
  weapon: {
    category: "weapon",
    label: "Weapon",
    icon: "⚔️",
    bonuses: { m: 2 },
    names: [
      "Greataxe of General {figure}",
      "Blade of the {realm} Legion",
      "Warhammer unearthed at {place}",
      "{figure}'s Seal-Breaker"
    ],
    lore: [
      "Forged for {figure}, who never lost a wall they stormed.",
      "Recovered from the front ranks of the field at {place}.",
      "Its edge still remembers the wars of {realm}."
    ]
  },
  tome: {
    category: "tome",
    label: "Tome",
    icon: "📖",
    bonuses: { c: 2 },
    names: ["Codex of the {realm} Schism", "The {place} Annals", "Grimoire inscribed by {figure}", "Atlas of {realm}"],
    lore: [
      "Saved from the libraries of {realm} before the fires took them.",
      "{figure} annotated its margins in exile.",
      "Scholars still dispute half of what it claims about {place}."
    ]
  },
  charter: {
    category: "charter",
    label: "Charter",
    icon: "📜",
    bonuses: { w: 2 },
    names: [
      "Golden Charter of {place}",
      "Guild Seal of {realm}",
      "Ledger of the {place} Bourse",
      "Free Charter signed by {figure}"
    ],
    lore: [
      "The trade writ that made {place} rich, buried with its archive.",
      "Stamped by {figure} and honoured by no court since {realm} fell.",
      "Whoever holds it may claim the old tolls of {place}."
    ]
  },
  idol: {
    category: "idol",
    label: "Idol",
    icon: "🗿",
    bonuses: { m: 1, c: 1 },
    cursed: true,
    names: ["Blood-Idol of {place}", "Idol of the {realm} Depths", "Effigy of {figure}", "The {place} Dread Idol"],
    lore: [
      "Screams are said to echo from it when the moon is dark over {place}.",
      "The cults of {realm} fed it well; their state did not outlast them.",
      "{figure} forbade its worship and was gone within a season."
    ]
  }
};

/** Which relic categories a marker type tends to hide */
const CATEGORY_BY_MARKER: Partial<Record<string, readonly RelicCategory[]>> = {
  ruins: ["regalia", "charter"],
  battlefields: ["weapon"],
  dungeons: ["weapon", "idol"],
  necropolises: ["tome", "idol"],
  statues: ["regalia", "idol"],
  libraries: ["tome"]
};

const ALL_CATEGORIES: readonly RelicCategory[] = ["regalia", "weapon", "tome", "charter", "idol"];

export interface RelicNameContext {
  realm?: string;
  figure?: string;
  place?: string;
  year?: number;
}

const fill = (template: string, ctx: RelicNameContext): string =>
  template
    .replaceAll("{realm}", ctx.realm ?? "a Fallen Realm")
    .replaceAll("{figure}", ctx.figure ?? "an Unnamed Hero")
    .replaceAll("{place}", ctx.place ?? "Forgotten Ruins")
    .replaceAll("{year}", String(ctx.year ?? 0));

const pickTemplate = (templates: readonly string[], ctx: RelicNameContext, rng: Rng): string => {
  const usable = templates.filter(template => !template.includes("{figure}") || ctx.figure);
  return fill(rng.choice(usable.length > 0 ? usable : templates), ctx);
};

/** Deterministically roll a lore-flavoured relic name */
export function formatRelicName(category: RelicCategory, ctx: RelicNameContext, rng: Rng): string {
  return pickTemplate(RELIC_CATALOG[category].names, ctx, rng);
}

/** Deterministically roll a lore-flavoured relic description */
export function formatRelicLore(category: RelicCategory, ctx: RelicNameContext, rng: Rng): string {
  return pickTemplate(RELIC_CATALOG[category].lore, ctx, rng);
}

/** Categories a marker of this type tends to yield */
export function relicCategoriesForMarker(type: string | undefined): readonly RelicCategory[] {
  return (type && CATEGORY_BY_MARKER[type]) || ALL_CATEGORIES;
}

export type RelicBonus = HistoricalRelic["bonuses"];

const BONUS_POOLS = ["m", "w", "s", "c"] as const;

export function sumRelicBonuses(relics: readonly HistoricalRelic[]): RelicBonus {
  const sum: RelicBonus = {};
  for (const relic of relics) {
    for (const pool of BONUS_POOLS) {
      const value = relic.bonuses[pool];
      if (value) sum[pool] = (sum[pool] ?? 0) + value;
    }
  }
  return sum;
}

export const vaultRelics = (relics: readonly HistoricalRelic[]): HistoricalRelic[] =>
  relics.filter(relic => relic.holder.kind === "vault");

export const vaultBonuses = (relics: readonly HistoricalRelic[]): RelicBonus => sumRelicBonuses(vaultRelics(relics));

export const equippedRelic = (relics: readonly HistoricalRelic[], figureId: number): HistoricalRelic | undefined =>
  relics.find(relic => relic.holder.kind === "figure" && relic.holder.id === figureId);

export const stateRelicBonuses = (relics: readonly HistoricalRelic[], stateId: number): RelicBonus =>
  sumRelicBonuses(relics.filter(relic => relic.holder.kind === "state" && relic.holder.id === stateId));

/** Weapons add their M bonus to survival saves */
export const relicSurvivalBonus = (relic: HistoricalRelic | undefined): number => relic?.bonuses.m ?? 0;

/** Tomes grant +50% hero experience */
export const relicXpMultiplier = (relic: HistoricalRelic | undefined): number => (relic?.category === "tome" ? 1.5 : 1);

/** Charters add +25% contract gold for the carrying hero */
export const relicGoldMultiplier = (relic: HistoricalRelic | undefined): number =>
  relic?.category === "charter" ? 1.25 : 1;

export function describeRelicBonuses(relic: HistoricalRelic): string {
  const parts: string[] = [];
  if (relic.bonuses.m) parts.push(`+${relic.bonuses.m} M`);
  if (relic.bonuses.w) parts.push(`+${relic.bonuses.w} W`);
  if (relic.bonuses.s) parts.push(`+${relic.bonuses.s} S`);
  if (relic.bonuses.c) parts.push(`+${relic.bonuses.c} C`);
  return parts.join(" · ") || "No passive bonus";
}

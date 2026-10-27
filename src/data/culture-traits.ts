// The social layer: what a culture believes and what its people are like. See
// docs/plans/culture-traits.md. Two mechanics are lifted from the Freebooters on the Frontier
// 2e settlement rules (a 1d12 matrix rolled *through* the parent's alignment, and a virtue/vice
// count by alignment); the word lists are FMG's own, so nothing here is transcribed.
//
// Every roll takes an explicit Rng instead of Math.random: the seed already drives an alea
// stream through Math.random, and a trait roll drawn from it would shift every name, date and
// border generated after it. Callers key their own stream with traitsRng().
import { createRng, type Rng } from "@/utils/rng";

/** the five-point ethos, in the canonical order the editors sort by */
export const ALIGNMENTS = ["good", "lawful", "neutral", "chaotic", "evil"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** one badge color per alignment, muted enough for the Legends list and the editor column alike */
export const ALIGNMENT_COLORS: Record<Alignment, string> = {
  good: "#2a9d4a",
  lawful: "#3d6db5",
  neutral: "#8a8a8a",
  chaotic: "#c77b21",
  evil: "#a33d3d"
};

/** roll 1d12, index = result - 1; the column is the parent's alignment, neutral = from scratch */
export const PREVAILING_ALIGNMENT: Record<Alignment, readonly Alignment[]> = {
  good: [
    "evil",
    "chaotic",
    "chaotic",
    "neutral",
    "neutral",
    "lawful",
    "lawful",
    "good",
    "good",
    "good",
    "good",
    "good"
  ],
  lawful: [
    "evil",
    "evil",
    "chaotic",
    "neutral",
    "neutral",
    "lawful",
    "lawful",
    "lawful",
    "lawful",
    "lawful",
    "good",
    "good"
  ],
  neutral: [
    "evil",
    "chaotic",
    "chaotic",
    "neutral",
    "neutral",
    "neutral",
    "neutral",
    "neutral",
    "neutral",
    "lawful",
    "lawful",
    "good"
  ],
  chaotic: [
    "evil",
    "evil",
    "chaotic",
    "chaotic",
    "chaotic",
    "chaotic",
    "chaotic",
    "chaotic",
    "neutral",
    "lawful",
    "good",
    "good"
  ],
  evil: ["evil", "evil", "evil", "evil", "evil", "chaotic", "chaotic", "neutral", "neutral", "lawful", "lawful", "good"]
};

/** a face that sends the roll to another column's top ten; never a second redirect */
export interface Redirect {
  redirect: Alignment;
}

/** per-alignment 1d12 column; faces 11 and 12 redirect to 1d10 on another column */
export const CULTURAL_VALUES: Record<Alignment, readonly (string | Redirect)[]> = {
  good: [
    "empathy",
    "generosity",
    "generosity",
    "valor",
    "valor",
    "trust",
    "trust",
    "cooperation",
    "cooperation",
    "love",
    { redirect: "lawful" },
    { redirect: "neutral" }
  ],
  lawful: [
    "truth",
    "justice",
    "justice",
    "discipline",
    "discipline",
    "loyalty",
    "loyalty",
    "order",
    "order",
    "honor",
    { redirect: "good" },
    { redirect: "neutral" }
  ],
  neutral: [
    "knowledge",
    "balance",
    "balance",
    "advancement",
    "advancement",
    "independence",
    "independence",
    "investment",
    "investment",
    "fate",
    { redirect: "lawful" },
    { redirect: "chaotic" }
  ],
  chaotic: [
    "satisfaction",
    "impulse",
    "impulse",
    "conflict",
    "conflict",
    "celebration",
    "celebration",
    "disruption",
    "disruption",
    "passion",
    { redirect: "evil" },
    { redirect: "neutral" }
  ],
  evil: [
    "ignorance",
    "control",
    "control",
    "subjugation",
    "subjugation",
    "greed",
    "greed",
    "power",
    "power",
    "hatred",
    { redirect: "chaotic" },
    { redirect: "neutral" }
  ]
};

/** 50 virtues, 1d100 → VIRTUES[Math.ceil(d / 2) - 1]. Lowercase adjectives: they are read as
 *  "lawful · just, loyal" beside a figure's name and paired 1:1 with a vice in CONTRADICTIONS */
export const VIRTUES: readonly string[] = [
  "honest",
  "generous",
  "merciful",
  "kind",
  "loyal",
  "forgiving",
  "humble",
  "brave",
  "chaste",
  "just",
  "patient",
  "diligent",
  "temperate",
  "courteous",
  "charitable",
  "faithful",
  "prudent",
  "fair",
  "gentle",
  "steadfast",
  "compassionate",
  "sincere",
  "disciplined",
  "protective",
  "hopeful",
  "cheerful",
  "thrifty",
  "thoughtful",
  "daring",
  "eloquent",
  "observant",
  "methodical",
  "adaptable",
  "selfless",
  "tolerant",
  "decisive",
  "meticulous",
  "serene",
  "witty",
  "dependable",
  "reverent",
  "playful",
  "curious",
  "wise",
  "honorable",
  "modest",
  "resourceful",
  "tactful",
  "ingenious",
  "zealous"
];

/** 50 vices, indexed the same way. Mirror the virtues: one antonym per pair in CONTRADICTIONS */
export const VICES: readonly string[] = [
  "deceitful",
  "stingy",
  "merciless",
  "cruel",
  "disloyal",
  "vengeful",
  "boastful",
  "cowardly",
  "lustful",
  "unjust",
  "impatient",
  "slothful",
  "gluttonous",
  "rude",
  "greedy",
  "faithless",
  "reckless",
  "biased",
  "harsh",
  "fickle",
  "callous",
  "insincere",
  "undisciplined",
  "negligent",
  "despairing",
  "sullen",
  "wasteful",
  "thoughtless",
  "timid",
  "taciturn",
  "oblivious",
  "haphazard",
  "rigid",
  "selfish",
  "bigoted",
  "indecisive",
  "careless",
  "wrathful",
  "dull",
  "unreliable",
  "irreverent",
  "humorless",
  "incurious",
  "foolish",
  "dishonorable",
  "vain",
  "petty",
  "domineering",
  "paranoid",
  "dissolute"
];

/** the traits the alignment dictates: three everywhere but the neutral middle, which carries one
 *  of each. good 3/0, lawful 2/1, neutral 1/1, chaotic 1/2, evil 0/3 */
export const TRAIT_COUNTS: Record<Alignment, { virtues: number; vices: number }> = {
  good: { virtues: 3, vices: 0 },
  lawful: { virtues: 2, vices: 1 },
  neutral: { virtues: 1, vices: 1 },
  chaotic: { virtues: 1, vices: 2 },
  evil: { virtues: 0, vices: 3 }
};

/** the direct antonyms among the two lists, `[virtue, vice]`. Only true opposites: a figure
 *  never draws both halves of a pair, and nothing here judges near-misses */
export const CONTRADICTIONS: readonly (readonly [string, string])[] = [
  ["honest", "deceitful"],
  ["generous", "stingy"],
  ["merciful", "merciless"],
  ["kind", "cruel"],
  ["loyal", "disloyal"],
  ["forgiving", "vengeful"],
  ["humble", "boastful"],
  ["brave", "cowardly"],
  ["chaste", "lustful"],
  ["just", "unjust"],
  ["patient", "impatient"],
  ["diligent", "slothful"],
  ["temperate", "gluttonous"],
  ["courteous", "rude"],
  ["charitable", "greedy"],
  ["faithful", "faithless"],
  ["prudent", "reckless"],
  ["fair", "biased"],
  ["gentle", "harsh"],
  ["steadfast", "fickle"],
  ["compassionate", "callous"],
  ["sincere", "insincere"],
  ["disciplined", "undisciplined"],
  ["protective", "negligent"],
  ["hopeful", "despairing"],
  ["cheerful", "sullen"],
  ["thrifty", "wasteful"],
  ["thoughtful", "thoughtless"],
  ["daring", "timid"],
  ["observant", "oblivious"],
  ["methodical", "haphazard"],
  ["adaptable", "rigid"],
  ["selfless", "selfish"],
  ["tolerant", "bigoted"],
  ["decisive", "indecisive"],
  ["meticulous", "careless"],
  ["serene", "wrathful"],
  ["witty", "dull"],
  ["dependable", "unreliable"],
  ["reverent", "irreverent"],
  ["curious", "incurious"],
  ["wise", "foolish"],
  ["honorable", "dishonorable"],
  ["modest", "vain"]
];

/** both ways: a drawn word rejects the antonym of itself, whichever side of the pair it sits on */
const ANTONYMS = new Map<string, string>(
  CONTRADICTIONS.flatMap(([virtue, vice]) => [[virtue, vice] as const, [vice, virtue] as const])
);

/** the dice per word drawn before the pick falls back to a scan; keeps a short pool from hanging */
const WORD_DRAWS = 5;

/** one reproducible stream per entity, so traits never depend on the roll order around them */
export function traitsRng(seed: string, kind: "culture" | "figure", id: number): Rng {
  return createRng(`${seed}:traits:${kind}:${id}`);
}

/** the canonical sort rank of an alignment; an untyped culture sorts after every real one */
export function alignmentRank(alignment: Alignment | undefined): number {
  return alignment ? ALIGNMENTS.indexOf(alignment) : ALIGNMENTS.length;
}

/** how a culture's values read on one line: "truth · justice", or "truth above all" when dominant */
export function valuesText(values: readonly string[] | undefined): string {
  if (!values?.length) return "";
  return values.length === 1 ? `${values[0]} above all` : values.join(" · ");
}

/** 1d12 down the parent's column; no parent (a culture from scratch) rolls the neutral column */
export function rollAlignment(rng: Rng, prevailing: Alignment = "neutral"): Alignment {
  return PREVAILING_ALIGNMENT[prevailing][rng.d(12) - 1];
}

/** one 1d12 face of a column, following a redirect to 1d10 on another column's top ten */
function rollValue(rng: Rng, alignment: Alignment): string {
  const face = CULTURAL_VALUES[alignment][rng.d(12) - 1];
  // only faces 11 and 12 redirect, and they point at faces 1–10, so a redirect never recurses
  return typeof face === "string" ? face : (CULTURAL_VALUES[face.redirect][rng.d(10) - 1] as string);
}

/** two rolls; a duplicate means the value is held above all others, so it is returned alone */
export function rollValues(rng: Rng, alignment: Alignment): string[] {
  const first = rollValue(rng, alignment);
  const second = rollValue(rng, alignment);
  return first === second ? [first] : [first, second];
}

/** the first word the rules allow, when the dice keep landing on taken ones */
function scanFree(pool: readonly string[], taken: Set<string>, isFree: (word: string) => boolean): string | undefined {
  for (const word of pool) if (!taken.has(word) && isFree(word)) return word;
  return undefined;
}

function drawWords(
  rng: Rng,
  pool: readonly string[],
  count: number,
  taken: Set<string>,
  isFree: (word: string) => boolean
): string[] {
  const picked: string[] = [];
  const acceptable = (word: string) => !taken.has(word) && isFree(word);

  for (let i = 0; i < count; i++) {
    let word: string | undefined;
    for (let draw = 0; draw < WORD_DRAWS && !word; draw++) {
      const candidate = pool[rng.int(0, pool.length - 1)];
      if (acceptable(candidate)) word = candidate;
    }
    word ??= scanFree(pool, taken, isFree);
    if (!word) break; // the lists cannot fill this figure; never loop, never repeat
    taken.add(word);
    picked.push(word);
  }

  return picked;
}

/** virtues and vices in the counts the alignment dictates, never the same word twice and never
 *  both halves of a CONTRADICTIONS pair */
export function rollFigureTraits(rng: Rng, alignment: Alignment): { virtues: string[]; vices: string[] } {
  const counts = TRAIT_COUNTS[alignment];
  const taken = new Set<string>();
  const isFree = (word: string) => !taken.has(ANTONYMS.get(word) ?? "");

  return {
    virtues: drawWords(rng, VIRTUES, counts.virtues, taken, isFree),
    vices: drawWords(rng, VICES, counts.vices, taken, isFree)
  };
}

# Plan — Culture Alignment, Values & Figure Virtues/Vices

Updated: 2026-10-27. Source rules: *Freebooters on the Frontier 2e, Vol. II — Settlements &
Citizens* (`VerseEras/.rules/FotF2e - 02 Settlements & Citizens.md`; alignment table ~lines
290–306, cultural values ~308–327, virtue/vice table ~2167–2196). This document is the
implementation contract; each slice in [Build Order](#build-order) is shippable on its own.
Slice 1 shipped 2026-10-27: `src/data/culture-traits.ts`, the `Culture` fields, the generator
wiring and the `generation.cultures.traits` switch. Slice 2 shipped the same day: figure traits
in the two figure constructors and the Legends rows. The three open questions were answered on
2026-10-27 (see [Decisions](#decisions)), and every codebase claim below was re-checked against
the tree in the same pass — the corrections are folded in, not appended.

## Problem Statement

FMG cultures are purely material: a namebase, a shield, an expansion type. Nothing says what a
culture *believes* or how its people *behave*:

- `culture` carries no moral or ethical identity, so every culture reads the same in play.
- The chronicle's figures (`pack.history.figures` — rulers, generals) are names with dates;
  they have no character: no ethos, no flaws, nothing to hang a legend on.
- Worldbuilders running RPG campaigns (the FotF use case) must invent alignment, values and
  NPC traits by hand outside the tool.

The goal is the FotF2e social layer, adapted to what FMG already generates: **cultures** get an
*alignment* and core *values*; **individuals** (history figures) get an alignment-derived mix
of *virtues* and *vices*. All deterministic from the map seed, all serialized, all browsable.

## Solution

A small, pure **traits layer** over the existing generators — no new pipeline step:

1. **Data tables** in a new `src/data/culture-traits.ts`: the five alignments, the prevailing
   alignment matrix (1d12 per parent alignment), the per-alignment cultural values columns
   (1d12, with 11/12 redirecting to 1d10 on another column), the 50-virtue / 50-vice word
   lists (1d100, authored for FMG — see [Word lists](#word-lists)), and the virtue/vice counts
   per alignment.
2. **Culture traits** assigned inside `Cultures.generate()`: alignment rolled once on the
   NEUTRAL column (cultures start from scratch), then two value rolls cross-referenced by that
   alignment; a duplicate roll collapses to a single *dominant* value that "permeates society".
3. **Figure traits** assigned inside the history generator where dynasties and generals are
   already emitted: the patron state inherits its culture's alignment (authority, per FotF),
   each figure rolls alignment on the prevailing column of that alignment, then draws
   `virtues`/`vices` in the counts the alignment dictates (good 3/0 … evil 0/3), re-rolling
   direct contradictions (honest + liar).
4. **Display**: two new columns in the Cultures editor; alignment + traits on figure rows and
   pages in the Legends browser.

### Rejected alternatives

| Approach | Why not |
|---|---|
| Alignments on states (not cultures) | FotF models culture as the top social unit; states inherit authority alignment from their dominant culture. Deriving at need keeps `State` untouched |
| Full NPC generator (burger rosters with traits) | FMG has no NPC layer to hang it on; history figures are the only individuals and they already exist |
| New pipeline step `cultureTraits` | Traits must exist before history runs and belong to the culture's own identity; assigning in `Cultures.generate()` avoids ordering hazards on Erase/regenerate paths |
| Random unreferenced word lists | The FotF tables are battle-tested and cross-referenced by alignment; rolling *through* the matrix (not flat) is what makes sub-entity alignment skew toward the parent, which is the whole point |

## User Stories

1. As a worldbuilder, I want every culture to carry an alignment, so a glance tells me whether
   its authorities are just, cruel, wild or indifferent.
2. As a worldbuilder, I want each culture to hold 1–2 core values (sometimes one dominant
   value), so burg notes, diplomacy and legends can reference what a people prizes.
3. As a worldbuilder, I want historical figures to have virtues and vices in numbers their
   alignment implies, so rulers and generals read like characters, not date ranges.
4. As a worldbuilder, I want sub-entities to skew toward their parent culture's alignment
   (prevailing alignment), so an evil culture's rare good rebel is *meaningfully rare*.
5. As a worldbuilder, I want to see and sort alignment/values in the Cultures editor, and
   re-roll traits for cultures I haven't locked.
6. As a worldbuilder, I want locked cultures to keep their traits through regeneration, so my
   canon survives re-rolls.
7. As a worldbuilder, I want to turn the whole layer off, so maps for non-RPG purposes stay
   lean.

## Data Model

Additive, optional fields only — no existing interface changes, no new pack key.

```ts
// src/data/culture-traits.ts
export const ALIGNMENTS = ["good", "lawful", "neutral", "chaotic", "evil"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** the badge color per alignment, shared by the Legends rows and the editor column */
export const ALIGNMENT_COLORS: Record<Alignment, string>;

/** roll 1d12, index = result - 1; column = parent's alignment; NEUTRAL column = from scratch */
export const PREVAILING_ALIGNMENT: Record<Alignment, Alignment[]>;

/** per-alignment 1d12 column; entries are values, or {redirect: Alignment} for faces 11/12
 *  (redirect rolls 1d10 over the target column's top-10 entries) */
export const CULTURAL_VALUES: Record<Alignment, (string | { redirect: Alignment })[]>;

export const VIRTUES: string[]; // 50 entries; 1d100 → VIRTUES[Math.ceil(d/2) - 1]
export const VICES: string[];   // 50 entries; same indexing

export const TRAIT_COUNTS: Record<Alignment, { virtues: number; vices: number }>;
// good 3/0, lawful 2/1, neutral 1/1, chaotic 1/2, evil 0/3
// three traits everywhere but the neutral middle, which carries one of each (the rule table's own
// footer, not a rounding of ours)

/** the direct antonyms the two lists share: a figure never draws both halves of one */
export const CONTRADICTIONS: readonly (readonly [string, string])[];
// 44 [virtue, vice] pairs, honest↔deceitful … modest↔vain. Direct antonyms only (decided): every
// word is in the list it belongs to, is used by one pair, and nothing here judges near-misses

// one reproducible stream per entity, so a culture's traits add nothing to the main Math.random
// stream and do not depend on how many cultures rolled before it
export function traitsRng(seed: string, kind: "culture" | "figure", id: number): Rng; // "<seed>:traits:<kind>:<id>"

// roll helpers: pure, but take that explicit Rng (see Randomness)
export function rollAlignment(rng: Rng, prevailing?: Alignment): Alignment; // undefined → NEUTRAL column
export function rollValues(rng: Rng, alignment: Alignment): string[];       // length 2, or 1 if dominant
export function rollFigureTraits(rng: Rng, alignment: Alignment): { virtues: string[]; vices: string[] };
// draws TRAIT_COUNTS[alignment] of each, never the same word twice on one figure and never a
// CONTRADICTIONS pair; every draw retries a bounded number of times (5) and then takes the next
// free word, so a short word list can never hang the generator
```

```ts
// src/generators/cultures-generator.ts — Culture gains:
alignment?: Alignment;
values?: string[]; // 1 entry = dominant value ("held above all others"), 2 = paired values

// src/types/history.ts — HistoricalFigure gains:
alignment?: Alignment;
virtues?: string[];
vices?: string[];
```

**States are not extended.** A state is the authority of its dominant culture
(`pack.cultures[state.culture]`), so its alignment is derived on read — `state.culture`'s
alignment field, `undefined` when the culture is gone or untyped. The data module stays a pure
table set (no `pack` access), so display code reads the field directly rather than through a
helper. That matches FotF: authority shares the culture's alignment; only *individuals* re-roll
on the prevailing column.

### The source tables (distilled)

**Prevailing alignment** (1d12; column = parent alignment; roll a culture from scratch on
NEUTRAL → neutral 50 %, lawful 2/12, chaotic 2/12, good 1/12, evil 1/12):

| 1d12 | GOOD | LAWFUL | NEUTRAL | CHAOTIC | EVIL |
|---|---|---|---|---|---|
| 1 | evil | evil | evil | evil | evil |
| 2 | chaotic | evil | chaotic | evil | evil |
| 3 | chaotic | chaotic | chaotic | chaotic | evil |
| 4–5 | neutral | neutral | neutral | chaotic | evil |
| 6–7 | lawful | lawful | neutral | chaotic | chaotic |
| 8–9 | good | lawful | neutral | chaotic / neutral¹ | neutral |
| 10 | good | lawful | lawful | lawful | lawful |
| 11 | good | good | lawful | good | lawful |
| 12 | good | good | good | good | good |

¹ chaotic column: face 8 chaotic, face 9 neutral.

**Cultural values** (1d12 twice by culture alignment; duplicate → dominant):

| 1d12 | GOOD | LAWFUL | NEUTRAL | CHAOTIC | EVIL |
|---|---|---|---|---|---|
| 1 | empathy | truth | knowledge | satisfaction | ignorance |
| 2–3 | generosity | justice | balance | impulse | control |
| 4–5 | valor | discipline | advancement | conflict | subjugation |
| 6–7 | trust | loyalty | independence | celebration | greed |
| 8–9 | cooperation | order | investment | disruption | power |
| 10 | love | honor | fate | passion | hatred |
| 11 | →1d10 LAWFUL | →1d10 GOOD | →1d10 LAWFUL | →1d10 EVIL | →1d10 CHAOTIC |
| 12 | →1d10 NEUTRAL | →1d10 NEUTRAL | →1d10 CHAOTIC | →1d10 NEUTRAL | →1d10 NEUTRAL |

**Trait counts** (from the alignment table footer): virtues good 3, lawful 2, neutral 1,
chaotic 1, evil 0; vices good 0, lawful 1, neutral 1, chaotic 2, evil 3.

### Word lists

No verbatim word list appears in this plan, and none can be lifted into it: the rules file it
cites (`VerseEras/.rules/…`) is not in this checkout. The licence worry is spent as well — a
1d100 lookup of single adjectives is a mechanic, not copied expression. So `VIRTUES` / `VICES`
are **authored for FMG** in slice 1: 50 each, lowercase, single words, distinct within the
list, and phrased as plain character adjectives so `CONTRADICTIONS` can pair them
(honest↔deceitful, generous↔stingy, …). Because they were written as mirror halves, every
virtue has its opposite in the vice list and the contradiction table is complete rather than a
sample. Tests pin length 50, uniqueness and the pairing; there is nothing to pin against a
source document.

## Generator Design

No new pipeline step — traits ride the existing generators.

### Randomness (read this first)

Traits must not disturb the map a seed already produces. `components/seed.ts` installs
`aleaPRNG(options.map.seed)` as `Math.random`, so every extra draw shifts every later name,
birth date and border; `features-generator.ts:109` already reseeds a local stream for exactly
that reason. The traits layer does the same, one level up:

- rolls go through `createRng` from `src/utils/rng.ts` — the Astral dice stream (`d(12)`,
  `d(100)`, `choice`), moved out of `generators/astral-system/rng.ts` so a data module need not
  reach into a feature folder; that file now re-exports it, so no Astral import changes;
- the stream is keyed per entity by `traitsRng(seed, kind, id)` → `"<seed>:traits:<kind>:<id>"`,
  so a culture's traits are stable across Erase/regenerate, do not depend on how many cultures
  were rolled before it, and consume nothing from the main stream;
- consequence: geometry, names, events, dates and figure lifespans for a given seed are
  unchanged by this feature — seed history stays honest and no existing test moves.

Never call `rand`/`P`/`rw` from this layer; the tables are 1d12/1d100 lookups, not
probabilities.

### Cultures (`src/generators/cultures-generator.ts`)

In `generate()`, inside the per-culture loop, after `type`/`expansionism` are set for
**non-locked** cultures (Wildlands `i: 0` gets none):

```ts
const rng = traitsRng(options.map.seed, "culture", newId);
c.alignment = rollAlignment(rng);          // NEUTRAL column: a culture is rolled from scratch
c.values = rollValues(rng, c.alignment);   // duplicate roll collapses to a single dominant value
```

- **Locked cultures** keep whatever traits they carry (the lock flow already skips the
  mutation block); a locked culture without traits simply stays untyped — the editor shows "—".
- **`Cultures.add(x, y)`** (editor-founded culture): roll on the prevailing column of the
  culture at its center — `rollAlignment(rng, pack.cultures[pack.cells.culture[center]]?.alignment)`,
  with the new culture's own `rng` (`:traits:culture:<i>` once `i` is known) — then values from
  the new alignment. A divergent culture skews toward its parent, exactly as the FotF
  border-town example does. The parent may be Wildlands (`culture` 0), removed or unknown on an
  old map: that reads as `undefined` and falls back to the NEUTRAL column, so the existing
  `origins: [pack.cells.culture[center]]` line needs no extra guard.
- **Toggle**: when `options.generation.cultures.traits` is `false`, skip assignment (and
  `add()` leaves traits absent). The same flag gates figure traits in the history generator —
  one switch turns the whole social layer off, never half of it. Old-map backfill needs no
  migration: fields are optional.

### History figures (`src/generators/history-generator.ts`)

Figures are built in exactly two places — `ruleSegments` (rulers, shared by `emitDynasty` and
`emitEpochFigures`) and `attachGeneral` (generals, shared by `emitFigures` and
`emitEpochFigures`) — so this layer needs two call sites, not five. Both know the figure's
culture at construction time:

```ts
// module-level `figureTraits(index, cultureId)`, spread into both figure literals
const rng = traitsRng(options.map.seed, "figure", index);
const alignment = rollAlignment(rng, pack.cultures[cultureId]?.alignment); // undefined → neutral column
const { virtues, vices } = rollFigureTraits(rng, alignment);
```

- `subject.culture` / `leader.culture` is already on both constructors, and a `0`
  (Wildlands), removed or untyped culture gives `undefined`, which rolls the NEUTRAL column —
  the same fallback as `Cultures.add()`.
- Figures on maps generated before this change (no culture alignment) roll the patron
  alignment on the NEUTRAL column at need — no history regeneration required, but traits are
  written so they persist.
- When `options.generation.cultures.traits` is `false`, `figureTraits` returns `{}` and the
  figure carries no fields at all, so a non-RPG map stays lean end to end.
- `prophet` and `rebel` are declared in `HistoricalRole` but nothing emits them today, so the
  snippet lives inside the two constructors and any future role inherits it by construction. A
  rebel *against* an evil empire drawing "good" from the prevailing column is the system
  working as designed.
- Regenerating history (`Chronicle.generate()` again — it replaces `pack.history` wholesale;
  there is no `History.regenerate()`) re-rolls traits with the figures, exactly as it already
  re-rolls names and dates. Event text never embeds traits, so nothing needs rewriting.

## Display

### Cultures editor (`src/controllers/cultures-editor.ts`)

Two columns beside `base` — both row templates (the neutral `i: 0` line and the normal line)
need the cells, or the columns render blank on that one row:

- **Alignment** (`width: "6em"`, `mobileHidden`): a small colored badge — the colors are
  `ALIGNMENT_COLORS` in the data module (good `#2a9d4a`, lawful `#3d6db5`, neutral `#8a8a8a`,
  chaotic `#c77b21`, evil `#a33d3d`; the Legends rows already use them) — sorted by the
  canonical `ALIGNMENTS` order, not alphabetically. No new sort type is needed:
  `EditorColumn.sortBy` already returns `string | number` and only the header icon looks at
  `sortType`, so `sortBy: c => (c.alignment ? ALIGNMENTS.indexOf(c.alignment) : -1)` sorts
  numerically and `sorting.ts` stays untouched. Missing trait → "—".
- **Values** (`width: "9em"`, `mobileHidden`): `truth · justice`, sorted alpha by that string;
  a dominant single value reads `truth above all` (bold).
- Toolbar: a **Re-roll traits** button (`icon-shuffle`; `icon-cw` is taken by Refresh) rolling
  alignment+values for all unlocked, living cultures — the same blast-radius convention as
  the editor's existing refresh, going through `Cultures.living()` so removed entries are
  skipped. It does **not** touch figure traits: figures are individuals who already rolled
  theirs, and regenerating history stays the only way to re-roll those (stated in the tooltip).

### Legends browser (`src/controllers/history-overview.ts`)

- **Figures tab rows** (`renderFigure`): alignment badge + virtues (plain) and vices
  (`.legendsVice`, muted red) after the figure's roles — `Ausa the Bold — lawful · just, loyal ·
  cruel`. A figure with no traits (old chronicle, or the layer off) renders exactly as before.
- There are **no figure or culture pages** to hang a definition line on: `openActor`'s
  `figure`/`realm` cases only switch tabs and `culture`/`religion` only zoom to the center. So
  the culture summary goes where a culture already heads a block — the Figures tab's group
  header (`renderFigures` groups by `roles[0].target`) gains "a *lawful* people prizing *truth*
  and *justice*" when that target is a culture. The timeline and the Realms tab stay untouched.
- A culture with no alignment (old map, or the toggle was off) renders "—" and no summary line.

No map rendering changes: traits are data, not geometry — the layering rules are respected by
construction (data file + generator fields + editor/overview text only).

## Configuration

`options.generation.cultures.traits: boolean`, default `true`:

- zod: add `traits: z.boolean()` to the `generation.cultures` strictObject
  (`src/components/options-schema.ts`), default `true` in `options-model.ts`
- **the options tab has no boolean control** — no checkbox anywhere in its template, and the
  `option()` helper is generic over `string | number` while `syncOption` writes `input.value`.
  A checkbox would need plumbing for no gain. Use the raw `OPTION_BINDINGS` form instead
  (`read: o => (o.generation.cultures.traits ? "on" : "off")`, `update` parses and calls
  `Options.set`), rendered as `<select id="cultureTraits" data-option="cultureTraits">` with
  *on*/*off* — the same shape as `emblemShape`/`onloadBehavior`, no new control type;
- no pin needed (nothing to template-randomize) and no Culture Editor section — the toggle
  lives in the Configuration panel only, like other generation booleans, and applies to the
  next generation rather than retroactively

## Serialization & IO

Zero format work:

- `culture.alignment` / `culture.values` ride the existing `pack.cultures` record (13) —
  `save.ts` stringifies cultures wholesale; `load.ts` restores them as-is beyond
  `normalizeCultureBases`, which only touches `base`.
- figure traits ride the existing history record (53): `serializeHistory`/`parseHistory`
  (`services/io/epochs-format.ts`) pass the chronicle through untouched and only rebuild
  `snapshots`, so figures keep their fields.
- Old maps: fields absent → editors show "—", figures roll-once-and-persist on first
  regeneration of history only; `auto-update.ts` needs no version bump (additive optional).
- `export-json.ts` includes cultures already — nothing to do.
- Round-trip invariant unchanged: locked cultures and existing history must survive
  byte-for-byte; the round-trip test below guards it.

## Testing

Vitest, no Playwright:

- **Data integrity** (`src/data/culture-traits.test.ts`): every `PREVAILING_ALIGNMENT` column
  has exactly 12 entries drawn from `ALIGNMENTS`, and the NEUTRAL column weighs 6 neutral /
  2 lawful / 2 chaotic / 1 good / 1 evil; every `CULTURAL_VALUES` column weighs 12 faces, its
  redirects target existing columns, and a redirect lands on a top-10 face so redirects can
  never recurse; `VIRTUES`/`VICES` are 50 each — lowercase, non-empty, unique within their
  list (see [Word lists](#word-lists)); `TRAIT_COUNTS` matches the rule table's footer — three
  traits everywhere but neutral's one-and-one.
- **Rolls** (`rollAlignment`/`rollValues`/`rollFigureTraits`, driven by a keyed
  `traitsRng(seed, kind, id)` so a seed pins the result and `Math.random` is never read — a test
  makes `Math.random` throw while rolling): distribution
  smoke over the NEUTRAL column (≈50 % neutral over 1000 rolls); duplicate-value collapse;
  redirect faces resolve to real values; trait counts match alignment; across 500 seeded
  figures no word repeats and no `CONTRADICTIONS` pair co-occurs; two maps generated on one
  seed keep the same culture names and figure lifespans (the main stream is untouched).
- **Cultures generator** (`cultures-generator.test.ts`): non-locked cultures gain traits when
  the toggle is on; locked cultures keep theirs; toggle off → no fields; `add()` uses the
  parent's prevailing column.
- **History generator**: figures carry alignment + three traits (two when neutral); alignment
  drawn from the patron culture's column; figures on trait-less (old-map / Wildlands) cultures
  still emit; with `generation.cultures.traits` off, no figure carries traits.
- **IO**: `.map` round-trip preserves culture and figure traits exactly; a pre-traits save
  loads with "—" traits and no errors. The figure half lives in `epochs-format.test.ts`, since
  record 53 is the chronicle's only serializer.
- **Editors**: alignment column sorts canonically; schema test covers the new option
  (mirror the `freeBurgs` test).

Runtime budget: O(cultures + figures) table lookups — unmeasurable.

## Glossary & Docs

- `docs/domain/glossary.md`: **Alignment** (five-point ethos: good/lawful/neutral/chaotic/evil),
  **Prevailing Alignment** (the column sub-entities roll on), **Cultural Value** (with
  *dominant* defined), **Virtue/Vice** (figure traits).
- `docs/architecture/configuration.md`: the `generation.cultures.traits` toggle.
- Wiki page deferred until the display slice ships.

## Build Order

| Slice | Contents | Acceptance |
|---|---|---|
| 1 ✅ | `src/data/culture-traits.ts` (tables, authored word lists, helpers, contradiction list); `Culture.alignment/values` assignment in `Cultures.generate()` + `add()`; option + schema/model/tab wiring; data + generator tests | New maps: every living culture has alignment + 1–2 values; old maps unaffected; toggle honored |
| 2 ✅ | Figure traits in `ruleSegments`/`attachGeneral` (covers dynastic and epoch emission); Legends figures-tab rows show them | Every figure has alignment + its alignment's traits; no contradictions or repeats; persists through save/load; seed-stable |
| 3 | Cultures editor columns + Re-roll traits button; Legends culture group-header summary line | Sortable, mobile-hidden columns; re-roll respects locks and leaves figures alone |
| 4 (future) | See below | — |

## Future Phases (out of scope for now)

- **Religion deities**: FotF rolls deity alignment on the culture's prevailing column and
  domains by alignment — the `PRIMARY/SECONDARY DOMAIN` tables slot into `religions-generator`
  the same way.
- **Diplomacy affinity**: bias `generateDiplomacy` initial relations by alignment distance
  (good/evil → rivalry, lawful/lawful → friendship); requires caching state alignment.
- **NPC motivations**: the alignment-keyed 1d12 motivation table is a free add-on to figures
  once traits exist (event-text flavor).
- **Culture-set tone bias**: grimdark/darkFantasy sets rolling alignment on a biased column
  mix instead of pure NEUTRAL.
- **Culture notes**: auto-write a one-line "prizes X above all" note for new cultures.

## Decisions

Resolved 2026-10-27. The three questions this plan opened are closed; they are recorded here
rather than deleted, so the reasoning is not re-litigated later.

1. **Word lists — no licence problem, and no text to license.** The plan never carried the
   source's 50+50 virtue/vice table, and a mechanically rolled lookup of single adjectives is
   a rule, not copyrightable expression. So `VIRTUES` / `VICES` are authored for FMG (see
   [Word lists](#word-lists)); the two tables that *are* reproduced above are a 12×5 dice
   matrix and an 8-value-per-column list — structure and mechanic. **Keep as-is, no reworded
   lists, no upstream PR warning needed.**
2. **Contradictions — direct antonyms only, and all of them.** `CONTRADICTIONS` lists every
   true opposite the two authored lists share (44 pairs); there is no semantic map, no
   similarity scoring and no judgment call on near-opposites. Capping it at ~15 pairs would
   have left `tolerant` free to sit beside `bigoted` on one figure, which is the very thing the
   rule prevents.
3. **Astral sets — ship the five alignments everywhere.** Good and evil fit synthetic Machine
   cultures as well as they fit kingdoms; alignment is a lens, not a genre. Per-set vocabulary
   stays the already-listed future phase (culture-set tone bias), not a blocker.

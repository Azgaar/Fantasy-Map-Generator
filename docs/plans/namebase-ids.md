# Plan — Name Bases by Stable Five-Letter ID

Updated: 2026-10-24. Status: **implemented** on this branch (unreleased, `VERSION` 1.155.0). Blocking dependency for
[rpg-fantasy-cultures.md](rpg-fantasy-cultures.md). This is a format change to the `.map` file, so it
bumps `VERSION` and ships its own update note.

## Why

A name base is currently identified by its **array position**. `Culture.base` is that position
(`src/generators/cultures-generator.ts:32`), the Markov chains are indexed by it
(`src/generators/names-generator.ts:65`), and the save file stores bases positionally in slot 31.

That identity is fragile in exactly the situation the fork is about to enter:

- **Adding shipped content re-points saved maps.** Appending is safe, inserting is not: one new base
  before an existing one silently shifts every later base, so every saved map's cultures begin
  naming from the wrong corpus. RPG Fantasy adds eleven bases; every future set adds more.
- **Hardcoded numbers are everywhere.** State naming says `base === 18` for Arabic and
  `base > 32 && base < 42` for the fantasy bases (`names-generator.ts:215-271`), and the form rules
  compare `base === 31` for Mongolian (`states-generator.ts:859-869`). These are only correct while
  the array never changes.
- **Reordering is not expressible.** Restore-defaults, partial imports and user-created bases all
  rely on "position i means base i". A custom base cannot be moved, and an imported base set can
  only be appended.

Five-letter ids make identity explicit: shipped bases get permanent ids, `culture.base` stores an
id, and position becomes a presentation concern.

## Decisions

- **Format**: exactly five uppercase A–Z letters, `^[A-Z]{5}$` (11.8M combinations).
- **Hand-assigned mnemonics** for the 55 shipped bases, forever stable. They are readable in a
  console and in the save file, which a UUID or a running number would not be.
- **Never derived from the display name.** Renaming a base must not change its id, and an id must
  not silently move to another base because two names collide.
- **User bases get generated ids** from the name, deterministically, so the same imported file
  yields the same ids on every machine; collisions are resolved by mutating the derived code, never
  by overwriting an existing base.
- **One stored reference**: `culture.base` is the id. Nothing else in the map file references a
  base by number.
- **`i` survives as a derived position** because the omnibar's entity references are numeric
  (`map-entities.ts:680`). It is recomputed by `Names.reindex()` after every mutation and is
  documented as presentational. No logic may read it as identity.

## The id table

Stock and Astral bases (0–54) keep their current order; ids are the only new thing.

| i | id | Base | i | id | Base |
| --- | --- | --- | --- | --- | --- |
| 0 | GERMA | German | 28 | SWAHI | Swahili |
| 1 | ENGLI | English | 29 | VIETN | Vietnamese |
| 2 | FRENC | French | 30 | CANTO | Cantonese |
| 3 | ITALI | Italian | 31 | MONGO | Mongolian |
| 4 | CASTI | Castillian | 32 | HUMAN | Human Generic |
| 5 | RUTHE | Ruthenian | 33 | ELVEN | Elven |
| 6 | NORDI | Nordic | 34 | DARKE | Dark Elven |
| 7 | GREEK | Greek | 35 | DWARV | Dwarven |
| 8 | ROMAN | Roman | 36 | GOBLI | Goblin |
| 9 | FINNI | Finnic | 37 | ORCIS | Orc |
| 10 | KOREA | Korean | 38 | GIANT | Giant |
| 11 | CHINE | Chinese | 39 | DRACO | Draconic |
| 12 | JAPAN | Japanese | 40 | ARACH | Arachnid |
| 13 | PORTU | Portuguese | 41 | SERPE | Serpents |
| 14 | NAHUA | Nahuatl | 42 | LEVAN | Levantine |
| 15 | HUNGA | Hungarian | 43 | TRKCO | Trek Core |
| 16 | TURKI | Turkish | 44 | TRKTE | Trek Terran |
| 17 | AMAZI | Amazigh | 45 | TRKCN | Trek Continental |
| 18 | ARABI | Arabic | 46 | TRKSY | Trek Synthetic |
| 19 | INUIT | Inuit | 47 | JAMDE | Jammer Deep |
| 20 | BASQU | Basque | 48 | JAMET | Jammer Ethereal |
| 21 | NIGER | Nigerian | 49 | JAMST | Jammer Stoneborn |
| 22 | CELTI | Celtic | 50 | JAMWI | Jammer Wild |
| 23 | MESOP | Mesopotamian | 51 | GRMCO | Grimdark Core |
| 24 | IRANI | Iranian | 52 | GRMGO | Grimdark Gothic |
| 25 | HAWAI | Hawaiian | 53 | GRMIR | Grimdark Iron |
| 26 | KARNA | Karnataka | 54 | GRMCH | Grimdark Machine |
| 27 | QUECH | Quechua | | | |

Reserved for RPG Fantasy in Phase 2 ([rpg-fantasy-cultures.md](rpg-fantasy-cultures.md)):

| i | id | Base |
| --- | --- | --- |
| 55 | HALFL | Halfling |
| 56 | FEYFO | Fey |
| 57 | INFER | Infernal |
| 58 | CELES | Celestial |
| 59 | GRAVE | Grave |
| 60 | MERFO | Merfolk |
| 61 | BEAST | Beastfolk |
| 62 | ELEME | Elemental |
| 63 | CONST | Construct |
| 64 | ELDRI | Eldritch |
| 65 | TRIBA | Tribal |

## Data model

`src/data/name-bases.ts`:

```ts
export interface NameBase {
  id: string; // stable identity, /^[A-Z]{5}$/, never derived from `name`
  name: string;
  i: number; // derived array position; UI references only
  min: number;
  max: number;
  d: string;
  m: number;
  b: string;
  groups?: Record<string, string[]>;
}

export function deriveBaseId(name: string, taken: Set<string>): string; // deterministic, collision-safe
```

`Culture.base` becomes `string` (`cultures-generator.ts:32`).

## API before and after

| Before | After |
| --- | --- |
| `Names.getBase(base: number, ...)` | `Names.getBase(id: string, ...)` |
| `Names.getBaseShort(base: number)` | `Names.getBaseShort(id: string)` |
| `Names.updateChain(index: number)` | `Names.updateChain(id: string)` |
| `chains: (MarkovChain \| null)[]` | `chains: Record<string, MarkovChain>` |
| `Names.getState(name, culture, base?: number)` | `base?: string` |
| `Cultures.setBase(cultureId, baseId: number)` | `baseId: string`, "by id" in the assistant doc |
| `Names.nameBases[base]` | `Names.getNameBase(id)` (new), `ra(Names.nameBases).id` for randomness |
| `Culture.base = 33` | `Culture.base = "ELVEN"` |

Two helpers keep the reading side honest:

```ts
getNameBase(id: string): NameBase | undefined; // one lookup, shared by editors and generators
reindex(): void; // refresh `i` after add / import / restore / remove
```

`getBase` keeps today's forgiving behaviour — an unknown id warns and falls back to the first base —
because a map can reference a base a user later deleted. Authors no longer need name lookups:
`CulturesGenerator.getDefault()` writes literals. Ids are plain strings, so a typo is not a type
error; the test that every id a set references exists is the guard against the old silent `-1`.

## Where identity leaks today

| File | Change |
| --- | --- |
| `src/data/name-bases.ts` | add `id` to the interface and all 55 entries; id helpers |
| `src/generators/names-generator.ts` | chains keyed by id; `getBase`/`getBaseShort`/`updateChain`; suffix rules keyed by id; `getMapName`/`getEra` pick ids; fantasy-id set replaces `base > 32 && base < 42` |
| `src/generators/cultures-generator.ts` | ~150 `base: n` literals → id literals, including every set branch; `getBase(name)` helper deleted; `setBase` by id; `c.base % length` fallback → unknown-id fallback |
| `src/generators/states-generator.ts` | form rules compare ids (ENGLI, MONGO, TURKI, RUTHE, JAPAN, ARABI, AMAZI, GREEK, IRANI) |
| `src/generators/astral-naming.ts` | `Names.nameBases[baseId]` → `getNameBase(id)` |
| `src/controllers/namesbase-editor.ts` | select values are ids; add/import/export/restore carry ids; `reindex()` |
| `src/controllers/cultures-editor.ts` | `getBaseOptions(id)`, `data-base`, `sortBy` resolves position, import maps namesbase name → id |
| `src/controllers/{burg,lakes,provinces,river,states}-editor.ts` | `rand(length - 1)` → `ra(Names.nameBases).id` |
| `src/components/map-entities.ts` | unchanged; `i` stays derived and numeric |
| `src/services/io/save.ts`, `load.ts`, `export-json.ts` | new slot format + migration (below) |
| `src/services/assistant/*` + `context.generated.ts` | `setBase` doc regenerates |
| `src/conquest/engine/compiler/*`, `azgaar.ts` | `namePools` keyed by `nb.id`, `AzgaarCulture.base: string`, `COMPILER_VERSION` 0.2.0 |

## File formats

### `.map`, slot 31

New row: `id|name|min|max|d|m|names`, `/`-separated. `names` stays empty when it equals the shipped
base **with the same id** — the elision now compares identity instead of position
(`save.ts:130`).

Parsing is self-describing, so no version gate is needed: seven fields is the new format, six is
legacy. The bump to 1.155.0 is for the release notes and for tools that read `VERSION`, not for the
parser.

```ts
// legacy row: name|min|max|d|m|names
// id = defaults[i]?.id ?? deriveBaseId(name, taken)
// names = "" -> defaults[i].b for that id
```

After the base list is parsed, every culture reference is normalised. This must run in the same
block as the bases, after both `data[13]` and `data[31]` are read (`load.ts:334`, `load.ts:376`):

```ts
for (const culture of pack.cultures) {
  if (typeof culture.base === "number") culture.base = bases[culture.base]?.id ?? bases[0]?.id;
  else if (!bases.some(b => b.id === culture.base)) culture.base = bases[0]?.id;
}
```

The numeric lookup uses the parsed list's order, so an old map with an overridden or shorter base
list resolves correctly.

### Namesbase `.txt`

Import and export gain the id column: `id|name|min|max|d|m|names` (`namesbase-editor.ts:340`,
`:363`). A six-column file still imports and gets ids by position/defaults, so existing community
files keep working. On import, ids are preserved when unique, so a downloaded base set re-imports
with its references intact; a colliding id is re-derived rather than merged.

### `.json` export

`nameBases` already ships whole objects (`export-json.ts:48`, `:79`); they now include `id`. No
import path reads it, so nothing else changes.

## Migration edge cases

| Case | Behaviour |
| --- | --- |
| Slot 31 absent | shipped defaults (already have ids) |
| Six-column row | id from the default at that position; else derived from the name |
| Empty `names` field | shipped content for the base **with that id** |
| Culture `base` is a number | mapped through the parsed position list |
| Culture `base` out of range, `-1`, missing | first base id, warn |
| Culture id not in the list | first base id, warn |
| Duplicate ids in a hand-edited save | first wins; later copy is re-derived, content kept, warn |
| Imported base with a shipped id | treated as that base (override by identity), not a duplicate |
| Base renamed | id unchanged; references intact |
| `restore defaults` | list replaced with shipped bases; a culture pointing at a removed id falls back |

## Tests

- `name-bases.test.ts`: every shipped base has an id matching `^[A-Z]{5}$`; ids are unique; `i`
  matches the position (reindex invariant).
- `deriveBaseId`: deterministic, collision-safe, stable for names with punctuation and spaces.
- Round trip: save → load preserves ids, order and content, including a customized corpus.
- Legacy load: a 1.154-style fixture (six-column rows + numeric culture bases) resolves to the same
  bases and the same corpus as before the change.
- **The regression this exists for**: reorder or insert a base, reload, and a culture still names
  from the same corpus.
- Editors: add/import/restore keeps `i` contiguous and preserves references (source-level tests in
  the style of the existing ones).
- `Cultures.getDefault()` for every set returns ids that exist.
- Conquest compile: `namePools` is keyed by the same strings as `culture.base`.
- Fixtures: every test that builds a culture with a numeric `base` moves to a `cultureFixture(baseId)`
  helper, so the mechanical pass is one edit rather than forty.

## Order of work

1. **Ids without identity** — interface, all 55 entries, `deriveBaseId` + tests. `culture.base` stays
   numeric, the save format is untouched, everything is green. The field is inert but present.
2. **Identity switch** — chains, `getBase` and friends, literal ids in every set branch, state form
   rules, editors, save/load/migration, all tests. This is the large diff and the only one that
   matters behaviourally; landing it alone keeps the review focused.
3. **Edges** — conquest compiler and types, assistant doc + regenerated context, `data-model.md`,
   `MERGING.md`, `VERSION` + `package.json` 1.155.0, `docs/updates/v1.155.0/` note.

A codemod for step 2 is worthwhile: `base: (\d+)` → `base: "<id>"` inside `cultures-generator.ts`,
driven by the table above, then reviewed by hand. Delete the script afterwards.

## Risks

- **Silent re-pointing on a bad migration.** Mitigated by the legacy fixture and the reorder test;
  both assert corpus identity, not just counts.
- **A missed numeric comparison** — a suffix or form rule that now compares an id to a number is
  always false, so nothing crashes; it silently loses flavour. Mitigate with a grep in review
  (`=== \d` near `base`) and a test for one suffix per family (Germanland, Japanese -u, Arabic Al-).
- **Third-party `.txt` namebases** — keep six-column import working; test it.
- **Compiled conquest worlds** are self-consistent either way; only a version bump and a recompile
  are needed. No artifact migration.
- **`i` drift** — every mutation path must call `reindex()`; the contiguous-position test catches
  stragglers.

## Docs

`docs/architecture/data-model.md:127` (`culture.base`) and `:557` (the `i` field) are the two
sentences that are now wrong. `MERGING.md` gains the new touch points, and the release note explains
that old maps load unchanged and that bases are now identified by id — the user-visible part being
that a base keeps its name corpus when new bases are added or a base is renamed.
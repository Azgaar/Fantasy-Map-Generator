# Plan — The System Readout: generated stars and planets

Updated: 2026-10-25. Inputs: [astral-system-dialog.md](astral-system-dialog.md) (the dialog this
extends), [docs/astral/README.md](../astral/README.md),
[data-model.md](../architecture/data-model.md), and the **astro half** of the feral-system
generator (`code/VerseEras/game/js/world/generators/feral-system/astro/*`).

## Goal

The System Editor already reads a burg as a star system — its class, its people, its installations.
It says nothing about the star itself or what orbits it. This plan adds a **readout** to the
dialog: when a system is opened, generate its astronomical detail from the same astro methods the
feral-system generator uses, and show:

- **the stars** — the primary's class, mass, luminosity and main-sequence status, any companions,
  the total system mass, the snow line and the planet count;
- **the planets** — a table of every planet in the system with its type, orbit, size, gravity,
  temperature, atmosphere, hydrography, habitability and moons.

The readout is generated **when the dialog opens**, never during map generation or drawing. It is a
pure function of the map seed, the burg id, the burg's name and its population class. It is not
stored: no new burg field, no new `.map` record, no new layer, no renderer change.

This plan supersedes the system-dialog plan's "no generator changes" note. Its "no new state" rule
still holds: the astro port is a read-only calculation, not a second world.

## Non-negotiables

- **No new state.** The generated system is never written to `pack` or `options`; it exists only in
  the dialog's render. The same map seed, burg id, name and population class always produce the same
  readout, on every open, after every save/load.
- **Lazy by construction.** Generation runs only inside the System Editor's
  `updateSystemValues()` (open and edits). The map generator, the systems layer, the tooltip, the
  Star Systems overview and the burg model never call it.
- **The chart's class wins.** The existing spectral class is derived from population
  (`starClass(peopleOf(burg))`). The generated primary is forced to that class
  (`generateSystem(seed, { primaryType })`), so the marker, the class readout and the star table
  can never disagree.
- **Astro only.** Port `stars`, `planets`, `moons`, their astrophysics tables and the orbital
  layout. Do **not** port the era, region, feral, faction, gate, settlement or naming layers.
- **No new dependencies.** The port uses the repo's existing `alea` PRNG through a small local
  `createRng` facade. No runtime import from the VerseEras repository.
- **Read-only.** The readout takes no user input and makes no writes. It is a presentation of a
  deterministic calculation, like the existing star preview.
- **Standard view untouched.** The readout lives inside `#astralSystemEditor`; the Burg Editor and
  every standard layer keep their current behaviour.

## What is ported, and what is not

The VerseEras code is JavaScript in another repository; it is translated into TypeScript under a
new `src/generators/astral-system/` folder, one file per source module (the astro modules plus the
RNG surface) so the port stays auditable. Logic is unchanged apart from the two adaptations called
out below: the forced luminosity class and the preserved planet subtype.

### Ported

| New file | Source | Contents |
|---|---|---|
| `rng.ts` | `state/rng.js` (the `createRng` surface only) | `next`, `range`, `int`, `d`, `choice`, `chance` over `alea` |
| `util.ts` | `astro/util.js` | `clamp`, `rollDice`, `pickWeighted` |
| `astrophysics.ts` | `astro/astrophysics.js` | `gravity`, `blackbody`, `HI`, `starTypeData`, `planetTypeData` |
| `palette.ts` | `astro/palette.js` | `GasGiantColors`, `RockyColors` |
| `layout.ts` | `astro/layout.js` | `layoutPosition` (golden-angle placement) |
| `stars.ts` | `astro/stars.js` | `generateStar` — spectral class, mass, companions, Titius–Bode orbits; adds `forcedLumClass` |
| `planet.ts` | `astro/planet.js` | `generatePlanet` — planets, moons, atmosphere, hydrography, HI |
| `system.ts` | `astro/system.js` | `generateSystem`, `generateSystemPlanets`, Kepler period, layout; preserves `planet.subtype` |

The RNG is the one deliberate divergence: VerseEras uses a mulberry32 `createRng`; the port keeps
the same surface over `alea`. A system is deterministic in FMG but not byte-identical to the
VerseEras output. The logic and distributions are unchanged. If cross-project parity ever matters,
port `state/rng.js` instead — it is a leaf module.

### Not ported

| Source | Why |
|---|---|
| `eras.js`, `feral.js` | the era and feral-present layers, explicitly out of scope |
| `gates.js`, `placement.js` | district placement and gate networks |
| `tables.js` | factions, Ancients, regions, settlements, gates; the readout computes its one needed constant (snow line) directly |
| `names.js` | feral syllable naming; the readout uses the burg's name |
| `capital-adapter.js`, `purity.js` | adapters for the feral layers' settlements and metadata |
| `bodies.js` | flat body inventory; the readout builds its rows from `system.planets` |

No `generateFeralSystem`, `generateEras`, `materializeRegion`, `generateEraGates`, settlement or
faction code is imported, copied or called.

## The generation

### Seed

```
`${options.map.seed}/astral/system/${burg.i}`
```

This is stable across opens, renames, moves, edits and save/load. It changes only when the map seed
changes (a new map). A system's detail is therefore reproducible without storing anything.

### The forced class

```ts
const people = peopleOf(burg);
const { class: spectral } = starClass(people);
const system = generateSystem(seed, { primaryType: spectral });
```

The astro star table's own spectral weights are not used for the primary — the chart already made
that call. The weights still shape the companions. The primary's luminosity class is forced to `V`
so the chart's main-sequence names ("yellow dwarf", "red dwarf", …) stay true; the astro source's
random `III`/`IV` branch is only meaningful for a generator that owns the star class itself.
`forcedLumClass` overrides the result but still consumes the source's roll, so the companion and
planet streams do not shift.

A population edit within the same class changes nothing in the readout. A crossing of a class
threshold changes the primary's class and **rerolls the system**, exactly as it already recolours
and resizes the marker. If authors later need a system to stay fixed across population edits, that
requires persisted state and a separate plan.

### The call

One `generateSystem` call per render. It produces the primary, companions, planets, moons, HI
buckets and orbital positions. There is no retry loop: a barren system is a valid reading, and the
dialog shows a "No planets detected" row. Generation is cheap (one system, at most 10 planets) and
is recomputed on each `updateSystemValues()`; no cache to invalidate, no stale state.

### The readout model

`src/generators/astral-system/details.ts` owns the boundary between the astro types and the dialog:

```ts
export interface SystemDetails {
  stars: StarRow[];
  totalMassSolar: number;
  snowLineAU: number;
  planetCount: number;
  habitableCandidate: boolean;
  planets: PlanetRow[];
}

export interface StarRow {
  role: string;                 // "Primary", "Secondary", "Companion 3", ...
  spectral: string;             // "G"
  luminosityClass: string | null; // "V" for the primary
  massSolar: number;
  luminositySolar: number;
  color: string;                // the class swatch
  separationAU: number | null;  // companions only
  periodYears: number | null;   // companions only
  massRatio: number | null;     // companions only
}

export interface PlanetRow {
  name: string;                 // "Kessel I"
  type: string;                 // "rocky", "super-Earth/sub-Neptune", "Neptune-like", "gas giant"
  orbitAU: number;
  radiusEarth: number;
  gravity: string;              // the astro HI gravity readout
  temperature: string;          // "temperate"
  temperatureC: string;         // "-12.3"
  atmosphere: string;
  water: number;                // 0..100
  habitability: string;         // "earthlike" | "survivable" | ...
  hi: number;                   // 1..5
  moons: string[];              // "Kessel I a", ...
  color: string;                // the table dot
  periodDays: number;
}
```

- `generateSystemDetails({ seed, systemName, spectral })` is the pure function: it generates and
  maps. Unit tests call it directly.
- `systemDetailsFor(burg)` is the thin global-aware wrapper: it reads `options.map.seed`,
  `peopleOf(burg)`, `starClass(...)` and `burg.name`, then calls the pure function.
- Planet names use the burg name plus Roman numerals; moon names add a letter suffix, the same
  convention as the feral `bodies.js`. Renaming the system updates the table; the seed does not move.
- The astro pre-classification label is preserved as `planet.subtype` in `system.ts` before
  `generatePlanet` receives its coarse `rocky`/`gas giant` classification, so the table can show the
  richer type the generator actually rolled.

## The dialog

The existing top block stays: the star preview, sector/empire, name, people, population, class,
installations, production, wealth and treasury. A new readout block goes **below it and above the
bottom toolbar**:

```
Star
  [ stars table ]
  Total mass 1.64 M☉ · Snow line 2.7 AU · 7 planets · Habitable candidate

Planets
  [ planets table, scrollable ]
```

### Stars table

| Star | Class | Mass (M☉) | Lum (L☉) | Separation (AU) | Period (yr) |
|---|---|---|---|---|---|
| Primary | G V | 1.02 | 1.00 | — | — |
| Secondary | K | 0.62 | 0.25 | 12.40 | 31.2 |

- The primary row carries `separation`/`period` as `—`; companions carry `—` for the luminosity
  class (the astro source does not roll one for companions).
- Companion luminosity is the class's table value (`starTypeData[spectral].luminosity`), shown as a
  class reading, not a per-star roll. The companion row's tooltip carries the mass ratio.
- The total line shows `star.totalMass`, `2.7 * sqrt(star.luminosity)`, `system.planets.length`,
  and the `isHabitableCandidate` tag when true.
- A colour dot from `starTypeData[spectral].color` sits beside each class.

### Planets table

| Planet | Type | Orbit (AU) | Radius (R⊕) | Gravity (g) | Temp | Atmosphere | Water | Habitability | Moons |
|---|---|---|---|---|---|---|---|---|---|
| Kessel I | rocky | 0.39 | 1.00 | 1.00 | temperate | Breathable | 62% | earthlike | 1 |
| Kessel II | gas giant | 1.24 | 11.83 | 2.31 | cold | Crushing | 0% | robot accessible | 4 |

- `Radius (R⊕)` is `planet.radius / 6371`; `Gravity` is the astro `planet.g` readout.
- `Temp` shows the band; its tooltip carries `temperatureC` in °C.
- `Habitability` shows the description; its tooltip carries `HI n`.
- `Moons` shows the count; its tooltip lists the names. A future nested moon table is out of scope.
- `Orbit`'s tooltip carries `periodDays`.
- The table is wrapped in an `overflow: auto` block with a max height; the header stays visible.
  Long tables scroll inside the dialog rather than growing it off-screen.
- Empty state: one row spanning the columns, "No planets detected", while the stars table still
  renders.

All text goes through `escapeHtml`; numbers use `rn`. The tables use a compact class in the dialog
template; no global stylesheet change.

## Data flow and lifecycle

1. `AstralSystemEditor.open(id)` runs as today: closes other dialogs, shows the systems/labels
   layers, renders the form, selects the id.
2. `updateSystemValues()` reads the burg, updates the existing fields, then calls
   `systemDetailsFor(burg)` and `renderSystemDetails(details)`.
3. `renderSystemDetails` replaces the two table bodies and the totals line. It never adds event
   listeners, so there is no teardown beyond the existing dialog destroy.
4. Population change: `Burgs.setPopulation` runs, `updateSystemValues()` reruns with the new class,
   the star preview and the readout move together, then `Layers.draw("systems")`.
5. Name change: `changeName` re-renders the readout with the new burg name; the seed and the
   generated bodies do not change.
6. Close: the dialog is destroyed as today; the generated details are garbage-collected with it.

No `Burgs` write, no `Layers.draw`, no `options` write is added for the readout itself.

## Files

### New

```
src/generators/astral-system/rng.ts
src/generators/astral-system/util.ts
src/generators/astral-system/astrophysics.ts
src/generators/astral-system/palette.ts
src/generators/astral-system/layout.ts
src/generators/astral-system/stars.ts
src/generators/astral-system/planet.ts
src/generators/astral-system/system.ts
src/generators/astral-system/details.ts
src/generators/astral-system/index.ts          public exports: systemDetailsFor, types
src/generators/astral-system/details.test.ts
src/generators/astral-system/system.test.ts    determinism and field sanity for the port
```

### Modified

```
src/controllers/astral-system-editor.ts  the readout block, tables and render call
tests/e2e/astral-systems.spec.ts          readout, reopen stability, no-new-state guard
docs/astral/README.md                     the System Editor section and a planned roadmap entry
docs/plans/astral-system-dialog.md        a follow-up link beside the "no generator changes" note
MERGING.md                                the astro port and the editor touch-point
```

## Phases

### Phase 1 — The astro port and the readout model

- Port the eight astro modules and the `createRng` facade; keep the source's comments about the
  adaptations, and add a provenance header (source path, date).
- Add `details.ts`: seed derivation input, forced primary class, Roman/letter naming, rows, totals,
  snow line, empty-system handling.
- Add the pure tests: determinism, forced class, `lumClass === "V"`, finite planet fields, moon
  names, star totals, and a port sanity suite (max 10 planets, finite periods/orbits, no NaN).
- No dialog change yet.

**Acceptance:** the port imports nothing from the feral layers and no global state; the same
`generateSystemDetails` input yields deep-equal output; every row has finite/valid display values;
lint and unit tests pass.

### Phase 2 — The dialog readout

- Add the readout block to `renderDialog()`: stars table, totals line, planets table, styles.
- Call `systemDetailsFor` from `updateSystemValues()` and render both tables; no cache.
- Handle the empty system, long moon lists and the scrolling table.
- Extend the e2e: the star table and planet table appear on open; closing and reopening the same
  system yields the same table; a class-threshold population edit updates the star class and the
  readout; opening the dialog adds no keys to the burg record.
- Docs: the README section and roadmap entry, the dialog-plan follow-up link, the MERGING.md
  section.

**Acceptance:** clicking a system shows the generated star and planet data; the same map produces
the same tables after close/reopen (save/load preserves the same inputs, so the readout is unchanged
by construction); a population crossing changes the primary class; no `.map` record or burg field is
added; the Standard-view Burg Editor and the astral hit tests pass unchanged; lint, unit tests, build
and the astral e2e specs pass.

## Testing

- **Unit (pure):** `details.test.ts` — determinism, forced spectral class, `lumClass`, row fields,
  Roman and letter names, moon names, totals/snow line, empty planets. `system.test.ts` —
  `generateSystem` deterministic across calls, planets capped at 10, finite orbit/radius/period and
  moon fields, companion mass/separation/period finite, layout positions finite.
- **E2E:** extend `tests/e2e/astral-systems.spec.ts` — the readout appears for a clicked system;
  the class line and the star table agree; a close/reopen leaves the tables byte-identical; a
  population threshold updates the star class; `Object.keys(pack.burgs[id])` is unchanged by
  opening/closing.
- **Standard guard:** `burgs.spec.ts` and the other Burg Editor specs must pass without edits; they
  exercise the Burg Editor directly in Standard view.
- **No Playwright run during development**; the e2e is the final acceptance, not the inner loop.

## Risks and open questions

- **Population-coupled reroll.** Crossing a class threshold rerolls the whole system. This follows
  from the chart's class being population-derived and from keeping the readout stateless. If
  authors need stable planets across population edits, the next step is a persisted system record —
  new state, deliberately not in this plan.
- **Port drift.** The feral-system astro code may evolve in VerseEras. The one-file-per-source
  layout, a provenance header and the port's own tests make the next sync a mechanical diff.
- **Forced main sequence.** Forcing `lumClass` to `V` keeps the chart's "yellow dwarf" reading
  honest; it also means the readout never shows a giant primary. A giant star would need a class
  override (new state) and is out of scope.
- **Rough physics.** The astro values are deliberately rough (blackbody temperature, an Earth-radius
  gravity approximation, table luminosities). The table presents them as chart readings; the
  tooltips carry the units, not a promise of astrophysical precision.
- **Table width.** Ten planet columns plus the dialog's form can exceed a small viewport. The
  scroll wrapper and compact type keep the dialog usable; if it still feels wide, drop `Gravity` or
  merge it with `Radius` into one "Size" cell.
- **No cache.** Recomputing on every `updateSystemValues()` is cheap for one system. If future
  columns need expensive work (for example a full moon table), cache per open rather than across
  opens; do not persist.

## Out of scope

- Persisting, editing, rerolling or locking a generated system; any new `.map` record or burg field.
- The feral-system layers: eras, Ancient factions, regions, fiefs, gates, settlements, tech levels,
  thrall-overlords or the feral present.
- Planet surface maps, orbit diagrams, moon tables, biospheres, POIs or planetary naming beyond the
  Roman/letter convention.
- Driving the chart marker's spectral class from the generated star; the class stays a readout of
  population.
- Changing `starClass` thresholds, the astral style, the systems layer or the Star Systems overview.
- Generating every system at map load or draw time.
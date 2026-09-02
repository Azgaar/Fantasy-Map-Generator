# Options

Everything the user configures about a map — the seed, canvas size, generator parameters, units,
calendar, label policies, transport types — lives in one plain object, `options`. It is the
**map config** scope of [Two scopes of configuration](./architecture.md#two-scopes-of-configuration):
it survives regeneration, it is written into every `.map` file, and the browser remembers it between
sessions.

Three things it is _not_:

- **not world data.** `pack` and `grid` are the generated world and are wiped on every regeneration;
  `options` is the input the world is generated _from_, and it outlives the map.
- **not styles.** Visual styling lives in the separate `styles` object, saved in its own `.map` field
  and its own `style*` localStorage keys. Options keep only `style.preset`, the _name_ of the preset
  the style came from, so the Style tab can show it again on load.
- **not interface preferences.** UI size, theme, tooltip size, "don't ask again" flags are per-browser
  and never enter a `.map` — see [Three storage scopes](#three-storage-scopes).

| File                                                                                                    | Role                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`src/components/options-store.ts`](../../src/components/options-store.ts)                              | The store: the defaults, the type they imply, and the live `options` object               |
| [`src/components/options-model.ts`](../../src/components/options-model.ts)                              | The model: the only thing that writes the store — `Options.set/restore/persist/randomize` |
| [`src/components/options/tabs/options-tab.ts`](../../src/components/options/tabs/options-tab.ts)        | The Options tab: markup, the `PANEL_SETTINGS` binding table, `syncInputs`, `restoreUi`    |
| [`src/utils/preferences.ts`](../../src/utils/preferences.ts)                                            | Locks (pinned options) and the per-key `stored`/`store` interface preferences             |
| [`src/services/storage-migration.ts`](../../src/services/storage-migration.ts)                          | Folds the pre-v1.151 key-per-option localStorage layout into the object                   |
| [`src/services/io/save.ts`](../../src/services/io/save.ts) / [`load.ts`](../../src/services/io/load.ts) | Writes `JSON.stringify(options)` as `.map` field 1 and restores it                        |
| [`src/services/io/auto-update.ts`](../../src/services/io/auto-update.ts) → `migrateLegacySettings`      | Converts the pre-v1.151 pipe-delimited `.map` settings string into the object             |

---

## The store: defaults _are_ the schema

`options-store.ts` holds one function, `getDefaultOptions()`, returning a fresh object with every
field at its default, and derives the type from it:

```ts
export type OptionsData = ReturnType<typeof getDefaultOptions>;
export const options: OptionsData = getDefaultOptions();
```

- **One source of truth per option.** There is no separate interface to keep in sync — adding a field
  with a sensible default extends the type, the persisted shape and the `.map` payload at once.
- **Grouped by domain, not by panel.** `graph`, `heightmap`, `geography`, `climate`, `lore`,
  `cultures`, `states`, `provinces`, `religions`, `burgs`, `units`, `style`, `labels`, `trade`,
  `threeD`, `military`, `transports`, `coastline`. The grouping follows what the value configures, so
  a setting is findable without knowing which tab or dialog exposes it. Several groups are not in the Options
  tab at all — the World Configurator writes `geography`/`climate`, the Units editor writes `units`,
  the Burg Group editor writes `burgs.groups`.
- **Defaults may be computed** (`navigator.language` picks metric or imperial units) or delegated to
  the module that owns the shape (`Labels.getDefaultOptions()`, `Burgs.getDefaultGroups()`,
  `tradeAnimation.getDefaultOptions()`).
- **Nothing but data.** The store imports types and default providers and exports values; all
  behaviour is in the model.

`globalThis.options` and `globalThis.Options` are [legacy seams](./migration_guide.md) for the
remaining classic scripts in `public/modules`. New code imports from `@/components/options-store`.

## The model: the only writer

Every write to `options` goes through `Options` (`options-model.ts`):

| Method                    | Use                                                                          |
| ------------------------- | ---------------------------------------------------------------------------- |
| `Options.set(change)`     | Mutate the object and remember it — the one call editors and panels need     |
| `Options.restoreStored()` | Boot: overlay the last session, then the URL params, on the defaults         |
| `Options.restore(saved)`  | Overlay an arbitrary settings object (a loaded `.map`) without persisting it |
| `Options.persist()`       | Flush to `localStorage` now                                                  |
| `Options.randomize()`     | Re-roll every option the user has not pinned, before a new map is generated  |

```ts
Options.set(o => (o.climate.precipitation = Number(value)));
```

- **Writes are debounced, not immediate.** `set` schedules `persist()` 500 ms later, so dragging a
  slider does not hammer `localStorage`. A `pagehide` listener in
  [`shell.ts`](../../src/components/shell.ts) flushes the pending write, and `persist()` clears the
  timer — a debounced edit is never lost.
- **`restore` merges, it does not replace.** It runs [`deepMerge`](../../src/utils/objectUtils.ts)
  over the live object, so a stored blob or an old `.map` that predates a field simply leaves that
  field at its default. This is the whole backwards-compatibility mechanism for options, and the
  reason old saves keep loading. Two consequences: arrays and non-plain values are replaced whole
  (`climate.winds`, `military`, `transports`), and a key can never be _removed_ by a merge — dropping
  a field needs a migration.
- **Derived values are the model's job.** Where one control drives more than one field, the model owns
  the rule: `setDensity` (slider step → `graph.cellsDesired`), `setSizeVariety` (one slider → both
  `cultures` and `states`), `shortEra` (era name → initials), `isAutoBurgLimit` (`burgs.limit === 1000`
  means "auto"). Callers never recompute these inline.

## Boot: how a value is resolved

[`boot()`](../../src/components/lifecycle.ts) resolves options before anything reads them:

```text
Options.restoreStored()  defaults ← stored session ← ?width/?height ← real window size
syncInputs()             push the object into the panel inputs
restoreUi()              the tab's own restore: lock icons, style presets, theme, UI size
```

Precedence is lowest to highest: **built-in defaults → last session → URL search params → the actual
window size**. The window size wins unless `mapWidth`/`mapHeight` are locked, and a zero-sized window
(a hidden or headless tab, see [the browser-pane gotcha](#gotchas)) falls back to 1280×800 rather than
producing a degenerate grid.

## Locks and randomization

A **lock** pins an option so `Options.randomize()` leaves it alone on the next map. Locks are a set of
panel keys in the `fmg-locks` localStorage key, owned by
[`preferences.ts`](../../src/utils/preferences.ts) (`isLocked`, `lock`, `unlock`, `setLocks`).

- **Editing a control locks it.** `watchInputs` calls `lock(key)` on the `change` event: setting a
  value by hand is taken as intent to keep it. Randomized values stay unlocked.
- **The key is the panel key**, not the object path — `statesNumber`, not `states.limit`. The same key
  names the input's `data-stored` attribute, the `lock_<key>` icon, and the `PANEL_SETTINGS` entry.
  One icon may stand for several keys via `data-ids` (the temperature lock pins both poles).
- **`Options.randomize()` re-rolls only unlocked options**, using the weighted/gaussian helpers in
  [`probabilityUtils`](../../src/utils/probabilityUtils.ts). `?options=default` in the URL ignores
  every pin — that is what a "copy map URL" link with randomized options reproduces.
- **Two groups are re-read, not rolled.** `burgs.groups` and `labels` are restored from storage (or
  their module defaults) on every generation: they are user-authored policy, so a new map should
  neither inherit the previous map's edits nor randomize them.
- **`bindLockIcons(root)` wires a panel's icons** when its markup lands on the page; `syncLockIcons()`
  repaints them all.

## The panel is a view over the object

The Options tab never holds a value. `PANEL_SETTINGS` in
[`options-tab.ts`](../../src/components/options/tabs/options-tab.ts) is the whole binding, one row per
setting:

```ts
{ key: "statesNumber", get: o => o.states.limit, set: (o, v) => (o.states.limit = +v) }
```

- **DOM → object on input, never the reverse.** A delegated listener on `#options` and `#dialogs`
  reads `data-stored` off the target, looks the key up in the table and applies its `set` through
  `Options.set`. An `input` event (a drag in progress) applies the value without locking or
  persisting; the `change` event locks and persists.
- **Object → DOM on demand.** `syncInputs()` walks the table and pushes `get(options)` into
  `<key>Input` and `<key>Output`. It runs after boot, after generation (the pipeline names the map)
  and after a `.map` is loaded. Nothing else needs to push a value into an input.
- **`restoreUi()` covers what the object does not:** lock icons, saved style presets, custom unit names
  that are not among a select's options, and the per-key interface preferences.
- **Keys with no `PANEL_SETTINGS` entry are interface preferences** and go to `store(key, value)`
  instead — the same `data-stored` mechanism serves both scopes, and the table decides which.

## Three storage scopes

| Scope                     | Key                         | Written by                 | In the `.map`? |
| ------------------------- | --------------------------- | -------------------------- | -------------- |
| **Map config**            | `fmg-options` (one object)  | `Options.persist()`        | yes, field 1   |
| **Locks**                 | `fmg-locks` (array of keys) | `lock`/`unlock`/`setLocks` | no             |
| **Interface preferences** | one key per setting         | `store(key, value)`        | no             |

Other localStorage owners are deliberately separate and not part of options: dialog geometry and
filters (`fmg-dialog-state`), layer presets (`preset`, `presets`), saved style presets (`style*`), and
the version marker used by [`versioning.ts`](../../src/services/versioning.ts).
`cleanupData()` clears the lot and reloads — that is what "Reset to defaults" does.

## Persistence in the `.map` file

`save.ts` writes `JSON.stringify(options)` as field 1 of the map data. The seed and canvas size are
duplicated in the header line (field 0), alongside the version, the date and the map id, so a file can
be identified without parsing the settings. Loading is the mirror image:

```text
migrateLegacySettings(mapVersion, data)  pre-v1.151 pipe string → an options-shaped object
Options.restore(JSON.parse(data[1]))     merge over the current object
Options.persist()                        the loaded map becomes this session's starting point
syncInputs()                             the panel follows
```

Because `restore` merges over the live defaults, a field added after a map was saved keeps its
default, and a field removed from the schema is ignored.

## Migrations

Two migrations exist, both for the v1.151 change of format, and both follow the same rule: **a
migration describes a world that no longer exists, so it carries its own copy of that world and never
leans on the live model.** Renaming a field today must not silently change what an old file means.

- **Stored options** are not migrated as we don't expect users to keep sentitive data in localStorage.
- **Saved maps** — `migrateLegacySettings` in [`auto-update.ts`](../../src/services/io/auto-update.ts).

## Adding an option

1. Add the field, with its default, to `getDefaultOptions()` in the group it belongs to. The type,
   persistence and `.map` round-trip follow for free.
2. If a control edits it, add a `PANEL_SETTINGS` row (or write it through `Options.set` from whichever
   controller owns the dialog) and give the input `data-stored="<key>"` plus, if it should be
   pinnable, a `lock_<key>` icon.
3. If a new map should re-roll it, add a `roll("<key>")` line to `Options.randomize()`.
4. Read it directly — `options.<group>.<field>` — in the generator or renderer that needs it. Reading
   never goes through the model.

No migration is needed for a new field: `deepMerge` leaves it at its default for every existing
browser and every existing `.map`.

## Gotchas

- **Never read `options` at module top level.** Bundled modules evaluate before boot restores the
  stored values, so a top-level read captures a placeholder. Read inside the function that uses it —
  see [migration_guide.md](./migration_guide.md).
- **Some fields are transient.** `states.growthModifier` is the States Editor's live slider,
  `threeD.isOn`/`isGlobe` are the current view mode. They sit in the object because it is the one
  config bag, but nothing should treat them as remembered preferences.
- **`coastline` is defaulted lazily** by `Coastline.settings` (`options.coastline ??= …`), because its
  shape belongs to the generator. Do not assume it is populated on a fresh object.
- **`randomize()` runs before the pipeline**, so a generator reading an option always sees the rolled
  value, never the previous map's.
- **Panel keys and object paths differ on purpose.** The keys are a stable UI/lock vocabulary inherited
  from the flat storage layout; renaming one invalidates the user's locks.

# Configuration

There is **one configuration object**. `options` holds everything the user can set, in three
sections with one storage location, one schema and one model:

| Section              | Answers                                  | In the `.map`?                          |
| -------------------- | ---------------------------------------- | --------------------------------------- |
| `options.map`        | what is true about the map on screen     | yes — it _is_ the file's settings block |
| `options.generation` | what to ask the generators for next time | never                                   |
| `options.app`        | how this browser behaves                 | never                                   |

The whole object lives in `localStorage` under `fmg-options`. `options.map` is also, byte for
byte, what a `.map` file stores in its settings block: saving writes that object and loading
replaces it, so the two cannot drift apart. There is no second object and no conversion.

`options.map` is [map config](./architecture.md#two-scopes-of-configuration) and is serialized to
`map.facts` beside `meta`, `layers`, `style` and `data` — see
[future-data-model.md](./future-data-model.md).

The shape is `options-schema.ts` and the model is `options-model.ts`; this page is why they look
the way they do, not a copy of what they contain.

---

## Principles

1. **Options are primary.** Every value the UI shows and every value the app reads is in
   `options`. A `.map` file is where one of its sections is written down, not a second store the
   app keeps in step.
2. **A section decides a lifetime, not a panel.** `map` is replaced by every load and
   re-established by every generation; `generation` and `app` outlive both.
3. **`generation` holds requests; `map` holds what happened.** Where a request and a result both
   exist they are different values in different sections with different names. Never two copies of
   one value, and never two forms of one — a density step and the cell count it stands for are the
   same request said twice, so only the step is stored.
4. **A value belongs in `map` if and only if the map cannot be operated correctly without it.**
5. **The model is the store.** `options` is a global the model declares and initializes, written
   plainly — `options.map.units.area.unit = …` — because a value takes effect where it is written.
   What remembers it is `Options.save()` (debounced) or `Options.persist()` for the few places that
   must not wait: boot, reset, and the end of a generation or a load.
6. **Validate at the boundary and replace, never merge.** Anything arriving from `localStorage` or
   a `.map` is parsed against the schema before it is adopted, and adoption swaps the section
   wholesale. Merging lets one map inherit another's values.
7. **The panel is a view.** Reading or writing a configuration value never requires a panel to be
   open, and the DOM is never the source of truth.

---

## The test

> Does anything other than a deliberate regeneration of that element need this value?

If yes, it belongs in `map`. If the only reader is the generator that produces the element, and
that generator only runs when the user asks for it, it is a **request** and belongs in
`generation`. The distinction that matters is **regeneration** (the user asks for a new version of
something and accepts current settings) versus **recalculation and rendering** (the map must keep
behaving like itself).

| Value                | Read by                                                | Section      |
| -------------------- | ------------------------------------------------------ | ------------ |
| `states.growthRate`  | only the states generator, whenever it is asked to run | `generation` |
| heightmap template   | the generators that raise the terrain, while they run  | `generation` |
| `cultures.set`       | marker generation branches on it long after generation | `map`        |
| `coastline`          | building a feature path at render time                 | `map`        |
| `graph.width/height` | every latitude, longitude and full-map cover           | `map`        |
| 3D erosion detail    | the 3D renderer, this session only                     | `app`        |

Counts, rates, ratios and varieties are spent when the generator runs, so they are rarely map
values. What survives is what **other** things read: `cultures.set` is in `map` and
`cultures.growthRate` is not, because marker and name generation still branch on the set long after
the cultures are drawn. And what produced something is not what describes it — the heightmap
template raised the terrain and is never consulted again.

---

## The three sections

**`options.map`** is cell-independent map data: the seed, the graph extent, where the map sits on
the globe and the climate that produced its per-cell values, the culture set, lore, units, the
style preset, the definition sets, and the coastline settings the renderer reads. Everything keyed
by cell lives in `data` instead.

Some of it is **derived** — `geography.coordinates` is computed from `mapSize`, `latitude`,
`longitude` and the aspect ratio. A derived value is re-derived **the moment any of its inputs
changes**, not when someone needs the result, which is what makes the stored value trustworthy. It
is serialized, and a load takes it as the file gives it; a file too old to carry it gets one
computed on load. A derived value must stay recomputable, so nothing is lost if the cache is
dropped.

**`options.generation`** is the requests: the graph to build, entity counts, ratios, rates and
varieties, culture set and template for the next map. Note the deliberate pair —
`generation.graph.{width,height,density}` is the graph asked for and `map.graph.{width,height,points}`
is the one that was built. Changing the request does not touch the map on screen. World-position
requests are nullable: `null` means automatic, a number fixes that input, and the resolved numbers
land in `map.geography`, which keeps lock handling out of terrain generation.

**`options.app`** is the preferences: they take effect immediately and generate nothing.
Two rules keep the boundary sharp. **"Show all regardless of zoom" is a preference** —
`labels.showAll` turns off zoom culling for this browser, while `labels.resizeOnZoom` decides how
the map's own typography behaves and so belongs to `map`. And **a preference the user has not set
is `null`, not a guess** — interface size follows the screen and the viewport follows the window
until someone chooses otherwise, so a control's reset writes `null` rather than today's number.

The **viewport** is the clearest case of the last rule, and the one most often confused with the
extent: the extent is the coordinate space the map's geometry lives in, fixed for the life of its
graph and asked for before the map exists; the viewport is the screen window onto it.

### The definition sets

Military unit types, transport types, burg groups, label groups and the coastline settings sit in
`options.map` however much they look like user settings, because **entities point at them by
name**: a set that travels separately from its entities opens a map with unresolved references.

They are also the set the **next** map starts from: they survive a refresh because they are in
`options`, and `Options.randomize()` carries them across explicitly while resetting everything else
in `options.map`. A set is never empty — the boundary repairs one that arrives empty from the
module that owns it, because a label type with no group draws no labels.

### Locks

A lock pins a value so a new map does not re-roll it. It stores **the value**, in a store of its
own: `options.map` is replaced wholesale by every load and every generation, so a pin that named
only a key would not survive one. Lock keys are a stable UI vocabulary independent of the object
paths — renaming one invalidates a user's pins — and each maps to the same schema node that
validates the option it pins.

The options model resolves every pin; generators never read one. A dialog owns the icons it shows
and answers for the value each stands for. A lock is a boundary like any other: an unknown key is
never pinned, and a pinned value its schema rejects is ignored rather than written into the map. A
preference is never pinnable, because nothing re-rolls it.

One predicate bypasses the whole store, for `?options=default`. It ignores the pins, not this
browser's stored requests, so it is not a reset: a request nothing re-rolls still stands at what the
user last set.

---

## Storage scopes

| Scope         | Key                                     | In the `.map`? |
| ------------- | --------------------------------------- | -------------- |
| `options`     | `fmg-options`                           | `map` only     |
| Locks         | `fmg-locks`                             | no             |
| Dialog state  | `fmg-dialog-state`                      | no             |
| Layer presets | `preset`/`presets`                      | no             |
| Style presets | `fmgStyle_*`                            | no             |
| App flags     | `version`, `debug`, and other bare keys | no             |
| Credentials   | cloud, AI and help-assistant tokens     | no             |

**One key holds all three sections.** A preference does not get a `localStorage` key of its own,
however small it is: a key beside the object is a second source of truth for a control the object
already answers for, and the panel ends up showing one while the app reads the other.

The exceptions are all things that are not preferences. The preset libraries and the dialog state
are lists keyed by something the user named, not fields a control answers for. The locks are values
keyed by a vocabulary of their own. The app flags are what the app records about itself, shown by
no control. The credentials are secrets with their own lifetime, revoked independently of anything
the user configured.

---

## Lifecycle

**A load** establishes a new map without rewriting what this browser wants of the app. It parses
the file's settings against `mapSchema` and **replaces** `options.map` wholesale — a section the
file lacks becomes the schema default, never the previous map's value — re-derives what the file
did not carry, leaves `options.app` and `options.generation` alone, and refreshes the panels. The
extent is the one request a load updates, because generating from the opened map should keep its
shape; a pinned extent is never overridden. Adding anything else to that rule needs a reason stated
here, and the default answer is no.

**A save** writes `options.map` as it stands, and nothing else. The file records what the map is; a
request that was never generated is not part of the map. Where a request and a result both exist,
only the result is saved.

**A generation** is the commit point from requests to map values. `Options.randomize()` re-rolls
the unpinned requests, resolves the ones the map keeps into `options.map`, and re-rolls the map
values that have no request. Values needing terrain are resolved by their own pipeline step
instead, with no callback into the options model.

- **A new map** starts `options.map` from the defaults and keeps the seed, the active style preset
  and the definition sets. Generation keeps the current style, so its preset must carry over too.
- **Regenerating one element** reads the current request for that element and writes afterwards the
  parameters the map needs, such as its culture set.
- **A recalculation is not a regeneration.** Re-deriving climate or rebuilding a coastline path
  reads `options.map`, never `options.generation`.
- **Editing a map value directly** is what the panels that own them do — world position and
  climate, units, lore, the definition sets. Such a panel writes `options.map` or pins the value,
  saves, and runs whatever derivation and redraw depend on it. It does not write requests.

Consequently the panel that shows requests and the panel that edits map values are different
panels, each writing exactly one section, and **every value has exactly one writer**: a request is
written by its control, a map value by the generator, derivation or editor that produces it.

---

## Validation

`options` is validated when read from `localStorage`, and the settings block when read from a
`.map`. Validation must **repair rather than reject** — one stale field cannot cost the user their
map or their settings. Each section is validated independently; a failing value is replaced with
its default and the section re-validated; a section that still fails falls back to its own default,
with a console warning at each step. Unknown keys are stripped, which is how values from an
abandoned schema stop travelling. A file is always repaired from the **defaults**, never from what
is on screen, so a section the file lacks cannot come back as the previous map's value.

A leaf constrains **what would break the app**: a positive extent, a whole count, a step the table
has an entry for, one of a closed set of modes, a colour that is a colour. It constrains nothing
beyond that — a bound the UI merely happens to impose is not a claim about the value, and turning a
slider's `max` into validation lets a repair quietly rewrite a number the user set on purpose.

The definition sets have no per-entry defaults, so an entry that cannot be repaired is dropped on
its own. Losing one unit type is a repair; losing the set is what makes every regiment that
referenced it stop resolving.

### Migrations

A migration describes a world that no longer exists, so it **carries its own copy of that world and
never leans on the live schema**: renaming a field today must not change what an old file means.
Migrations run at the boundary, before validation, and produce a current-shaped object.

A `.map` file is a migration's job because the user cannot re-make it. This browser's stored
settings are not: they are one panel away. So the two are migrated to different depths — out of
per-control `localStorage` keys the migration adopts what the user would miss (preferences chosen
once, definition sets built by hand) and drops what they would re-set without noticing (the pins,
whose old keys carry neither the vocabulary nor the shape the current ones claim). It runs
_underneath_ the stored object rather than after it, so its values are validated like any other
untrusted store.

---

## Invariants

These are the properties the design exists to guarantee, and the ones worth asserting in tests:

- **Round trip.** Load a file, save it, load it again: the settings block is identical.
- **No cross-map inheritance.** Load map A, then map B: no value from A survives in `options.map`.
- **A file describes its map.** Every value in a saved file was written by something that actually
  ran. Changing a request without generating changes no file.
- **The app survives maps.** Loading any map leaves `options.app`, `options.generation` and the
  pins unchanged, save for the extent, which never overrides a pin.
- **The map survives a reload.** Anything needed to render or operate the map is in the file, so a
  fresh browser opens it identically.
- **Derivation is idempotent.** Re-deriving a derived value from a saved file reproduces the saved
  value.

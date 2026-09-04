# Configuration

Everything the user can set is one of exactly two things: something true about **this map**, or
something true about **this browser**. Those are two objects with two lifetimes, two storage
locations and two sets of writers:

| Object    | Answers                              | Lives in       | In the `.map`? |
| --------- | ------------------------------------ | -------------- | -------------- |
| `facts`   | what is true about the map on screen | the map object | yes            |
| `options` | what this browser wants              | `localStorage` | never          |

`facts` is [map config](./architecture.md#two-scopes-of-configuration) and sits at
`map.facts` beside `meta`, `layers`, `style` and `data` — see
[future-data-model.md](./future-data-model.md). `options` is the app preference scope.

---

## Principles

1. **Two scopes, two objects.** A configuration value belongs to the map or to the browser. There
   is no third place and no value that is both.
2. **Facts are written by generation, derivation, or a file load.** An input writes `options`.
   A fact changes when a generator runs, when a derivation re-runs, or when a `.map` is read.
   This single rule is what keeps a saved file consistent with the map it describes.
3. **`options` holds requests; `facts` holds what happened.** Where a request and a result both
   exist they are different values in different objects with different names — `options` asks for
   18 states on a graph 1600×900 at density step 4, `facts` records the graph that was built, and
   the states themselves are data. Never two copies of one value: a field that ends up in both
   objects means the test below was answered twice and differently. Nor two forms of one value:
   a step and the cell count it stands for are the same request said twice, so only the step is
   stored and the count is derived where it is used.
4. **A value is a fact if and only if the map cannot be operated correctly without it.** See
   [The test](#the-test) — this is the only admission criterion, and it is decidable per field.
5. **The schema is the shape; the model holds the defaults.** The schema file carries the zod
   object and the type derived from it, and nothing else. One function in the model returns a
   fully-defaulted object, taking each value from the module that owns the concept — a coastline
   default belongs to the coastline generator, and is imported, never copied. Adding a field
   extends the type, the persisted shape and the `.map` payload at once. A new map starts from the
   defaults; a loaded map starts from its file.
6. **The model is the store.** `facts` and `options` are globals the model declares, initializes
   and is the only writer of. There is no separate store module to keep in step with it.
7. **Validate at the boundary and replace, never merge.** Anything arriving from `localStorage`
   or a `.map` is parsed against a schema before it is adopted, and adoption swaps the section
   wholesale. Merging lets one map inherit another's values.
8. **The panel is a view.** Reading or writing a configuration value never requires a panel to be
   open, and the DOM is never the source of truth.
9. **The preservation library is written only by a user edit** — never by a load, never by
   generation. See [Preservation](#preservation-across-maps).

---

## The test

> Does anything other than a deliberate regeneration of that element need this value?

If yes, it is a fact. If the only reader is the generator that produces the element, and that
generator only runs when the user asks for it, it is an option.

The distinction that matters is **regeneration** (the user asks for a new version of something and
accepts current settings) versus **recalculation and rendering** (the map must keep behaving like
itself). Worked examples:

| Value                  | Read by                                                | Verdict    |
| ---------------------- | ------------------------------------------------------ | ---------- |
| `states.growthRate`    | only the states generator, whenever it is asked to run | **option** |
| `states.sizeVariety`   | only the states generator, whenever it is asked to run | **option** |
| states count requested | only the states generator, only when asked             | **option** |
| `cultures.set`         | marker generation branches on it long after generation | **fact**   |
| `coastline`            | building a feature path at render time                 | **fact**   |
| `graph.width/height`   | every latitude, longitude and full-map cover           | **fact**   |
| density slider step    | positioning the slider                                 | **option** |
| heightmap template     | the generators that raise the terrain, while they run  | **option** |
| 3D erosion detail      | the 3D renderer, this session only                     | **option** |

Four corollaries worth stating, because they are the cases people get wrong:

- **A count, rate, ratio or variety is rarely a fact.** They are spent when the generator runs:
  once the states exist their number, spread and growth are in the data, and the request that
  produced them is inert. Adding one more state later is that generator running again, on the
  request as it stands — not the map recalculating itself.
- **What survives is what other things read.** `cultures.set` is a fact and `cultures.growthRate`
  is not, because marker and name generation still branch on the set long after the cultures are
  drawn, while nothing but the culture generator has ever asked about the rate.
- **A value read at render time is always a fact**, however configuration-shaped it looks.
- **What produced something is not what describes it.** The heightmap template raised the terrain
  and is never consulted again; the terrain itself is the data. Storing the template would also be
  a claim the map cannot keep, since the user can edit the heightmap until nothing of the template
  is left.

---

## `facts` — the map's own configuration

Cell-independent map data. `facts` is where map data goes when it does not depend on a graph:
the topology and everything keyed by cell live under `data`, and `facts` holds what is true about
the map as a whole. This is also what makes definition sets belong here rather than beside the
cells that reference them.

| Group        | Fields                                                      | Why it is a fact                                                          |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| —            | `seed`                                                      | reproduces the map and identifies its graph                               |
| `graph`      | `width`, `height`, `points`                                 | the coordinate extent; not recoverable from the topology, which floors it |
| `geography`  | `mapSize`, `latitude`, `longitude`                          | where the map sits on the globe                                           |
| `climate`    | `temperature.*`, `precipitation`, `winds`                   | produced the per-cell temperature and precipitation; needed to re-derive  |
| `cultures`   | `set`                                                       | unrelated generators branch on it long after the cultures exist           |
| `lore`       | `name`, `description`, `calendar.*`                         | filenames, state history, battle reports, and the author's own note       |
| `units`      | `distance`, `area`, `height`, `temperature`, `population`   | the map's scale, and the author's presentation of it                      |
| `labels`     | `groups`, `showAll`, `resizeOnZoom`                         | label data references groups **by name**                                  |
| `military`   | `units`                                                     | regiments resolve unit types **by name**                                  |
| `transports` | type definitions                                            | route segments reference types **by name**                                |
| `burgs`      | `groups`                                                    | burgs reference groups **by name**                                        |
| `coastline`  | fractalization settings                                     | read at render time to build feature paths                                |
| `style`      | `preset`                                                    | the preset the map's styles came from, so the Style tab can show it again |

**Reference by name is the strongest fact signal there is.** A definition set that entities point
at by name must travel in the same file as those entities, or the map opens with unresolved
references — which is why `military`, `transports`, `burgs.groups` and `labels.groups` are facts
and not preferences, however much they look like user settings.

### Derived facts

`geography.coordinates` (the lat/lon box) is computed from `mapSize`, `latitude`, `longitude` and
the extent's aspect ratio. Nothing may write it except that derivation, and the derivation runs
**the moment any of its four inputs changes** — not when someone happens to need the result. That
is what makes the stored box trustworthy: it cannot drift from the values it came from.

It is serialized, and a load takes it as the file gives it. Re-deriving it there would be work that
can only produce the same answer, and would quietly re-render an old map if the formula ever
changed. A file that carries no box — anything old enough to predate it — gets one computed on
load.

A derived fact still has to be **recomputable**: the inputs travel in the same file, so nothing is
lost if the cache is dropped.

---

## `options` — this browser's configuration

Three parts with one storage location and one schema:

| Part                     | Lives in            | Contents                                                                                                                                                            | Notes                                                     |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Requests**             | `options.generation` | the graph to build (extent and density), entity counts, ratios, rates and varieties, culture set and template for the next map                                      | consumed by generation; what it keeps is written to `facts` |
| **Preferences**          | `options.app`       | 3D settings, animation settings, notes pinning, emblem visibility and shape, interface size, theme, tooltip size, autosave, on-load behaviour, rendering, zoom extent, viewport size | take effect immediately, affect nothing generated         |
| **Preservation library** | `options.library`   | the user's own definition sets, kept for the next map                                                                                                               | see [Preservation](#preservation-across-maps)             |

Also transient editor state that has nowhere better to live (a live "growth modifier" slider, for
instance). Such a field is not a remembered preference — mark it as transient in the schema so
nobody mistakes it for one.

**One key holds all three.** A preference does not get a `localStorage` key of its own, however
small it is: a key beside the object is a second source of truth for a control the object already
answers for, and the panel ends up showing one while the app reads the other. The exceptions are
the preset libraries below, which are lists rather than fields.

**A preference has no lock.** Nothing re-rolls it, so there is nothing to pin it against — pinning
an option the [locks](#locks) cannot answer for stores nothing and lights an icon that stands for
nothing. Locks belong to requests, and to the facts that have no request.

**A preference the user has not set is `null`, not a guess.** Interface size follows the screen
and the viewport follows the window until someone chooses otherwise; storing the derived value
instead would freeze today's window into a setting the user never asked for. The control's reset
puts the field back to `null` rather than to a number.

**Applying a preference is not writing it.** The function that paints the dialogs, sizes the
interface or re-renders the map takes the value; it does not decide it. Where several controls edit
one value — a colour and its transparency, the two ends of the zoom extent — the group keeps one
writer, so the object always holds what the screen is actually showing.

### Locks

A lock pins a value so a new map does not re-roll it. A lock stores **the value**, in a store of its
own: `facts` is replaced wholesale by every load, so a pin that named only a key would not survive
one. Editing a control by hand pins it; a rolled value stays unpinned. Lock keys are a stable UI
vocabulary independent of the object paths — renaming one invalidates a user's pins.

One table says, per key, which object answers for it, because that decides **when** the pin is
applied. A pinned **request** is applied where requests are resolved, before generation reads them;
a pinned **fact** is applied to the map being seeded, after the requests it has none of. Applying a
request pin later than that writes a value nothing will read until the map after next.

A lock is a boundary like any other: it is raw `localStorage`, so a key nothing answers for is
never pinned, and a pinned value that is not the type its option holds is ignored rather than
written into the map.

---

## Storage scopes

| Scope            | Written by                   | In the `.map`? |
| ---------------- | ---------------------------- | -------------- |
| `facts`          | generation, derivation, load | yes            |
| `options`        | input events, generation     | no             |
| Locks (keys)     | pinning a control            | no             |
| Preset libraries | an explicit user action      | no             |

Style presets, layer presets and dialog geometry are their own libraries with the same shape and
the same rule: user-owned, per-browser, written only on purpose.

---

## Load mechanics

Loading a `.map` establishes a new map. It must not silently rewrite what this browser wants.

1. **Parse and adopt facts.** Validate the file's `facts` against the schema and **replace**
   `facts` wholesale. A section the file lacks becomes the schema default — never the previous
   map's value.
2. **Re-derive derived facts** from their inputs rather than trusting the file's cache.
3. **Leave `options` alone**, except for the sync allowlist below.
4. **Refresh the panels** so every control shows its object again.

### The sync allowlist

A small, explicitly enumerated set of `options` requests that a load may update, because the user
would expect them to continue from the map they just opened:

| Option request   | Sourced from               | Why                                                        |
| ---------------- | -------------------------- | ---------------------------------------------------------- |
| requested extent | `facts.graph.width/height` | generating from an opened map should keep that map's shape |

Rules for this list, which exist to keep it from growing into a merge:

- An entry must be a **request**, never a preference and never a library entry.
- An entry **never overrides a lock.** A pinned request stays pinned.
- Adding an entry requires a stated reason in this table. The default answer is no.

Everything else the panel needs from the loaded map it reads from `facts` directly.

---

## Save mechanics

`facts` is serialized into the map file. `options` never is — not the requests, not the
preferences, not the library. The file records what the map is; a request that was never generated
is not part of the map.

Facts that duplicate data are written once. Where a request and a result both exist, only the
result is a fact, and where a fact is derived it may be written for convenience but must remain
recomputable without it.

---

## Generation mechanics

Generation is the commit point from requests to facts.

- **A new map** resolves its requests (rolling those the user has not pinned, applying pinned
  values from the locks), seeds definition sets from the preservation library, runs the pipeline,
  and writes the resulting parameters into `facts`. After generation, `facts` describes the map
  that exists.
- **Regenerating one element** reads the current request for that element, runs its generator, and
  writes that element's parameters into `facts`. Nothing else in `facts` changes.
- **A recalculation is not a regeneration.** Expanding states after an edit, re-deriving climate
  after a world-position change, rebuilding a coastline path — these read `facts`, because they
  must keep the map behaving like itself. They never read requests.
- **Editing a fact directly** is legitimate for the panels that own facts — world position and
  climate, units, lore, the definition sets. Such a panel writes `facts` and immediately runs
  whatever derivation depends on it. It does not write requests.

Consequently the panel that shows requests and the panel that edits facts are different panels,
and each binds to exactly one object. A binding table serves one object; a table that needs a
per-row scope column is two tables.

A dialog owns every control it shows: it writes the value, pins it, and runs whatever redraw the
change asks for. Nothing delegates writing into another panel's controls, so no control has two
writers and no value is written twice.

---

## Preservation across maps

Some facts are user-authored policy the user expects to keep: military unit types, transport
types, burg groups, label groups, coastline settings. They are facts of whatever map they are on
_and_ the starting point for the next one.

The mechanism is a **preservation library** in `options`, one entry per definition set:

- **A user edit writes both.** Editing a set on a map updates `facts` (the map changes now) and
  mirrors the result into the library (the next map starts there).
- **A load writes neither library entry.** Opening a map replaces `facts` and leaves the library
  untouched, so a map's own sets govern that map without becoming this browser's defaults.
- **Generation seeds facts from the library**, falling back to the module's defaults when the
  library has no entry.
- **Reset clears the library entry**, returning the next map to the module defaults.

The result is the behaviour users ask for — customization survives a refresh and a new map — with
none of the leakage that comes from letting a loaded map define the defaults. Because the library
is only ever written by a deliberate edit, its contents are always something this user typed.

---

## Validation

Both objects are validated at every boundary they cross: `options` when read from
`localStorage`, `facts` when read from a `.map`. Validation must **repair rather than reject** —
one stale field cannot cost the user their map or their settings:

1. Validate each section independently.
2. On failure, replace only the failing values with their defaults and re-validate the section.
3. If that still fails, fall back to the whole section's default.
4. Warn to the console at each fallback, naming the section.

Unknown keys are stripped, which is how values from a newer or abandoned schema stop travelling.
A field that must be _read_ before it disappears needs a migration; silent stripping is only for
fields nothing needs any more.

The defaults hold no counterpart for an entry of a definition set, so an entry that cannot be
repaired is dropped on its own. Losing one unit type is a repair; losing the set is what makes
every regiment that referenced it stop resolving.

`Styles.parse` in `src/generators/styles.ts` is the reference implementation of this shape —
per-section parse, per-leaf repair, whole-section fallback, warning — and its schema in
`src/generators/styles-schema.ts` is the reference for expressing defaults as the schema. New
schemas follow both rather than inventing a variant.

### Migrations

A migration describes a world that no longer exists, so it **carries its own copy of that world
and never leans on the live schema**. Renaming a field today must not change what an old file
means. Migrations run at the boundary, before validation, and produce a current-shaped object.

A `.map` file is a migration's job because the user cannot re-make it. This browser's stored
settings are not: they are one panel away, and a migration that carries them forward is code that
outlives the world it describes. So the two are migrated to different depths.

#### What `localStorage` carries forward, and what it does not

Before `fmg-options`, every preference and every pin had a `localStorage` key of its own, named
after the control that showed it — and `lock(id)` wrote the pinned value _into that key_, so the
keys **were** the locks. `adoptLegacyKeys` in `src/components/options-model.ts` takes the sixteen
preference keys into `options.app` and then removes the whole namespace, pins included.

**Dropping the old pins is deliberate.** A pin is a claim about a value's shape as well as its
name, and the old keys carry neither: `template` held a heightmap id whose vocabulary has since
changed, `points` a raw cell count where a density step lives now, `cultures` a number the culture
set caps. Re-typing thirty-odd strings against `PINNABLE` to restore a preference the user can
re-pin with one click is a migration that would then have to be kept correct forever. A returning
user gets the defaults, generates a map, and pins again — the loss is one session's convenience,
and the namespace is gone for good rather than half-read on every boot afterwards.

The sixteen preferences are adopted rather than dropped because nothing in the UI puts them back:
a theme colour or an interface size is a setting the user chose once and would not think to look
for. That is the line — **a value the user would re-set without noticing is dropped, a value they
would miss is adopted.**

---

## Adding a configuration value

1. **Apply [the test](#the-test).** Does anything other than a deliberate regeneration need it?
2. **Add the field to the schema** of the object it belongs to, in the group that matches what it
   configures — not the panel that shows it — and **its default to that object's model**, taking
   the value from the module that owns the concept if there is one. The type, persistence,
   validation and round-trip follow.
3. **Give it exactly one writer.** A request is written by its control. A fact is written by the
   generator, derivation or fact-owning editor that produces it. Never both, and never one field
   in both objects.
4. **Bind the control** to that object's table, and give it a lock if it is a request a new map
   should be able to keep. A preference gets no lock.
5. **If a new map should re-roll it**, add it to the randomization step. If a new map should
   inherit the user's own version, add a library entry instead.
6. **Read it directly** where it is used — reading never goes through a model.
7. **No migration is needed for a new field**: validation leaves it at its default for every
   existing browser and every existing file.

---

## Invariants

These are the properties the design exists to guarantee, and the ones worth asserting in tests:

- **Round trip.** Load a file, save it, load it again: `facts` is identical. Extend it across a
  corpus of real files from every supported version.
- **No cross-map inheritance.** Load map A, then map B: no value from A survives in `facts`.
- **A file describes its map.** Every fact in a saved file was written by something that actually
  ran. Changing a request without generating changes no file.
- **Options survive maps.** Loading any map leaves preferences, pins and the library unchanged,
  save for the allowlist, which never overrides a pin.
- **Facts survive a reload.** Anything needed to render or operate the map is in the file, so a
  fresh browser opens it identically.
- **Derivation is idempotent.** Re-deriving a derived fact from a saved file reproduces the saved
  value.

## Gotchas

- **Never read either object at module top level.** Modules evaluate before boot resolves stored
  values, so a top-level read captures a placeholder. Read inside the function that uses it.
- **A count is in the data, not in the configuration.** Ask the world how many states it has.
- **Two names beat one shared field.** When a request and a result feel like the same value, they
  are not — name them differently and let them diverge.
- **Extent is not viewport.** The extent is the coordinate space the map's geometry lives in, is
  fixed for the life of its graph, and is asked for — before the map exists — by
  `options.generation.graph`. The viewport is the screen window onto it: never a fact, because it
  describes this browser rather than the map, and a preference only once the user sets one by hand
  — `null` until then, meaning "follow the browser window". Either way the extent bounds it. They
  are two controls in two places, in two different sections of the panel, and a panel that shows
  one as the other is a bug.

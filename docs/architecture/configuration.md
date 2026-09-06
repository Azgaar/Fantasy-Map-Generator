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
replaces it, so the two cannot drift apart. There is no second object and no conversion —
`Options.applyLoaded(json)` validates a file's settings and puts them in place, and `save.ts` writes
`JSON.stringify(options.map)`.

`options.map` is [map config](./architecture.md#two-scopes-of-configuration) and is serialized to
`map.facts` beside `meta`, `layers`, `style` and `data` — see
[future-data-model.md](./future-data-model.md).

---

## Principles

1. **Options are primary.** Every value the UI shows and every value the app reads is in
   `options`. A `.map` file is where one of its sections is written down, not a second store the
   app keeps in step.
2. **A section decides a lifetime, not a panel.** `map` is replaced by every load and
   re-established by every generation; `generation` and `app` outlive both.
3. **`generation` holds requests; `map` holds what happened.** Where a request and a result both
   exist they are different values in different sections with different names — `generation` asks
   for 18 states on a graph 1600×900 at density step 4, `map` records the graph that was built, and
   the states themselves are data. Never two copies of one value: a field in both sections means
   the test below was answered twice and differently. Nor two forms of one value: a step and the
   cell count it stands for are the same request said twice, so only the step is stored and the
   count is derived where it is used.
4. **A value belongs in `map` if and only if the map cannot be operated correctly without it.**
   See [the test](#the-test).
5. **The model is the store.** `options` is a global the model declares and initializes. There is
   no separate store module to keep in step with it. It is written plainly —
   `options.map.units.area.unit = …` — because a value takes effect where it is written; what
   remembers it is `Options.save()` (debounced) or `Options.set(change)`, which is the same thing
   with the change inlined. `Options.persist()` writes immediately, for the few places that must
   not wait: boot, reset, and the end of a generation or a load.
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
`generation`.

The distinction that matters is **regeneration** (the user asks for a new version of something and
accepts current settings) versus **recalculation and rendering** (the map must keep behaving like
itself). Worked examples:

| Value                  | Read by                                                | Section      |
| ---------------------- | ------------------------------------------------------ | ------------ |
| `states.growthRate`    | only the states generator, whenever it is asked to run | `generation` |
| `states.sizeVariety`   | only the states generator, whenever it is asked to run | `generation` |
| states count requested | only the states generator, only when asked             | `generation` |
| `cultures.set`         | marker generation branches on it long after generation | `map`        |
| `coastline`            | building a feature path at render time                 | `map`        |
| `graph.width/height`   | every latitude, longitude and full-map cover           | `map`        |
| density slider step    | positioning the slider                                 | `generation` |
| heightmap template     | the generators that raise the terrain, while they run  | `generation` |
| 3D erosion detail      | the 3D renderer, this session only                     | `app`        |

Four corollaries worth stating, because they are the cases people get wrong:

- **A count, rate, ratio or variety is rarely a map value.** They are spent when the generator
  runs: once the states exist their number, spread and growth are in the data, and the request that
  produced them is inert. Adding one more state later is that generator running again, on the
  request as it stands — not the map recalculating itself.
- **What survives is what other things read.** `cultures.set` is in `map` and
  `cultures.growthRate` is not, because marker and name generation still branch on the set long
  after the cultures are drawn, while nothing but the culture generator has ever asked about the
  rate.
- **A value the drawing reads is a map value when the drawing would be wrong without it.** The
  coastline settings decide the shape of every feature outline, so a file that lost them opens as a
  different map. `rendering` and `showAll` are also read while drawing and are preferences: they
  change how this browser looks at the map, not what the map is. The question is whether the file
  still describes its map without the value, not when the value happens to be read.
- **What produced something is not what describes it.** The heightmap template raised the terrain
  and is never consulted again; the terrain itself is the data. Storing the template would also be
  a claim the map cannot keep, since the user can edit the heightmap until nothing of the template
  is left.

---

## `options.map` — the map's own configuration

Cell-independent map data: what is true about the map as a whole, where the topology and everything
keyed by cell live under `data`.

| Group        | Fields                                                    | Why it is a map value                                                     |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| —            | `seed`                                                    | reproduces the map and identifies its graph                               |
| `graph`      | `width`, `height`, `points`                               | the coordinate extent; not recoverable from the topology, which floors it |
| `geography`  | `mapSize`, `latitude`, `longitude`, `coordinates`         | where the map sits on the globe                                           |
| `climate`    | `temperature.*`, `precipitation`, `winds`                 | produced the per-cell temperature and precipitation; needed to re-derive  |
| `cultures`   | `set`                                                     | unrelated generators branch on it long after the cultures exist           |
| `lore`       | `name`, `description`, `calendar.*`                       | filenames, state history, battle reports, and the author's own note       |
| `units`      | `distance`, `area`, `height`, `temperature`, `population` | the map's scale, and the author's presentation of it                      |
| `style`      | `preset`                                                  | the preset the map's styles came from, so the Style tab can show it again |
| `labels`     | `resizeOnZoom`, `groups`                                  | typography under zoom; label data references groups **by name**           |
| `burgs`      | `groups`                                                  | burgs reference groups **by name**                                        |
| `military`   | `units`                                                   | regiments resolve unit types **by name**                                  |
| `transports` | type definitions                                          | route segments reference types **by name**                                |
| `coastline`  | fractalization settings                                   | read at render time to build every feature outline                        |

### Derived values

`geography.coordinates` (the lat/lon box) is computed from `mapSize`, `latitude`, `longitude` and
the extent's aspect ratio. Nothing may write it except that derivation, and the derivation runs
**the moment any of its four inputs changes** — not when someone happens to need the result. That
is what makes the stored box trustworthy: it cannot drift from the values it came from.

It is serialized, and a load takes it as the file gives it. Re-deriving it there would be work that
can only produce the same answer, and would quietly re-render an old map if the formula ever
changed. A file that carries no box — anything old enough to predate it — gets one computed on
load.

A derived value still has to be **recomputable**: the inputs travel in the same file, so nothing is
lost if the cache is dropped.

---

## The definition sets

Military unit types, transport types, burg groups, label groups and the coastline settings sit in
`options.map` beside the rest.

**Reference by name is the strongest signal there is.** A set that entities point at by name must
travel in the same file as those entities, or the map opens with unresolved references — which is
why these are saved with the map however much they look like user settings.

They are also the set the **next** map starts from, which is the whole of the preservation
mechanism: because they are in `options`, they survive a refresh, and `Options.randomize()` carries
them across explicitly while resetting everything else in `options.map`.

- **A user edit writes them**, and the map changes at once — the editors are their only writers,
  beside a load.
- **A load replaces them** with the opened map's sets: what this browser holds is what the map on
  screen holds, and the next map starts from there too.
- **A set is never empty.** `Options.applyLoaded` and `Options.restore` repair one that arrives
  empty from the modules that own it, because a label type with no group draws no labels and a
  burg group set with no default assigns no burgs.

---

## `options.generation` — the requests

The graph to build (extent and density), entity counts, ratios, rates and varieties, culture set
and template for the next map. Consumed by generation; what it keeps is written into `options.map`.

Note the deliberate pair: `generation.graph.{width,height,density}` is the graph asked for, and
`map.graph.{width,height,points}` is the one that was built. Changing the request does not touch
the map on screen — that is what makes the sections separate.

---

## `options.app` — the preferences

3D settings, animation settings, notes pinning, `emblems` and `labels` (shape, and whether all are
shown regardless of zoom), interface size, theme, tooltip size, autosave, on-load behaviour,
rendering, zoom extent, viewport size. They take effect immediately and generate nothing.

Also transient editor state that has nowhere better to live (a live "growth modifier" slider, for
instance). Such a field is not a remembered preference — mark it as transient in the schema so
nobody mistakes it for one.

**One key holds all three sections.** A preference does not get a `localStorage` key of its own,
however small it is: a key beside the object is a second source of truth for a control the object
already answers for, and the panel ends up showing one while the app reads the other. The
exceptions are the preset libraries below, which are lists rather than fields, the locks, which are
a store of values keyed by a UI vocabulary of their own, and the app flags, which no control shows
at all.

**"Show all regardless of zoom" is a preference.** Both `emblems.showAll` and `labels.showAll` turn
off a zoom-based culling so the user can look at everything at once. Nothing about the map changes,
and the next person to open the file has their own opinion about it — which is why they sit in
`options.app` beside `rendering`, and why a load carries neither. `labels.resizeOnZoom` is the
other way round: it decides how the map's own typography behaves, so it is in `options.map` and
travels with the file.

**A preference has no lock.** Nothing re-rolls it, so there is nothing to pin it against — pinning
something the [locks](#locks) cannot answer for stores nothing and lights an icon that stands for
nothing. Locks belong to requests, and to the map values that have no request.

**A preference the user has not set is `null`, not a guess.** Interface size follows the screen and
the viewport follows the window until someone chooses otherwise; storing the derived value instead
would freeze today's window into a setting the user never asked for. The control's reset puts the
field back to `null` rather than to a number.

**Applying a preference is not writing it.** The function that paints the dialogs, sizes the
interface or re-renders the map takes the value; it does not decide it. Where several controls edit
one value — a colour and its transparency, the two ends of the zoom extent — the group keeps one
writer, so the object always holds what the screen is actually showing.

### Locks

A lock pins a value so a new map does not re-roll it. A lock stores **the value**, in a store of
its own: `options.map` is replaced wholesale by every load and every generation, so a pin that
named only a key would not survive one. Editing a control by hand pins it; a rolled value stays
unpinned. Lock keys are a stable UI vocabulary independent of the object paths — renaming one
invalidates a user's pins.

`components/pins.ts` is the whole of the mechanism: `Pins` holds the store and the lock icons
alike. A dialog calls `Pins.bindIcons(dialog, pinnedValue)` and answers, in one function of its
own, for the value each icon stands for — there is no central table of keys, because the dialog
that shows a control is the one that knows where its value lives.

Everything a pin can restore is applied in one place, `Options.randomize()`: the requests first,
then the map values the requests resolve into, then the map values nothing rolls. Applying a pin
anywhere later writes a value nothing will read until the map after next.

A lock is a boundary like any other: it is raw `localStorage`, so a key nothing answers for is
never pinned, and a pinned value the key's own schema rejects is ignored rather than written into
the map. A preference is never pinnable — nothing re-rolls it.

**`?options=default` ignores every pin**, so the map is the one a fresh browser would make. One
predicate decides it (`Pins.ignored`), and `Pins.rolls(key)` and `Pins.valueOr(key, fallback)` are
the only way anything consults a pin. `valueOr` also drops a pin whose type no longer matches the
value it stands for, so a corrupt store cannot write a string into a number.

---

## Storage scopes

| Scope         | Key                 | Written by                       | In the `.map`? |
| ------------- | ------------------- | -------------------------------- | -------------- |
| `options`     | `fmg-options`       | input events, generation, a load | `map` only     |
| Locks         | `fmg-locks`         | pinning a control                | no             |
| Dialog state  | `fmg-dialog-state`  | a dialog the user arranged       | no             |
| Layer presets | `preset`/`presets`  | an explicit user action          | no             |
| Style presets | `fmgStyle_*`        | an explicit user action          | no             |
| App flags     | `version`, and the one below | the app itself, never the user | no  |

**A flag the user cannot set is not a preference.** `options` holds what the user can change; a
value the app records about itself gets a bare key instead. There are two: `version`, and
`disable_click_arrow_tooltip`, which says the user has found the options trigger so it stops
glowing. Neither is shown by any control, neither is pinnable, and neither belongs in `options`.

Style presets, layer presets and dialog state are their own libraries with the same shape and the
same rule: user-owned, per-browser, written only on purpose, and each a list keyed by something the
user named rather than a field a control answers for. A **preference** never joins them — it
belongs in `options.app`. The AI generator's `fmg-ai-model` and `fmg-ai-temperature` are the
outstanding exception, and are preferences that should move.

---

## Load mechanics

Loading a `.map` establishes a new map. It must not silently rewrite what this browser wants of the
app itself.

1. **Parse the file's settings** against `mapSchema` and **replace** `options.map` wholesale. A
   section the file lacks becomes the schema default — never the previous map's value.
2. **Re-derive derived values** their file did not carry.
3. **Leave `options.app` alone**, and `options.generation` too, except for the extent below.
4. **Refresh the panels** so every control shows the object again.

The extent is the one request a load updates: `generation.graph.width/height` follow the map just
opened, because generating from it should keep its shape. A pinned extent is never overridden.
Adding anything else to that rule needs a reason stated here, and the default answer is no.

---

## Save mechanics

`options.map` is written into the map file, as it stands. `options.generation` and `options.app`
never are. The file records what the map is; a request that was never generated is not part of the map.

Values that duplicate data are written once. Where a request and a result both exist, only the
result is saved, and where a value is derived it may be written for convenience but must remain
recomputable without it.

---

## Generation mechanics

Generation is the commit point from requests to map values, and `Options.randomize()` is the whole
of it: it re-rolls every unpinned request, resolves the ones the map keeps into `options.map`, and
re-rolls the map values that have no request of their own. It runs before the pipeline, never
after, and one line covers each value — the roll and the pin side by side.

- **A new map** starts `options.map` from the defaults and keeps only the seed, which `setSeed`
  resolved and reseeded the PRNG with beforehand, and the definition sets, which are the user's
  own and are the next map's starting point.
- **Regenerating one element** reads the current request for that element, runs its generator, and
  writes that element's parameters into `options.map`. Nothing else changes.
- **A recalculation is not a regeneration.** Expanding states after an edit, re-deriving climate
  after a world-position change, rebuilding a coastline path — these read `options.map`, because
  they must keep the map behaving like itself. They never read `options.generation`.
- **Editing a map value directly** is what the panels that own them do — world position and
  climate, units, lore, the definition sets. Such a panel writes `options.map` or
  pins the value, saves, and immediately runs whatever derivation and redraw depend on it. It does
  not write requests.

Consequently the panel that shows requests and the panel that edits map values are different
panels, and each writes exactly one section.

A dialog owns every control it shows: it writes the value, pins it, and runs whatever redraw the
change asks for. Nothing delegates writing into another panel's controls, so no control has two
writers and no value is written twice.

The options tab declares its bindings in `OPTION_BINDINGS`, using typed readers and writers,
parsers, optional pin keys and effects. Controls select a binding with `data-option`; paired
controls share the same binding. IDs remain for existing callers, but do not choose the option
or its paired control. Formatted readouts use `data-option-output`. Map size, viewport and zoom
commit through their grouped writers on `change`; theme controls share the theme writer.
The parent panel's legacy `Input`/`Output` pairing skips bound controls.

---

## Validation

`options` is validated when read from `localStorage`, and the settings block when read from a
`.map`. Validation must **repair rather than reject** — one stale field cannot cost the user their
map or their settings:

1. Validate each section independently.
2. On failure, replace only the failing values with their defaults and re-validate the section.
3. If that still fails, fall back to the whole section's default.
4. Warn to the console at each fallback, naming the section.

Unknown keys are stripped, which is how values from a newer or abandoned schema stop travelling. A
field that must be _read_ before it disappears needs a migration; silent stripping is only for
fields nothing needs any more.

The defaults hold no counterpart for an entry of a definition set, so an entry that cannot be
repaired is dropped on its own. Losing one unit type is a repair; losing the set is what makes
every regiment that referenced it stop resolving.

`parseSections` in `src/utils/schemaUtils.ts` is this shape, and is what every boundary parses
through; `Styles.parse` in `src/generators/styles.ts` is the same design for the style object. A
file is always repaired from the **defaults**, never from what is on screen: `Options.applyLoaded`
passes `getDefaultOptions().map`, so a section the file lacks cannot come back as the previous
map's value.

### What the schema constrains

A schema that only says `z.number()` catches a corrupt object and nothing else: a density step the
cell-count table has no entry for, an extent of zero, a rendering mode from a vocabulary that no
longer exists — each passes the boundary and fails later, wherever the value is finally used, with
nothing left to say where it came from.

So a leaf constrains **what would break the app**: a positive extent, a whole count, a step the
table has an entry for, one of a closed set of modes, a colour that is a colour. The shared leaf
types are in `src/utils/schemaUtils.ts` (`positive`, `count`, `percent`, `ratio`, `hexColor`,
`degrees`), so one bound is written once.

It constrains nothing beyond that. A bound the UI merely happens to impose is not a claim about the
value — a slider's `max` is a convenience, and turning it into validation lets a repair quietly
rewrite a number the user set on purpose. Where the vocabulary is open, such as a heightmap
template id or a unit the user may name themselves, the schema says so and stays a string.

A predicate that consults something outside the schema must survive that thing being absent: a
label group's `layerDependency` is checked against the layer registry, and an unloaded registry
accepts rather than throwing or dropping every group.

### Migrations

A migration describes a world that no longer exists, so it **carries its own copy of that world and
never leans on the live schema**. Renaming a field today must not change what an old file means.
Migrations run at the boundary, before validation, and produce a current-shaped object.

A `.map` file is a migration's job because the user cannot re-make it. This browser's stored
settings are not: they are one panel away, and a migration that carries them forward is code that
outlives the world it describes. So the two are migrated to different depths.

#### What `localStorage` carries forward, and what it does not

Before `fmg-options`, that world kept a `localStorage` key per thing: one named after each control
that showed a preference, one named after each definition set the user built, and — because
`lock(id)` wrote the pinned value _into_ `localStorage[id]` — the pin keys **were** the locks.
`adoptLegacyOptions` in `src/components/options-legacy.ts` is the whole of the migration out of it.

**The line is this: a value the user would re-set without noticing is dropped, a value they would
miss is adopted.**

Adopted, therefore: the preferences, because nothing in the UI puts them back — a theme colour or
an interface size is chosen once and never looked for again — and the definition sets, because a
military roster, a burg group or a label group is built by hand over a session and cannot be
re-made with a click.

Dropped, therefore: the pins. A pin is a claim about a value's shape as well as its name, and the
old keys carry neither — `template` held a heightmap id whose vocabulary has since changed,
`points` a raw cell count where a density step lives now, `cultures` a number the culture set caps.
Re-typing thirty-odd of those against the settings table to restore something one click re-makes is
a migration that would then have to be kept correct forever. Dropped too are `winds` and
`presetStyle`: both describe a map, and a browser-wide default for either is not a thing this app
keeps. They are still _named_ by the migration, so that the namespace goes entirely rather than
leaving keys behind that nothing will ever read again.

**The migration runs underneath the stored object, not after it.** It returns what the old keys
amount to in today's shape; `Options.restore` layers that between the defaults and this
browser's `fmg-options`, and validates the three together. That ordering is what makes the old
values safe to take: a definition set out of an old browser is untrusted like any other stored
object, and going through [validation](#validation) is what drops the one unrepairable entry.

---

## Adding a configuration value

1. **Apply [the test](#the-test).** Does anything other than a deliberate regeneration need it?
2. **Add the field to the section it belongs to** in `options-schema.ts`, in the group that matches
   what it configures — not the panel that shows it — and **its default to `getDefaultOptions`**,
   taking the value from the module that owns the concept if there is one. The type, persistence,
   validation and round-trip follow. A field added to `map` is in the `.map` file by that fact
   alone — `mapSchema` is the file format.
3. **Give it exactly one writer.** A request is written by its control. A map value is written by
   the generator, derivation or editor that produces it. Never both, and never one field twice.
4. **Write it from the dialog that shows it.** The control's handler writes the value, pins it with
   `Pins.set(key, value)` where a pin means anything, calls `Options.save()`, and runs whatever
   redraw the change asks for. Add the key to that dialog's own `pinnedValue` function so its lock
   icon can read it. A request or a map value gets a pin, a preference does not.
5. **If a new map should re-roll it**, add a line to `Options.randomize()`. If a new map should
   keep the user's own version, carry it across in `randomize` as the definition sets are.
6. **Read it directly** where it is used — reading never goes through a model.
7. **No migration is needed for a new field**: validation leaves it at its default for every
   existing browser and every existing file.

---

## Invariants

These are the properties the design exists to guarantee, and the ones worth asserting in tests:

- **Round trip.** Load a file, save it, load it again: the settings block is identical. Extend it
  across a corpus of real files from every supported version.
- **No cross-map inheritance.** Load map A, then map B: no value from A survives in `options.map`.
- **A file describes its map.** Every value in a saved file was written by something that actually
  ran. Changing a request without generating changes no file.
- **The app survives maps.** Loading any map leaves `options.app`, `options.generation` and the
  pins unchanged, save for the extent, which never overrides a pin.
- **The map survives a reload.** Anything needed to render or operate the map is in the file, so a
  fresh browser opens it identically.
- **Derivation is idempotent.** Re-deriving a derived value from a saved file reproduces the saved
  value.

## Gotchas

- **Never read `options` at module top level.** Modules evaluate before boot resolves stored
  values, so a top-level read captures a placeholder. Read inside the function that uses it.
- **A count is in the data, not in the configuration.** Ask the world how many states it has.
- **Two names beat one shared field.** When a request and a result feel like the same value, they
  are not — name them differently and let them diverge.
- **Extent is not viewport.** The extent is the coordinate space the map's geometry lives in, is
  fixed for the life of its graph, and is asked for — before the map exists — by
  `options.generation.graph`. The viewport is the screen window onto it: never part of the map,
  because it describes this browser, and a preference only once the user sets one by hand — `null`
  until then, meaning "follow the browser window". Either way the extent bounds it. They are two
  controls in two places, in two different sections of the panel, and a panel that shows one as the
  other is a bug.
- **A local named `options` shadows the global.** A function parameter or destructured local called
  `options` silently hides the configuration object; name it `config` instead.

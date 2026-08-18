# PRD — Layers Management

## Problem Statement

A map layer had no single definition anywhere in the codebase. Its identity was spread across five
places, none of them authoritative:

| Concern                     | Where it lived                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| On/off state                | `class="buttonoff"` on an `<li>`, read back via `layerIsOn()`           |
| Toggle behaviour            | ~25 near-identical `toggleX(event)` functions in `ui/layers.js`         |
| Button → SVG group          | the `getLayer()` if-chain                                              |
| Label, tip, shortcut        | 32 hand-written `<li>` blocks in `index.html` + a 32-branch `else if`   |
| Whether it is on after load | ~30 lines of per-layer DOM heuristics in `load.ts`                      |

Consequences:

- **The DOM was the source of truth.** `layerIsOn()` was called from ~341 sites and answered by
  reading a CSS class off a list item: state that belongs to the map lived in the options panel.
- **Order was implicit and duplicated three times**: the append order of `<g>` elements in
  `main.js`, the hand-written panel order in `index.html`, and the call order of `drawLayers()`.
  Nothing kept the three in agreement.
- **Adding a layer touched six files**, and a missing `getLayer()` entry broke reordering silently —
  which is why dragging the Markets layer used to do nothing.
- **Three hide mechanisms coexisted**: remove children, `display: none`, and jQuery `fadeIn`/`fadeOut`,
  so "is this layer on?" had no uniform answer.
- **Technical layers did not exist as a concept.** `ocean`, `landmass`, `coastline`, `fogging`,
  `debug` and `legend` occupy a slot in the z-order and are drawn, but having no button they were
  absent from every layer mechanism and hand-maintained in `main.js`.
- **Layer state was not saved.** It was _guessed_ on load by sniffing the restored SVG ("does
  `#statesBody` have children?"), which is why several layers restored wrong.

## Solution

One registry. Each layer is registered exactly once as a `Layer` value in a single list whose
**registration order is the z-order, the init order and the draw order**. The registry owns layer
state in memory and writes it to the DOM; nothing reads state back out of the DOM.

Five properties define the design:

1. **Layers are addressed by id.** `Layers.draw("heightmap", "lakes")` — `LayerId` is derived from
   the layer list, so a typo is a compile error rather than a silent no-op, and no consumer imports
   a renderer to name a layer. Untrusted strings — a dataset value, a stored preset, a map file —
   are narrowed with `Layers.has(id)`.
2. **The registry is purely structural.** It knows identity, order, the DOM node, and how to
   draw/erase. Buttons, labels and shortcuts live in the UI component. A toggleable layer and a
   technical layer are the same kind of object; the only difference is whether the UI table has an
   entry for it.
3. **One visibility mechanism.** A layer that is off has `display: none` on its group. Freeing its
   content is a per-layer optimisation, never the state carrier.
4. **State is data in the map file.** `data[50]` carries `{order, active}`; loading a map syncs the
   registry from it instead of sniffing the SVG.
5. **The DOM is written, never read.** The Layers tab is a projection rendered from the registry;
   the only DOM read in the system is the one-time legacy migration in `auto-update.ts`.

## User Stories

1. As a contributor adding a layer, I want to add one entry to one list, so that I don't have to
   touch `main.js`, `index.html`, `layers.js`, `hotkeys.ts` and `load.ts` to wire it up.
2. As a contributor, I want to name a layer by its id and have the id checked, so that referring to
   a layer that does not exist fails to compile.
3. As a contributor, I want `Layers.draw(a, b, c)` to render in z-order regardless of argument
   order, so that call sites do not encode ordering knowledge.
4. As a contributor, I want `Layers.drawAll()` to draw every active layer in z-order, so that map
   generation and map load have one entry point instead of a hand-maintained sequence.
5. As a contributor, I want a layer's element reached through `layer.getEl()`, so that renderers do
   not depend on bare global d3 selections.
6. As a maintainer, I want registration order to define z-order, so that the panel, the SVG and the
   draw sequence cannot drift apart.
7. As a maintainer, I want technical layers (ocean, landmass, coastline, fogging, debug, legend) in
   the same list as toggleable ones, so that the z-order is complete and readable in one place.
8. As a maintainer, I want the registry to create any missing layer group, so that a map saved by an
   older version gains new layers in their correct slot without a bespoke patch.
9. As a user, I want the layers I had enabled to be exactly the layers enabled when I reload my map,
   and my custom layer order preserved, so that state round-trips instead of being guessed.
10. As a user loading a pre-registry `.map` file, I want my layers restored as before, so that the
    change is invisible to me.
11. As a contributor, I want one uniform "off" representation, so that there is a single rule for
    whether a layer is showing.
12. As a UI developer, I want labels, markup and shortcuts in the Layers tab component, so that the
    registry has no UI vocabulary and markup like `Ro<u>u</u>tes` stays where it renders.
13. As a UI developer, I want the tab to re-render from a registry subscription, so that every state
    change — button, hotkey, preset, map load, drag — updates it through one path.
14. As a maintainer, I want reordering by drag to mutate the registry and re-project the SVG, so
    that dragging a layer can no longer silently do nothing.
15. As a maintainer, I want presets expressed as layer sets applied through the registry, so that
    preset handling stops clicking DOM elements to change state.
16. As a contributor to the heightmap editor, I want to snapshot and restore layer state with two
    calls, so that entering edit mode does not synthesize clicks on list items.
17. As a maintainer, I want all legacy `.map` compatibility contained in `auto-update.ts`, so that
    the rest of the system only knows the current format.
18. As a legacy `public/modules/**/*.js` module, I want `window.Layers`, so that untranslated code
    can read layer state during the JS→TS migration.
19. As a maintainer, I want the registry unit-tested against fake layers, so that ordering,
    activation, teardown and restore are guaranteed without a real map.

## Implementation Decisions

### Layer

A `Layer` is a value: an identity, an SVG group and how to render it. On/off state belongs to the
registry, so a layer needs no back-reference to it.

```ts
// src/components/layers.ts
interface LayerParams<Id extends string = string> {
  id: Id; // canonical identity, persisted in the .map file
  element?: string; // id of the svg group holding the content, defaults to the layer id
  parent: "viewbox" | "map"; // the svg element the group is appended to
  children?: ChildParams[]; // permanent elements created inside the group
  attrs?: Record<string, string>; // static attributes applied to the group (mask, font-size)
  permanent?: boolean; // structural layer: on from the start, never turned off by a preset
  keepContent?: boolean; // keep the content in the DOM when the layer is turned off
  draw?: (layer: Layer) => void;
  erase?: (layer: Layer) => void; // defaults to erasing the content down to the declared children
}

type ChildParams = {id: string; tag: string; attrs?: Record<string, string>};

class Layer<Id extends string = string> {
  readonly id: Id;
  readonly elementId: string; // params.element ?? params.id
  readonly parent: "viewbox" | "map";
  readonly children: ChildParams[];
  getEl(): SVGGElement;
}
```

Decisions:

- **`parent` is required, `element` is not.** Which SVG root a layer belongs to is a real decision;
  the element id defaults to the layer id and is spelled out only for the layers whose group still
  carries a legacy name (`terrs`, `relig`, `provs`, `prec`, `icons`, `armies`, `ruler`, …).
  `children`, `attrs`, `draw` and `erase` are optional because their absence means "none".
- **`getEl()` performs a live lookup.** Loading a `.map` replaces the whole `#map` subtree, so a
  cached node would go stale; `getElementById` is a hash lookup and not worth an invalidation rule.
  It throws rather than returning `null`: after `Layers.init()` a missing element is a bug, and
  callers should not be writing null checks.
- **`draw`/`erase` take the non-generic `Layer`**, so that `Layer<"ocean">` stays assignable to
  `Layer<LayerId>`; a `Layer<Id>` parameter would make the callback contravariant.
- **`draw` receives its own layer**, so a renderer never imports the layer constant it belongs to.
- **Skeleton vs content.** `children` declares permanent sub-elements — the route groups, the state
  body and halo, the compass `<use>`. Anything else is content produced by the renderer and is not
  the registry's business.
- **`draw` is idempotent.** The registry redraws an active layer whenever anything upstream changes
  (a style preset calls `drawAll`), so a renderer replaces its content rather than appending to it.

### Registry

The registry and the layer list share one file: `LayerId` is derived from the list, so splitting
them would mean the registry could not name its own ids.

```ts
class LayersRegistry<Id extends string = string> {
  constructor(private layers: Layer<Id>[]); // membership is fixed at construction; Id is inferred
  init(): void; // create missing groups, order them by registration order, apply the current state

  get all(): readonly Layer<Id>[];
  has(id: string): id is Id; // narrow an untrusted string: dataset, stored preset, map file
  get(id: Id): Layer<Id>; // throws: after init a missing layer is a bug, not a null check
  isOn(id: Id): boolean;

  show(...ids: Id[]): void; // turn on the layers that are off and draw them
  hide(...ids: Id[]): void; // turn off the layers that are on and erase them
  toggle(id: Id): void;
  set(ids: readonly string[]): void; // turn on the listed layers, turn off every other user layer

  draw(...ids: Id[]): void; // draw the listed layers that are ON, always in layer order
  drawAll(): void;
  eraseAll(): void; // drop the content of every viewbox layer, on or off (map teardown)
  move(id: Id, before?: Id): void;

  get state(): LayersState; // {order, active}
  restore(state: LayersState): void; // adopt persisted state; never draws
  subscribe(listener: () => void): () => void;
}

interface LayersState {
  order: string[];
  active: string[];
}

export const Layers = new LayersRegistry(mapLayers);
export type LayerId = (typeof mapLayers)[number]["id"];
window.Layers = Layers; // legacy seam for public/modules/**/*.js
```

Decisions:

- **Iteration is always over the layer list**, so registration order governs `draw`, `set` and every
  visibility change regardless of the order arguments are passed. Argument order is unobservable.
- **`LayerId` is derived, not written.** A hand-written union would be exactly the parallel list this
  design exists to remove.
- **Strict ids everywhere except the two storage seams.** `show`/`hide`/`draw`/`toggle`/`isOn`/`move`
  take `LayerId`; `set` and `restore` take plain strings, because their input is a stored preset or a
  map file. Everything else narrows through `has(id)` first.
- **The registry owns the active set**, so `Layer` stays a pure value.
- **`init()` adopts an existing element.** One code path initialises a fresh map (creates the group),
  reorders an existing one (re-appends), and heals a map loaded from an older version (creates only
  what is missing). There is no separate "upgrade the SVG skeleton" step: `move` and `restore` call
  `init()` again.
- **Visibility is `element.style.display`**, and the `style` attribute is dropped when it carries
  nothing else, so hidden layers do not litter the saved SVG.
- **Teardown is a three-way rule.** A layer with `erase` runs it; a layer with `keepContent` keeps
  its content; every other layer has its content dropped down to the declared children. `eraseAll`
  ignores all of that and clears every viewbox layer — it exists for map teardown, where the content
  of the previous map must not survive.
- **`permanent` is the only exemption from `set`.** A preset lists the layers the user toggles; a
  layer the map itself drives — `fogging` follows the state focus — must survive a preset change, so
  its renderer, not its visibility, carries the state.
- **`restore` ranks rather than sorts by index**, tolerating both directions of version skew: ids in
  the file this build does not know are ignored, and layers this build has that the file lacks slot
  in right after their registration-order predecessor via a fractional rank.
- **`restore` never draws.** It runs after the loaded SVG is already in the document, so the content
  is present; drawing would only redo it.
- **`move` mutates the array, then re-projects.** The registry is the order; the SVG follows.
- **Subscribers are notified once per operation.** Batch operations mutate silently and emit at the
  end.

### The layer list

One ordered array in the same file, from `ocean` at the bottom to `legend` on top. It is the only
place the SVG skeleton is described, replacing the `viewbox.append("g")` block in `public/main.js`.
`Layers.init()` runs from the main routine before anything selects those groups.

Nothing else is exported from the list: with ids as the vocabulary, per-layer constants would be a
second way to say the same thing.

### Renderers

A classic renderer becomes two plain functions — `drawX(layer)` and, where teardown is special,
`removeX(layer)` — and loses its toggle wrapper entirely: toggling belongs to the registry, style
editing to the tab, sub-group bootstrapping to `children`. The internal "am I on?" checks
(`layerIsOn("toggleRelief")`) become `Layers.isOn("relief")` — the same question asked of real state
instead of a CSS class.

`ViewportRenderer` is orthogonal and unchanged: viewport layers register with both, and the tab
re-renders them on any registry change.

### Layers tab

`src/components/layers-tab.ts` is the _only_ place that knows a layer has a button. `LAYER_TOGGLES`
maps `LayerId` to `{label, shortcut, hint}`; rendering iterates `Layers.all`, so the registry stays
authoritative for order and a layer without an entry simply has no button.

- The tab renders from a `Layers.subscribe` callback, so button state, hotkeys, presets, drag and
  map load all reach the UI through one path.
- `<li>` items carry `data-layer`; one delegated click handler toggles the layer, and a ctrl+click
  opens the style editor for `layer.elementId`.
- Layers outside the viewbox get the `solid` class and are excluded from drag reordering; a drag
  calls `Layers.move(id, before)`.
- Hotkeys resolve through `getLayerByShortcut(code)` against the same table, so a shortcut is
  declared once. This replaces 32 `else if` branches and the entire `<li>` block in `index.html`.
- Two more subscribers replace the cross-calls previously buried in `turnButtonOn`/`turnButtonOff`:
  the viewport renderer re-renders, and the 3D view refreshes its texture once the batch settles.

### Presets

`src/components/layers-presets.ts` keeps presets as arrays of layer ids in localStorage; only the
application path changed. A stored preset is loaded only if every id in it is a layer this build has
(`Layers.has`); one naming an unknown id is dropped, and the user recreates it — presets are cheap to
rebuild and not worth a migration path. Stored presets from before the change hold `toggle*` ids, so
they fail that check.

- Choosing a preset calls `Layers.set(ids)`.
- Applying the preset on map generation uses `Layers.restore({order, active})`, because generation
  draws the layers immediately afterwards and drawing twice would be wasted work.
- The current preset is highlighted from a subscription: the active toggleable set is compared
  against each preset, and "custom" wins when nothing matches.

### Persistence and migration

`data[50]` holds `JSON.stringify(Layers.state)`; `load.ts` calls `Layers.restore(JSON.parse(...))`
after `resolveVersionConflicts`, so the loader knows exactly one format. `state.active` excludes
permanent layers — they are structural, not user state.

All legacy compatibility lives in `src/services/io/auto-update.ts`. The `isOlderThan("1.144.0")`
block fills `data[50]` in for older files by reading the restored SVG once — the last DOM read in the
system — and in the same pass unwraps `#fogging-cont`, gives the compass rose the id the registry
looks up, normalises legacy `display` presentation attributes, and rewrites `toggle*` ids in label
groups' `layerDependency` to canonical layer ids.

### Consumers

Long `layerIsOn` chains collapse into a single ordered call, e.g. in `tools.ts`:

```ts
Layers.draw("routes", "rivers", "population", "goods", "states", "borders", "provinces", "burgIcons", "military");
```

Direct renderer imports go the same way: a controller that called `drawLabels()` now calls
`Layers.draw("labels")`, which additionally skips the work when the layer is off and keeps z-order.
Renderers still export non-lifecycle operations (`redrawLabel`, `getVisibleLabels`) — those are label
operations, not layer lifecycle, and forcing them through the registry would give `Layer` a per-layer
method grab-bag.

`drawLayers()` became `Layers.drawAll()`, `undraw()` became `Layers.eraseAll()`, and the heightmap
editor snapshots and restores state instead of synthesising clicks:

```ts
storedLayers = Layers.state.active; // on enter
Layers.set([]);
// …
Layers.set(storedLayers); // on exit — set takes plain strings and ignores ids it does not know
```

Untranslated `public/modules/**/*.js` reads state through `window.Layers`; the DOM-sniffing
`layerIsOn` is gone.

## Testing Decisions

- **What makes a good test here:** assert external behaviour of the registry against fake layers —
  what ends up active, in what order the SVG groups sit, which `draw`/`erase` callbacks ran. Do not
  assert on private fields or listener call counts.
- **Module under test:** `LayersRegistry` and `Layer` (`src/components/layers.test.ts`). The class is
  exported so the test builds its own instance over fake layers instead of resetting the singleton's
  module; the real layer list is configuration, and renderers keep their own tests. The test builds
  its own `#map`/`#viewbox` fixture and needs no `pack`/`grid`.
- **Representative cases:** `init` creates, adopts, orders and applies visibility; `show`/`hide` draw
  and erase exactly once and are no-ops when already in the requested state; `draw(b, a)` runs
  callbacks in registration order and skips inactive layers; `erase` respects declared children,
  `keepContent` and custom `erase`, while `eraseAll` clears every viewbox layer regardless; `set`
  preserves permanent layers and ignores unknown ids; `move` reorders array and SVG together;
  `restore` applies order and state without drawing, handles unknown and missing ids, and round-trips
  `state`; `subscribe` emits once per operation and stops after unsubscribing.
- **E2E:** `tests/e2e/` covers what unit tests cannot — `layers.spec.ts` (per-layer DOM snapshots),
  `layer-content.spec.ts` (content after hide/show), `layer-teardown.spec.ts` (user data and edited
  styles survive teardown), `layer-scenarios.spec.ts` (presets, regeneration, reordering, export),
  and `layers-round-trip.spec.ts` (active set and custom order survive save and load — the behaviour
  `data[50]` exists for).

## Out of Scope

- **Renaming SVG layer elements to match their ids.** Desirable — `terrs`, `relig`, `provs`, `prec`
  are poor ids for public DOM nodes — but it drags in style presets (`data[48]`), localStorage
  presets, `style-presets.js`, `export.ts`, CSS and ~500 `#id` selector usages. Because `data[50]`
  stores canonical layer ids, that pass will be DOM-only with no second file-format migration, and
  its rename table is derivable from the registry.
- **Removing the remaining bare global d3 selections** (`terrs`, `regions`, `labels`, …) in favour of
  `select(layer.getEl())`. New code uses `getEl()`; the sweep follows the rename.
- **Renaming sub-group ids** (`landHeights`, `statesBody`, `goodsIcons`, `searoutes`).
- **Rewriting `public/modules/ui/style.js`**, beyond adding `goods` and `icons` to its section lists.
- **Changing `ViewportRenderer`.** Viewport layers register with both, and that is correct.
- **Redesigning the presets UI or the preset format.**

## Further Notes

- **Import cycles are the main structural risk.** `layers.ts` holds both the registry and the layer
  list, so it imports every renderer while renderers import `Layers` back to query state. The cycle
  is safe under one invariant: _no renderer touches `Layers` while its module is evaluating_ — every
  use sits inside a function, where ESM live bindings have already resolved. A top-level
  `const x = Layers.get(…)` in a renderer would hit the TDZ. Renderers also receive their layer as
  the `draw`/`erase` argument, so `getEl()` needs no lookup at all. Non-renderer consumers
  (`tools.ts`, `map-tooltip.ts`, `hotkeys.ts`, editors) are unconstrained, since nothing imports them
  back.
- **Behavioural change:** jQuery `fadeIn`/`fadeOut` on layer toggle is removed — layers appear and
  disappear immediately. The d3 transitions precipitation and population play while _drawing_ are
  unaffected, being part of their `draw`; their removal animations are gone, because `display: none`
  is written before `erase` runs. One visibility mechanism costs the fade-out; that is the trade.
- **Style targets.** Ctrl+click opens `layer.elementId`, so the two layers whose style target differs
  from their element — goods (`goodsIcons`) and burg icons (`burgIcons`) — need `goods` and `icons`
  in the section lists in `public/modules/ui/style.js`. That is a fix on the style side, not a
  special case in the registry.
- **`#fogging-cont` is unwrapped** so that every layer's toggled node is its own root. The unwrapped
  `#fogging` is a permanent layer whose renderer projects the `#fog` mask: two rects while an area is
  revealed, empty otherwise. `fog`/`unfog` edit the mask and call `Layers.draw("fogging")`; nothing
  shows or hides the group.
- **Why a registry rather than a base class.** `draw`/`erase` is the entire contract, and the two
  renderer families (eager and viewport) satisfy it differently without sharing implementation. A
  class hierarchy would add a vocabulary without removing a decision.

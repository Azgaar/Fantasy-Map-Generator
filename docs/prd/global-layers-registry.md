# PRD: Global Layers Registry

## Problem Statement

A map layer has no single definition anywhere in the codebase. Its identity is spread across five
places, none of which is authoritative:

| Concern                     | Where it lives today                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| On/off state                | `class="buttonoff"` on an `<li>`, read back via `layerIsOn()` (`public/modules/ui/layers.js:993`)                |
| Toggle behaviour            | ~25 near-identical `toggleX(event)` functions (`public/modules/ui/layers.js:264-983`)                            |
| Button → SVG group          | the `getLayer()` if-chain (`public/modules/ui/layers.js:1021`)                                                   |
| Label, tip, shortcut        | 32 hand-written `<li>` blocks (`src/index.html:437`) plus a 32-branch `else if` (`src/components/hotkeys.ts:75`) |
| Whether it is on after load | 30 lines of per-layer DOM heuristics (`src/services/io/load.ts:504`)                                             |

Consequences:

- **The DOM is the source of truth.** `layerIsOn()` is called from ~341 sites and answers by reading a
  CSS class off a list item. State that belongs to the map is stored in the options panel.
- **Order is implicit and duplicated.** Z-order is the order of `<g>` elements appended in
  `public/main.js:36-90`; the panel repeats that order by hand in `src/index.html`; `drawLayers()`
  repeats it a third time as call order. Nothing enforces that the three agree.
- **Adding a layer touches six files** and is easy to get subtly wrong (a missing `getLayer()` entry
  silently breaks reordering — that is why reordering the Markets layer does nothing today).
- **Three different hide mechanisms coexist**: remove children, `display: none`, and jQuery
  `fadeIn`/`fadeOut`, so "is this layer on?" has no uniform answer and the load-time heuristics have
  to encode a different rule per layer.
- **Technical layers do not exist as a concept.** `ocean`, `landmass`, `coastline`, `fogging`,
  `debug` and `legend` are layers by every structural measure — they occupy a slot in the z-order and
  are drawn — but because they have no button they are absent from every layer mechanism and are
  hand-maintained in `main.js`.
- **Layer state is not saved.** It is _guessed_ on load by sniffing the restored SVG ("does
  `#statesBody` have children?"), which is both fragile and the reason several layers restore wrong.

## Solution

One registry. Each layer is registered exactly once as a `Layer` value, in a single list file whose
**registration order is the z-order, the initialization order and the draw order**. The registry owns
layer state in memory and writes it to the DOM; nothing reads state back out of the DOM.

Five properties define the design:

1. **Layers are addressed by id.** `Layers.draw("heightmap", "lakes")` — `LayerId` is derived from the
   layer list, so a typo is a compile error rather than a silent no-op, and no consumer imports a layer
   to name one. `Layers` is the whole public interface; renderers stop leaking into their callers.
   Untrusted strings — a dataset value, a stored preset, a map file — are narrowed with `Layers.has(id)`.
2. **The registry is purely structural.** It knows identity, order, the DOM node, and how to
   draw/erase. It knows nothing about buttons, labels or shortcuts — those live in the UI component.
   A layer with a button and a technical layer are the same kind of object; the only difference is
   whether the UI table has an entry for it.
3. **One visibility mechanism.** A layer that is off has `display: none` on its group. Freeing its
   content is an optional, per-layer optimisation (`erase`), never the state carrier.
4. **State is data in the map file.** `data[50]` carries `{order, active}`. Loading a map syncs the
   registry from that list instead of sniffing the SVG.
5. **The DOM is written, never read.** The Layers tab is a projection rendered from the registry; the
   only DOM read in the system is the one-time legacy migration in `auto-update.ts`.

## User Stories

1. As a contributor adding a layer, I want to add one entry to one list, so that I don't have to
   touch `main.js`, `index.html`, `layers.js`, `hotkeys.ts` and `load.ts` to wire it up.
2. As a contributor, I want to name a layer by its id and have the id checked, so that referring to a
   layer that doesn't exist fails to compile without importing anything but `Layers`.
3. As a contributor, I want `Layers.draw(a, b, c)` to render in the correct order regardless of the
   order I pass arguments, so that call sites don't encode ordering knowledge.
4. As a contributor, I want `Layers.drawAll()` to draw every active layer in z-order, so that map
   generation has one entry point instead of a hand-maintained sequence.
5. As a contributor, I want a layer's element accessed via `layer.getEl()`, so that renderers never
   depend on a bare global d3 selection.
6. As a maintainer, I want registration order to define z-order, so that the panel, the SVG and the
   draw sequence cannot drift apart.
7. As a maintainer, I want technical layers (ocean, landmass, coastline, fogging, debug, legend) in
   the same list as toggleable ones, so that the z-order is complete and readable in one place.
8. As a maintainer, I want the registry to create any missing layer group, so that a map saved by an
   older version gains new layers in their correct slot without a bespoke patch.
9. As a user, I want the layers I had enabled to be exactly the layers enabled when I reload my map,
   so that saved state round-trips instead of being guessed.
10. As a user, I want my custom layer order preserved across save and load.
11. As a user loading a pre-registry `.map` file, I want my layers restored as before, so that the
    change is invisible to me.
12. As a contributor, I want layer state to be `Set`-like data in memory, so that reading it never
    depends on the options panel being rendered.
13. As a contributor, I want one uniform "off" representation (`display: none`), so that there is a
    single rule for whether a layer is showing.
14. As a UI developer, I want labels, markup and shortcuts in the Layers tab component, so that the
    registry has no UI vocabulary and label markup like `Ro<u>u</u>tes` stays where it renders.
15. As a UI developer, I want the tab to re-render from a registry subscription, so that any state
    change — button, hotkey, preset, map load — updates it through one path.
16. As a contributor, I want ctrl+click style editing derived from the layer's element, so that it is
    not a per-layer special case.
17. As a maintainer, I want reordering by drag to mutate the registry and re-project the SVG, so that
    dragging a layer with no `getLayer()` entry can no longer silently do nothing.
18. As a maintainer, I want all legacy `.map` compatibility contained in `auto-update.ts`, so that the
    rest of the system only knows the current format.
19. As a maintainer, I want presets expressed as layer sets applied through the registry, so that
    preset handling stops clicking DOM elements to change state.
20. As a contributor to the heightmap editor, I want to snapshot and restore layer state with two
    calls, so that entering edit mode does not synthesize clicks on list items.
21. As a legacy `public/modules/**/*.js` module, I want `window.Layers`, so that untranslated code can
    read layer state during the JS→TS migration.
22. As a maintainer, I want the registry unit-tested against fake layers, so that ordering,
    activation and restore are guaranteed without a real map.

## Implementation Decisions

### Layer

A `Layer` is a value: an identity, an svg group and how to render it. On/off state belongs to the
registry, so a layer needs no back-reference to it.

```ts
// src/renderers/layers/layers.ts
export interface LayerParams<Id extends string = string> {
  id: Id; // canonical identity, persisted in the .map file
  element: string; // svg group id (currently legacy names, see Out of Scope)
  parent: "viewbox" | "map";
  children?: string[]; // sub-groups created inside the layer and preserved when the content is erased
  attrs?: Record<string, string>; // static attributes (mask, font-size)
  permanent?: boolean; // structural layer: on from the start, never turned off by a preset
  keepContent?: boolean; // keep the content in the DOM when the layer is turned off
  draw?: (layer: Layer) => void;
  erase?: (layer: Layer) => void; // defaults to erasing the content down to the declared children
}

export class Layer<Id extends string = string> {
  readonly id: Id;
  readonly elementId: string;

  constructor(readonly params: LayerParams<Id>) {
    this.id = params.id;
    this.elementId = params.element;
  }

  getEl(): SVGGElement {
    return ensureEl<SVGGElement>(this.elementId);
  }
}
```

Decisions:

- **`element` and `parent` are required.** Both are real decisions; defaulting them hides
  information at the point where a reader most wants it. `children`, `attrs`, `draw` and `erase` are
  optional because their absence means "none", not "take a default".
- **`getEl()` performs a live lookup.** Loading a `.map` replaces the whole `#map` subtree, so a
  cached node would go stale; `getElementById` is a hash lookup and not worth an invalidation rule.
  It throws rather than returning `null`: after `Layers.init()` a missing element is a bug, and
  callers should not be writing null checks.
- **`draw`/`erase` take the non-generic `Layer`**, so that `Layer<"ocean">` stays assignable to
  `Layer<LayerId>`; a `Layer<Id>` parameter would make the callback contravariant and break `register`.
- **The skeleton work lives in `Layers.init()`, not `Layer.create()`.** Creating, adopting, ordering
  and projecting visibility are all registry-order concerns, and keeping them there leaves `Layer` with
  no methods but `getEl()`.
- **`init()` adopts an existing element.** The same code path initialises a fresh map (creates the
  group), reorders an existing one (re-appends), and heals a map loaded from an older version
  (creates only what is missing). No separate "upgrade the SVG skeleton" step exists, and `move` and
  `restore` simply call `init()` again.
- **Skeleton vs content.** `children` creates empty `<g>` sub-groups only. Anything with shape —
  `#scaleBarBack`, the vignette rect, the compass `<use>` — is content produced by the renderer or
  already present in `src/index.html`, and is not the registry's business.
- **`draw` receives its own layer**, so a renderer never needs to import the layer constant it
  belongs to (see _Import cycles_ under Further Notes).
- **No layer gets a bespoke `draw` closure.** Emblems and ice keep their content when off
  (`keepContent`) and used to pair that with a "draw only if the group is empty" guard. The guard was a
  micro-optimisation, not semantics — coat-of-arms rendering is memoised in `<defs>` by
  `COArenderer.trigger`, and `drawIce` is a deterministic rebuild from `pack.ice` — so both are now
  plain `draw: drawX` references and `keepContent` carries the only real difference.

### Registry

The registry and the layer list share one file: `LayerId` is derived from the list, so splitting them
would mean the registry could not name its own ids.

```ts
// src/renderers/layers/layers.ts — same file as the list below
export class LayersRegistry<Id extends string = string> {
  private active = new Set<Id>();
  private listeners = new Set<() => void>();

  constructor(private layers: Layer<Id>[]);
  init(): void; // creates missing groups, orders them by registration order, applies the current state

  get all(): readonly Layer<Id>[];

  /** narrow an untrusted string — dataset, stored preset, map file — to a known id */
  has(id: string): id is Id;
  get(id: Id): Layer<Id>; // throws: after init a missing layer is a bug, not a null check
  isOn(id: Id): boolean;

  /** turn the layers on if they are off and (re)draw them */
  show(...ids: Id[]): void;
  hide(...ids: Id[]): void;
  toggle(id: Id): void;

  /** turn on the listed layers and turn off every other user-controlled one, drawing the ones that were off.
   *  Takes plain strings and ignores the ones it does not know: the list comes from presets and snapshots */
  set(ids: readonly string[]): void;

  draw(...ids: Id[]): void; // draws the listed layers that are on, always in layer order
  drawAll(): void;
  move(id: Id, before?: Id): void;

  get state(): LayersState; // {order, active} — permanent layers are structural, not saved state
  restore(state: LayersState): void; // adopts persisted state: never draws, the loaded svg holds the content
  subscribe(listener: () => void): () => void;
}

export interface LayersState {
  order: string[];
  active: string[];
}

declare global {
  var Layers: LayersRegistry<LayerId>;
}

export const Layers = new LayersRegistry(mapLayers); // Id is inferred from the list
window.Layers = Layers; // legacy seam for public/modules/**/*.js
```

Decisions:

- **Iteration is always over `this.layers`**, so registration order governs `draw`, `set` and
  `change` regardless of the order arguments are passed. Argument order is unobservable.
- **`LayerId` is derived, not written.** `type LayerId = (typeof mapLayers)[number]["id"]`, which needs
  `Layer<Id extends string>` so that `new Layer({id: "labels", …})` infers the literal. A hand-written
  union would be exactly the parallel list this PRD exists to remove.
- **Strict ids everywhere except the two storage seams.** `show`/`hide`/`draw`/`toggle`/`isOn`/`move`
  take `LayerId`; `set` and `restore` take plain strings because their input is a stored preset or
  a map file. Everything else narrows through `has(id)` first.
- **The registry owns the active set**, so `Layer` is a pure value and needs no back-reference to the
  registry to answer `isOn`.
- **Layers are passed to the constructor, not registered.** Membership is then fixed, `Id` is inferred
  from the list rather than written out, and the public API loses a method whose only caller lived in
  the same file.
- **`restore` never draws.** A loaded map's SVG already contains the rendered content; redrawing it
  would be both slow and wrong (it would regenerate data the file already carries). This is the one
  hard behavioural distinction in the API and is why `restore` and `set` are separate methods.
- **`sortBy` tolerates both directions of version skew**: ids in the file that this build doesn't
  know are ignored; layers this build has that the file lacks slot in after their registration-order
  predecessor via a fractional rank.
- **`move` mutates the array, then re-projects.** The registry is the order; the SVG follows.
- **Subscribers are notified once per operation.** Batch operations (`set`, `restore`) mutate
  silently and emit at the end.

### The layer list

One array in the same file, ordered. `LayerId` falls out of it, and `Layers.init()` is called from the
main routine (`public/main.js`), right before the legacy globals select the groups it creates.

```ts
// src/renderers/layers/layers.ts — this order is z-order, init order and draw order
const mapLayers = [
  new Layer({
    id: "ocean",
    element: "ocean",
    parent: "viewbox",
    children: ["oceanLayers", "oceanPattern"],
    permanent: true,
    keepContent: true
  }),

  new Layer({
    id: "landmass",
    element: "landmass",
    parent: "viewbox",
    permanent: true,
    keepContent: true,
    draw: drawFeatures
  }),

  new Layer({ id: "texture", element: "texture", parent: "viewbox", draw: drawTexture }),

  // …one entry per layer, technical and toggleable alike

  new Layer({ id: "fogging", element: "fogging", parent: "viewbox", attrs: { mask: "url(#fog)" }, keepContent: true }),

  new Layer({
    id: "scaleBar",
    element: "scaleBar",
    parent: "map",
    keepContent: true,
    draw: layer => drawScaleBar(select(layer.getEl()), scale)
  }),

  new Layer({
    id: "vignette",
    element: "vignette",
    parent: "map",
    attrs: { mask: "url(#vignette-mask)" },
    keepContent: true
  }),

  new Layer({ id: "legend", element: "legend", parent: "map", permanent: true, keepContent: true })
];

export type LayerId = (typeof mapLayers)[number]["id"];
```

Nothing else is exported from the list: with ids as the vocabulary, per-layer constants would only be
a second way to say the same thing.

This replaces the 55-line `viewbox.append("g")` block in `public/main.js:36-90`.

### Layer inventory

In registration order. "Button" marks layers that appear in the Layers tab; the rest are technical.

| id            | element          | parent  | button | erase strategy          |
| ------------- | ---------------- | ------- | ------ | ----------------------- |
| ocean         | `ocean`          | viewbox | —      | —                       |
| landmass      | `landmass`       | viewbox | —      | —                       |
| texture       | `texture`        | viewbox | yes    | remove `image`          |
| heightmap     | `terrs`          | viewbox | yes    | clear height sub-groups |
| lakes         | `lakes`          | viewbox | yes    | keep content            |
| biomes        | `biomes`         | viewbox | yes    | remove paths            |
| cells         | `cells`          | viewbox | yes    | remove paths            |
| grid          | `gridOverlay`    | viewbox | yes    | clear                   |
| coordinates   | `coordinates`    | viewbox | yes    | clear                   |
| compass       | `compass`        | viewbox | yes    | keep content            |
| rivers        | `rivers`         | viewbox | yes    | clear                   |
| relief        | `terrain`        | viewbox | yes    | invalidate scene        |
| religions     | `relig`          | viewbox | yes    | remove paths            |
| cultures      | `cults`          | viewbox | yes    | remove paths            |
| states        | `regions`        | viewbox | yes    | remove paths            |
| provinces     | `provs`          | viewbox | yes    | clear                   |
| zones         | `zones`          | viewbox | yes    | clear                   |
| borders       | `borders`        | viewbox | yes    | remove paths            |
| routes        | `routes`         | viewbox | yes    | remove paths            |
| temperature   | `temperature`    | viewbox | yes    | clear                   |
| coastline     | `coastline`      | viewbox | —      | —                       |
| ice           | `ice`            | viewbox | yes    | keep content            |
| goods         | `goods`          | viewbox | yes    | clear sub-groups        |
| markets       | `markets`        | viewbox | yes    | clear                   |
| trade         | `tradeAnimation` | viewbox | yes    | `TradeAnimation.stop()` |
| precipitation | `prec`           | viewbox | yes    | remove circles          |
| population    | `population`     | viewbox | yes    | clear sub-groups        |
| emblems       | `emblems`        | viewbox | yes    | keep content            |
| burgIcons     | `icons`          | viewbox | yes    | remove `circle, use`    |
| labels        | `labels`         | viewbox | yes    | invalidate scene        |
| military      | `armies`         | viewbox | yes    | remove groups           |
| markers       | `markers`        | viewbox | yes    | clear                   |
| fogging       | `fogging`        | viewbox | —      | —                       |
| rulers        | `ruler`          | viewbox | yes    | clear                   |
| debug         | `debug`          | viewbox | —      | —                       |
| scaleBar      | `scaleBar`       | map     | yes    | keep content            |
| vignette      | `vignette`       | map     | yes    | keep content            |
| legend        | `legend`         | map     | —      | —                       |

`landmass` and `coastline` are both filled by `drawFeatures`; only `landmass` carries the `draw` to
avoid running it twice. Splitting `drawFeatures` is out of scope.

### Renderers

A classic renderer becomes two plain functions and loses its toggle wrapper entirely:

```ts
// src/renderers/draw-goods.ts
export function drawGoods(layer: Layer): void {
  TIME && console.time("drawGoods");
  const goods = select(layer.getEl());
  const visible = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  goods.select("#goodsCells").html(buildGoodsCellsContent(visible));
  goods.select("#goodsIcons").html(buildGoodsIconsContent(visible));
  goods.select("#goodsBurgs").html(buildGoodsBurgsContent(visible));
  TIME && console.timeEnd("drawGoods");
}

export function eraseGoods(layer: Layer): void {
  SUBGROUPS.forEach(id => void select(layer.getEl()).select(`#${id}`).html(""));
}
```

`toggleGoods`, its ctrl+click branch, its `turnButtonOn/Off` calls and its sub-group bootstrapping all
disappear: toggling belongs to the registry, style editing to the tab, sub-groups to `children`.

A viewport renderer is unchanged in structure — `ViewportLayers` stays exactly as it is today and is
orthogonal to this registry:

```ts
// src/renderers/draw-relief-icons.ts
const scene = new Scene<ReliefSceneIcon>();
const viewportLayer = ViewportLayers.register({ id: "relief", render: reconcileRelief });

export function drawRelief(): void {
  if (!pack.relief?.length) Relief.generate();
  scene.replace(pack.relief.map((data, i) => ({ id: String(i), data })));
  viewportLayer.render();
}

export function eraseRelief(): void {
  scene.invalidate();
}

function reconcileRelief(context: ViewportRenderContext): void {
  const terrain = context.root.querySelector("#terrain");
  if (!terrain) return;
  if (!scene.valid || !Layers.isOn("relief")) return void terrain.replaceChildren();
  // …unchanged
}
```

The internal "am I on?" checks that every viewport renderer performs today (`layerIsOn("toggleRelief")`)
become `Layers.isOn("relief")` — the same check against real state instead of a CSS class.

### Layers tab

The UI table is the _only_ place that knows a layer has a button. Keyed by `LayerId` so it stays
typo-proof; iterating `Layers.all` keeps the registry authoritative for order.

```ts
// src/components/layers-tab.ts
interface LayerButton {
  label: string; // may contain markup: "Ro<u>u</u>tes"
  shortcut?: string; // KeyboardEvent.code
  hint?: string; // shortcut as shown in the tip, defaults to code without the "Key" prefix
}

export const BUTTONS = new Map<LayerId, LayerButton>([
  ["texture", { label: "Te<u>x</u>ture", shortcut: "KeyX" }],
  ["heightmap", { label: "<u>H</u>eightmap", shortcut: "KeyH" }],
  ["lakes", { label: "Lakes", shortcut: "KeyQ" }],
  ["grid", { label: "Grid", shortcut: "Semicolon", hint: "; (semicolon)" }],
  ["routes", { label: "Ro<u>u</u>tes", shortcut: "KeyU" }],
  ["markets", { label: "Markets" }]
  // …one row per button; ocean, landmass, coastline, fogging, debug, legend are absent
]);

export function initLayersTab(): void {
  const list = ensureEl("mapLayers");
  render();
  Layers.subscribe(render);

  list.on("click", event => {
    const id = (event.target as HTMLElement).closest("li")?.dataset.layer;
    if (!id || !Layers.has(id)) return;
    if (isCtrlClick(event)) return editStyle(Layers.get(id).elementId);
    Layers.toggle(id);
  });

  $(list).sortable({
    items: "li",
    containment: "parent",
    update: (_, ui) => {
      const id = ui.item.data("layer");
      const before = ui.item.next().data("layer");
      if (Layers.has(id)) Layers.move(id, Layers.has(before) ? before : undefined);
    }
  });

  function render(): void {
    list.replaceChildren(
      ...Layers.all.flatMap(layer => {
        const button = BUTTONS.get(layer.id);
        if (!button) return [];
        const item = document.createElement("li");
        item.dataset.layer = layer.id;
        item.dataset.tip = "Click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style";
        if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
        item.innerHTML = button.label;
        item.classList.toggle("buttonoff", !Layers.isOn(layer.id));
        return [item];
      })
    );
  }
}
```

Other subscribers replace the cross-calls currently buried in `turnButtonOn`/`turnButtonOff`:

```ts
Layers.subscribe(() => ViewportLayers.renderNow());
Layers.subscribe(highlightMatchingPreset);
Layers.subscribe(() => findEl("canvas3d") && Controllers.View3d.update());
```

Hotkeys read the same table, so a shortcut is declared once:

```ts
// src/components/hotkeys.ts
const id = [...BUTTONS].find(([, button]) => button.shortcut === code)?.[0];
if (id) return Layers.toggle(id);
```

This deletes 32 `else if` branches and the entire `<li>` block in `src/index.html`.

### Presets

Presets stay arrays of layer ids in localStorage; only the application path changes.

```ts
export function applyPreset(name: string): void {
  Layers.set(presets[name]);
}

const currentPreset = (): string | undefined =>
  Object.keys(presets).find(name => sameSet(presets[name], Layers.state.active));
```

Stored presets from before the change hold `toggle*` ids; they are remapped once on read with the
same table the map migration uses (see below) and re-saved with canonical ids.

### Persistence

`data[50]` is the next free slot in `src/services/io/save.ts:148`:

```ts
// save.ts
const layers = JSON.stringify(Layers.state); // {order: string[], active: string[]}
```

```ts
// load.ts — replaces the 30-line heuristic block at load.ts:504
restoreLayers(mapVersion, data);
```

### Migration

All legacy compatibility lives in `src/services/io/auto-update.ts` and nowhere else.

```ts
// auto-update.ts
/** layer id -> pre-1.144 button id, as stored in saved presets */
export const LEGACY_LAYER_IDS: Record<string, string> = {
  heightmap: "toggleHeight",
  grid: "toggleGrid",
  relief: "toggleRelief",
  religions: "toggleReligions",
  cultures: "toggleCultures",
  states: "toggleStates",
  provinces: "toggleProvinces",
  precipitation: "togglePrecipitation",
  burgIcons: "toggleBurgIcons",
  military: "toggleMilitary",
  rulers: "toggleRulers",
  trade: "toggleTrade",
  markets: "toggleMarketsLayer" /* …one per layer */
};

export function restoreLayers(mapVersion: string, data: string[]): void {
  const isLegacy = compareVersions(mapVersion, "1.144.0").isOlder;
  if (!isLegacy && data[50]) return void Layers.restore(JSON.parse(data[50]));

  unwrapFogging(); // move mask="url(#fog)" from #fogging-cont onto #fogging, drop the wrapper

  // order: read once from the loaded svg, the only DOM read in the system
  const positions = new Map(
    [...ensureEl("map").querySelectorAll("#viewbox > *, #map > g")].map((node, index) => [node.id, index])
  );
  const order = [...Layers.all]
    .sort((a, b) => (positions.get(a.elementId) ?? Infinity) - (positions.get(b.elementId) ?? Infinity))
    .map(layer => layer.id);

  // active: the pre-1.144 per-layer heuristics, lifted verbatim from load.ts
  const filled = (selector: string) => Boolean(document.querySelector(selector)?.childNodes.length);
  const shown = (elementId: string) => findEl(elementId)?.style.display !== "none";
  const wasActive: Record<string, () => boolean> = {
    texture: () => filled("#texture image"),
    heightmap: () => filled("#landHeights"),
    lakes: () => shown("lakes"),
    states: () => filled("#statesBody"),
    borders: () => shown("borders") && filled("#borders path"),
    relief: () => shown("terrain"),
    ocean: () => true,
    landmass: () => true,
    coastline: () => true,
    debug: () => true
    // …one entry per pre-1.144 layer
  };

  const active = Layers.all.filter(layer => wasActive[layer.id]?.()).map(layer => layer.id);
  Layers.restore({ order, active });
}
```

`LEGACY_LAYER_IDS` is exported as _data_ (not logic) for the one-time localStorage preset remap, which
is not map-file state and therefore cannot be version-gated inside this function.

### Consumers

Long `layerIsOn` chains collapse. `src/components/tools.ts:136-163` becomes:

```ts
Layers.draw("routes", "rivers", "population", "goods", "states", "borders", "provinces", "burgIcons", "military");
```

Direct renderer imports go the same way: a controller that called `drawLabels()` now calls
`Layers.draw("labels")`, which additionally skips the work when the layer is off and keeps z-order.
`labels-renderer.ts` still exports `redrawLabel`, `getSceneLabel` and `getVisibleLabels` — those are
label operations, not layer lifecycle, and forcing them through the registry would give `Layer` a
per-layer method grab-bag.

`drawLayers()` becomes `Layers.drawAll()`. The heightmap editor snapshots and restores state instead of
synthesising clicks, which also removes the need for a per-layer toggle guard:

```ts
const storedLayers = Layers.state.active; // on enter
Layers.set(["heightmap"]);
// …
Layers.set(storedLayers); // on exit — set takes plain strings and ignores ids it does not know
```

Untranslated `public/modules/**/*.js` reads state through `window.Layers.isOn(id)`; the DOM-sniffing
`layerIsOn` is gone. `window.drawX` bridges survive only where a classic caller still exists — when the
last one goes, so does the bridge and its `src/types/global.ts` entry.

## Testing Decisions

- **What makes a good test here:** assert external behaviour of the registry against fake layers —
  what ends up active, in what order the SVG groups sit, which `draw`/`erase` callbacks ran. Do not
  assert on private fields or listener call counts.
- **Module under test:** `LayersRegistry` and `Layer`. `LayersRegistry` is exported so the test builds
  its own instance over fake layers instead of resetting the singleton's module. The real map layers are
  configuration; the individual renderers keep their own tests.
- **Representative cases:**
  - `init` creates missing groups, adopts existing ones, and orders both by registration order;
  - `show`/`hide` set `display` and invoke `draw`/`erase` exactly once, and are no-ops when the layer
    is already in the requested state;
  - `draw(b, a)` invokes callbacks in registration order and skips inactive layers;
  - `move` reorders the array and the SVG together;
  - `restore` applies order and active state and invokes **no** `draw` or `erase`;
  - `sortBy` handles a saved order containing unknown ids, and a registry containing layers the
    saved order lacks (they land after their registration-order predecessor);
  - `state` round-trips through `restore`.
- **Prior art:** `src/renderers/draw-biomes.test.ts` and `src/renderers/trade-animation.test.ts` for
  DOM-touching renderer tests; the registry test builds its own `#map`/`#viewbox` fixture and needs no
  `pack`/`grid`.
- **E2E:** `tests/e2e/lakes-layer.spec.ts`, `layers.spec.ts`, `load-map.spec.ts` and
  `controller-launchers.spec.ts` target `#toggleLakes`-style ids and `window.toggleGoods()`. They move
  to `[data-layer="lakes"]` and `window.Layers`. A round-trip test — toggle a set of layers, save,
  reload, assert the same set — is worth adding, since that is the behaviour `data[50]` exists for.

## Rollout

Four steps; the first three are independently shippable and each leaves the app working.

1. **Registry.** `layers.ts` — the `Layer` value, the registry and the layer list in one file — and
   `Layers.init()` in the startup path taking
   over group creation from `main.js`. `layerIsOn`, `turnButtonOn`, `turnButtonOff` become shims over
   the registry. Nothing else changes; the DOM is still where the tab renders from.
2. **UI.** Layers tab component and `BUTTONS`; hotkeys through the same table. Delete the `<li>`
   markup in `index.html`, the `toggleX` functions, `getLayer()`, `turnButton*`, and the hotkey chain.
   Presets and the heightmap editor move onto `set`.
3. **Persistence.** `data[50]` in save/load, `restoreLayers` in `auto-update.ts` (including the fogging
   unwrap), delete the load heuristics. Bump `VERSION` to 1.144.0.
4. **Cleanup.** Convert the remaining `layerIsOn` call sites to ids, delete
   `public/modules/ui/layers.js` (moving its ~10 surviving `drawX` functions into `src/renderers/`),
   route direct `drawX()` calls in controllers through `Layers.draw(id)`, and drop the `window.drawX`
   bridges that no classic caller reaches.

## Out of Scope

- **Renaming SVG layer elements to `${id}-layer`.** Desirable — `terrs`, `relig`, `provs`, `prec` are
  poor ids for public DOM nodes — but it drags in the style presets stored in `data[48]`, the presets
  in localStorage, `public/modules/ui/style-presets.js`, `export.ts`, CSS, and ~500 `#id` selector
  usages. Deferred as its own pass. Because `data[50]` stores canonical layer ids (`heightmap`, not
  `terrs`), that pass will be a DOM-only change with no second file-format migration, and its rename
  table is derivable from the registry by pairing each layer's `elementId` with its new `id`-derived
  name, rather than being hand-maintained.
- **Removing the ~40 bare global d3 selections** (`terrs`, `regions`, `labels`, …) and their ~243 call
  sites in favour of `select(layer.getEl())`. New code uses `getEl()`; the sweep follows the rename.
- **Renaming sub-group ids** (`landHeights`, `statesBody`, `goodsIcons`, `searoutes`).
- **Rewriting `public/modules/ui/style.js`**, beyond adding `goods` and `icons` to its section lists.
- **Changing `ViewportRenderer`.** It is orthogonal; viewport layers register with both and that is
  correct.
- **Splitting `drawFeatures`** into separate landmass and coastline renderers.
- **Redesigning the presets UI or the preset format.**

## Further Notes

- **Import cycles are the main structural risk.** `layers.ts` holds both the registry and the layer
  list, so it imports every renderer while renderers import `Layers` back to query state. The cycle is
  safe only under one invariant: _no renderer touches `Layers` while its module is evaluating_ — every
  use sits inside a function, where ESM live bindings have already resolved. A top-level
  `const x = Layers.get(…)` in a renderer would hit the TDZ, the same failure mode as the top-level
  `mapId` gotcha. Renderers also receive their layer as the `draw`/`erase` argument, so `getEl()` needs
  no lookup at all. Non-renderer consumers (`tools.ts`, `map-tooltip.ts`, `hotkeys.ts`, editors) are
  unconstrained because nothing imports them back.
- **Behavioural change to flag in review:** jQuery `fadeIn`/`fadeOut` on layer toggle is removed —
  layers appear and disappear immediately. The d3 transitions precipitation and population play while
  _drawing_ are unaffected, being part of their `draw`. Their removal animations go, though: `display:
none` is the state carrier and is written before `erase` runs, so anything an `erase` animates is
  already hidden. One visibility mechanism costs the fade-out; that is the trade.
- **Style targets.** Ctrl+click now opens `layer.elementId`, so the two layers whose style target
  differs from their element — goods (`goodsIcons`) and burg icons (`burgIcons`) — need `goods` and
  `icons` added to the section lists in `public/modules/ui/style.js:133`. This is a fix on the style
  side, not a special case in the registry, and it is needed for the future rename regardless.
- **Saved file size.** Layers that keep their content when off (lakes, ice, emblems, compass, scale
  bar, vignette) already behaved this way; the uniform `display: none` rule does not add content to
  saved files, because layers that erase still erase.
- **`#fogging-cont` is unwrapped** so that every layer's toggled node is its own root — the last
  "toggled node ≠ layer root" special case in the system.
- **Why a registry rather than a base class.** `draw`/`erase` is the entire contract, and the two
  renderer families (eager and viewport) satisfy it differently without sharing implementation. A
  class hierarchy would add a vocabulary without removing a decision.

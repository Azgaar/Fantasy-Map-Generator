# Style editor — schema-driven

Companion to `style.md` (the store) and `style-migration.md` (steps 1–7, done). This is the last step:
retire `public/modules/ui/style.js` (1573 lines), `style-presets.js` (294) and the ~900-line hand-written
Style tab template, and replace them with a form built from `stylesSchema` at open time.

## Problem

The store is typed and complete, but the editor is still a hand-written mirror of it: one `<tbody>` per
concern in `style-tab.ts`, one `if (styleElement === …)` block per layer to fill the inputs, one listener per
input to write the value back, and a selector-based route table (`styleNodeFor`) to find the store node. Every
schema field is declared three more times (markup, read, write), a new field gets no UI until someone writes
all three, and the element/group selection still speaks DOM ids (`terrs`, `regions`, `cults`) that the store
never had.

## Design

Four modules, each deep: a small interface, all the repetition hidden behind it.

```
stylesSchema + styleMeta  ──►  SchemaForm.render(schema, value, …)  ──►  rows in #styleForm
     (what a field is)            (how a field is edited)                     │ onChange(path, value)
                                                                              ▼
                                                              StyleEditor: set store, run effect
```

The rule that splits them: **the schema says what a value is; the editor says what happens when it changes.**

### Files

```
src/generators/styles-schema.ts            + styleMeta registry, format regexes, enums (§1)
src/components/shared/schema-form.ts       SchemaForm.render + the six standard controls (§2)
src/components/shared/schema-form.dom.test.ts
src/components/options/tabs/style-tab.ts   the shell: preset row, element/group selects, #styleForm (§3)
src/controllers/style-editor/index.ts      open/refresh, selection, StyleEditor export (§3)
src/controllers/style-editor/effects.ts    path → side effect (§3)
src/controllers/style-editor/groups.ts     GROUP_SOURCES (§3)
src/controllers/style-editor/controls.ts   the custom controls the editor registers (§3)
src/controllers/style-editor/effects.test.ts
src/controllers/style-presets.ts           apply/change/save/remove + Style Saver dialog (§4)
src/services/style-presets.ts              preset sources: bundle, fetch, localStorage (§4)
src/services/style-presets.test.ts
src/renderers/heightmap-color-schemes.ts   getColorScheme/getColor/addCustomScheme (§4)
src/data/vignette-presets.ts               the seven presets as store-shaped partials (§3)
```

`controllers/style-editor/` is lazy (`Controllers.StyleEditor`); everything else in `components/` is eager
and tiny. Nothing under `src/` reaches a `window.style*` global after step 7.

### 1. The schema declares the field, once — `src/generators/styles-schema.ts`

Zod already carries most of what a form needs: `boolean` → checkbox, `enum` → select, `number.min().max()` →
slider, plain `number` → number input, `string` → text, `nullable`/`default` → unwrapped. What it cannot know
is _semantics_ — that `color` is a colour and `filter` is a defs lookup — and that is exactly what the shared
field constants already name. A typed registry adds the missing word to each constant, once:

```ts
export const styleMeta = z.registry<FieldMeta>();
export type ControlKind =
  | "checkbox"
  | "select"
  | "slider"
  | "number"
  | "text"
  | "color" // standard, SchemaForm ships them
  | "filter"
  | "mask"
  | "font"
  | "unit"
  | "blur"
  | "transform"
  | "labelStyle"
  | "percent"
  | "scheme"
  | "texture"
  | "icon"
  | "emoji"
  | "vignettePreset"
  | "mapFilter"; // the editor registers them
export type FieldMeta = {
  control?: ControlKind; // overrides the derived control
  label?: string; // default: key → sentence case ("stroke-width" → "Stroke width", "dx" → "Shift x")
  tip?: string; // the row's data-tip
  step?: number; // sliders; default 1 for int, 0.01 for a range ≤ 2, else 0.1
  nullAs?: number | string; // what an unset attr shows as (opacity null → 1, filter null → "")
  hidden?: true; // stored, never edited: autoFilter, labels.attrs.font-size, map.attrs.filter
  gate?: string; // on a nested object: the key (or dotted path) that switches the rest of the section on
};

const color = hexColor.nullable().register(styleMeta, { control: "color" });
const opacity = z.number().min(0).max(1).nullable().register(styleMeta, { nullAs: 1 });
const contours = z
  .strictObject({ mode: z.enum(["off", "overlay", "only"]) /* … */ })
  .register(styleMeta, { gate: "mode" });
```

`register` returns the same instance, so `...strokeAttrs` spreads keep their meta; the reader unwraps
`ZodDefault → ZodNullable → leaf` to find it. A use site that needs different meta than the constant's — the halo
`filter` is a `blur`, `landHeights` must not gate on `render` while `oceanHeights` does, the layer-level
`labels.attrs.font-size` is `hidden` — registers on a **`.clone()`**: `register` on the shared instance would
mark every use, and a clone keeps the format while taking its own entry (verified on zod 4.4). Labels are derived from the key so the shared constants need no per-use text; a nested
object (`contours`, `bands`, `oceanWaves`, `statesHalo`) becomes a subsection titled by its key,
`attrs`/`options` are flattened (the store convention, not a UI one).

**Can the zod schema be the whole config?** For _field semantics_ — type, range, choices, nullability,
default, control, label, tip, gating — yes, and the registry keeps it typed without touching validation. For
_behaviour_ — what to redraw, where a select's options come from (defs filters, loaded fonts, textures, colour
schemes), how a group list is counted — no: that is renderer and map knowledge and belongs to the controller
(§3). The same registry pattern fits `options-schema.ts` later (the Options tab's `OPTION_BINDINGS` is already
read/write/parse/effect per field), which is why `SchemaForm` takes any object schema, not `stylesSchema`.

**Schema tightening — validation only, the format stays.** An attr is an SVG attribute: `Styles.write`
applies it without a redraw, and that is the property worth keeping. The packed ones (a transform, a
cssText, a `blur(Npx)` filter) are not split into options; instead the schema pins their format and a control
that knows the format parses it into parts and composes it back. The parse/compose pair is UI, the format is
data — the store never sees a half-written string.

The formats (each a named const in `styles-schema.ts`, each with a valid/invalid unit case):

- `color` → `hexColor` (in `schemaUtils`).
- `filter` → `url(#id)` **or** a CSS filter-function list (`/^(url\(#[\w-]+\)|(blur|sepia|grayscale|…)\([^)]*\)( |$))+$/`):
  cinderwood ships `sepia(0.6)` on its texture and heightmap, and the Style Saver lets users paste any
  filter, so `url(#…)` alone is not the grammar. `blurFilter` (halo, vignette) is the narrow
  `/^blur\(\d+(\.\d+)?px\)$/` with `control: "blur"`.
- `mask` → `/^url\(#[\w-]+\)$/` (fogging carries `url(#fog)`, vignette `url(#vignette-mask)`); the layers
  that clip to land/water register a `clip` const (`z.enum(["url(#land)", "url(#water)"]).nullable()`, label
  "Clip to") on a `.clone()` so the shared `mask` stays a plain text field elsewhere.
- `stroke-dasharray` → `/^(none|\d*\.?\d+( \d*\.?\d+)*)$/` (presets carry `.5 1`).
- `stroke-linecap` → `z.enum(["butt", "round", "square"]).nullable()`, `stroke-linejoin` likewise; `null`
  is "inherit".
- `fontSize` → `/^\d+(\.\d+)?(%|px)?$/` (`control: "unit"`); `percentage` keeps its regex (`control:
"percent"`); compass rose `transform` → `/^translate\(x y\) scale\(s\)$/` (`control: "transform"`);
  label `style` → a cssText refined to `text-shadow`, `text-transform`, `transform: translate(…em, …em)`
  (`control: "labelStyle"`).
- Enums where the editor already offers a fixed list: `grid.options.type`, `heightmap.options.curve`
  (`curveBasisClosed | curveLinear | curveStep`), `relief.options.set`, `oceanLayers.options.outline`,
  `font-style` (`italic | oblique`, null = normal).

**The data is normalized, not the schema loosened.** An audit of the 14 presets + `default-styles.json`
finds `""` where `null` is meant (filter, mask, dasharray), `inherit` linecaps, and nothing else outside the
formats above. The tightening PR rewrites them (`""` → `null`, `inherit` → `null`) with a one-off pass in
`scripts/convert-style-presets.mjs`, and the fixtures follow. Old `.map` files and `localStorage` presets
carry the same shapes, so the same normalization becomes a version-gated step in `auto-update.ts`
(`isOlderThan(<tightening version>)`) and in the custom-preset upgrader — an explicit migration of the
loaded record, not a `parseSections` repair. A value that still fails after normalization (a hand-pasted
`filter: "foo"`) is the one case left to repair-with-warning.

### 2. The form engine — `src/components/shared/schema-form.ts`

```ts
export type FieldSpec = {
  path: string[]; // from the schema root passed in, e.g. ["attrs", "fill"]
  kind: ControlKind;
  label: string;
  tip?: string;
  min?: number;
  max?: number;
  step?: number; // numbers
  options?: readonly (string | number)[]; // enums
  nullable: boolean;
  nullAs?: number | string;
};
export type ControlFactory = (spec: FieldSpec, value: unknown, set: (value: unknown) => void) => HTMLElement;

export const SchemaForm = { render, fieldSpec, walk };
function render(
  schema: z.ZodObject,
  value: object,
  options: {
    meta: z.core.$ZodRegistry<FieldMeta>;
    controls?: Partial<Record<ControlKind, ControlFactory>>; // merged over the six standard ones
    flatten?: (key: string) => boolean; // default: key === "attrs" || key === "options"
    onChange: (path: string[], value: unknown) => void;
  }
): HTMLElement;
```

**Reading a field.** `fieldSpec(key, schema)` unwraps `ZodDefault`/`ZodNullable`/`ZodOptional` to the leaf
(zod 4: `def.innerType`, `.unwrap()`), reads `meta.get(leaf)`, then derives: `kind` = `meta.control` ??
(`ZodBoolean` → checkbox, `ZodEnum` → select via `.options`, `ZodNumber` with both `minValue` and `maxValue` →
slider, `ZodNumber` → number, else text); `min`/`max` from `.minValue`/`.maxValue`; `step` from `meta.step`
?? (`_zod.bag.format === "safeint"` → 1, range ≤ 2 → 0.01, else 0.1); `label` from `meta.label` ??
`labelOf(key)` (`-`/`_` → space, camelCase split, sentence case, `dx`/`dy` → "Shift x/y"). Meta on a wrapper
is never read — `register` goes on the leaf or the object.

**Walking.** `walk(schema, value, path)` iterates `schema.shape` in declaration order. A `ZodObject` key that
`flatten` accepts recurses into the same container; any other object becomes a subsection:

```html
<details open data-section="options.contours">
  <summary><span>Contours</span> [gate control, if any]</summary>
  <div class="body">…rows…</div>
</details>
```

With `gate`, the gate leaf's control is rendered in the summary and skipped in the body; the body gets
`hidden` while the gate value is `false | "off" | "none"`, toggled on every gate change without a re-render.
`gate` may be a dotted path inside the section (`"options.render"` on `oceanHeights`). A gated object is
always a subsection, even one `flatten` would accept — lake `options` gate on `embellishment`, so that
node renders as an "Embellishment" subsection under the lake's attr rows. Clicks on the gate control don't
toggle `<details>` (stopPropagation in the summary). A `ZodRecord` is never walked — the
editor resolves a `groups` record to one entry before calling `render`.

**Rows.** Every leaf that is not `hidden` becomes

```html
<div class="row" data-field="attrs.fill" data-tip="…">
  <label>Fill</label>
  <div class="ctl">…</div>
</div>
```

`data-field` is the path joined with `.` (relative to the rendered root, so stable across groups). The
control's `set` is called with the parsed value; `render` forwards it as `onChange(path, value)`.

**Standard controls** (the six the engine ships):

| kind     | element                                                                  | emits                                                                    |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| checkbox | `<input type=checkbox class=checkbox>`                                   | boolean on `input`                                                       |
| select   | `<select>` with `options`; nullable adds an `inherit` (`""`) first entry | `string \| number \| null` on `change`                                   |
| slider   | `<slider-input min max step>` (existing component)                       | number on `input`; empty/NaN ignored (the component already stops those) |
| number   | `<input type=number step>`                                               | number, or `null` when nullable and empty                                |
| text     | `<input type=text placeholder="none">`                                   | trimmed string, `null` when empty and nullable                           |
| color    | `<input type=color>` + `<output>` with the hex                           | string on `input`; the `output` follows                                  |

**Null.** A nullable field shows `value ?? nullAs ?? ""`. Clearing writes `null` (never `""`), which
`Styles.write` turns into `removeAttribute`. A non-nullable field never emits `null`: an emptied number is
ignored, an emptied text emits `""`.

The engine has no `styles`, `Layers` or `pack` in it — it is tested in jsdom against a five-field mini schema
(render each kind, change → `onChange(path, value)`, gate collapses and un-collapses, null round-trip,
`flatten`). The invariant test that matters most walks the real `stylesSchema` with `styleMeta` and asserts
every leaf yields a known `ControlKind` or is `hidden`: a field can no longer exist without UI. It lives
beside the schema (`styles-schema.test.ts`) so it fails in the PR that adds the field.

### 3. The editor — `src/controllers/style-editor/` (lazy, `Controllers.StyleEditor`)

```ts
export const StyleEditor = { open, refresh, close };
function open(element?: StyleElement, group?: string): void; // shows the panel on the Style tab, selects, renders
function refresh(): void; // re-render the current selection from the store (after a preset change)
function close(): void; // empty #styleForm, drop listeners
```

**The shell** (`style-tab.ts`, eager, ~60 lines) injects into `#styleContent`:

```html
<div class="head">
  <p>Preset:</p>
  <select id="stylePreset"></select>
  <button id="addStyleButton">+</button><button id="removeStyleButton">−</button>
  <p>Element:</p>
  <select id="styleElementSelect"></select>
  <p>Group:</p>
  <select id="styleGroupSelect"></select>
</div>
<div id="styleForm"></div>
```

and nothing else: no rows, no `<tbody>`s. `options-panel.selectTab("styleTab")` calls
`Controllers.StyleEditor.open()`; the selects' `change` handlers call `open(element, group)` too, so the shell
holds no state. `#styleElementSelect` is filled once by the editor from `Object.keys(stylesSchema.shape)`
with the layers-tab labels (the `[id, { label }]` table in `layers-tab.ts` moves to `src/data/layer-labels.ts`;
the editor strips the `<u>` shortcut markup; `map` gets "Map"), sorted by label.

**Selection speaks the store.** The thing the select lists is a **Style element**: a top-level key of
`stylesSchema` — a Layer's style, or `map` for the whole-map filter. It is declared beside the schema as
`export type StyleElement = keyof Styles` (replacing `StyleLayerId`; `Layers.draw` still takes the
`LayerId` subset). An element with a `groups` record (labels, routes, lakes, burgIcons) gets the group
select — the list is user-defined and unbounded; everything else hides it. Named subgroups
(`statesBody`/`statesHalo`, `landHeights`/`oceanHeights`, ocean `base`/`oceanLayers`/`oceanWaves`, scale-bar
`back`, legend `box`, emblem/goods/population/borders/coastline parts) are **not** a selection: they render
inline as collapsible subsections under the element's own rows, so an element is seen whole. `burgIcons`
holds two records keyed by the same burg groups (`burgIcons.groups`, `anchors.groups`), so one group select
serves both: the burg icon rows render flat and the anchor rows of the same group as an "Anchors"
subsection — one place to style a burg group, not two list entries.

```ts
// groups.ts — what the Group select lists, and how many things use each entry
type GroupSource = () => { id: string; label: string }[];
export const GROUP_SOURCES: Record<string, GroupSource> = {
  labels: () =>
    options.map.labels.groups.map(g => ({
      id: g.name,
      label: `${g.name} (${countLabels(g.name)})`
    })),
  burgIcons: () => burgGroups(), // `${name} (${burgs} burgs, ${ports} ports)`
  routes: () =>
    Object.keys(styles.routes.groups).map(id => ({
      id,
      label: `${id} (${countRoutes(id)})`
    })),
  lakes: () =>
    Object.keys(styles.lakes.groups).map(id => ({
      id,
      label: `${id} (${countLakes(id)})`
    }))
};
```

`STYLE_ELEMENT_ALIASES`, `GROUPED_STYLE_ELEMENTS` and `styleNodeFor` go — the rendered node is
`styles[element]` or `getPath(styles, [element, "groups", group])`, and the schema passed to `render` is
`stylesSchema.shape[element]` or the record's `.valueType` (for `burgIcons`, a composed object of both entries).

**Rendering.** `open` empties `#styleForm`, prepends the hidden-layer banner when `!Layers.isOn(layer)`
(`<div class="banner">Heightmap layer is hidden <a>Turn on</a></div>` → `Layers.show(layer)` + re-render),
then appends `SchemaForm.render(schema, node, { meta: styleMeta, controls: CUSTOM_CONTROLS, onChange })`.
`onChange(path, value)` does two things:

```ts
function onChange(relative: string[], value: unknown): void {
  const path = [...selection.path, ...relative]; // absolute into `styles`
  const node = getPath(styles, path.slice(0, -1));
  const key = path.at(-1);
  const previous = node[key];
  node[key] = value;
  effectFor(path)(selection, value, previous, path);
}
```

`editStyle`-style entry (`open(layer, group)` from another editor) adds `.glow` to the element/group selects
for 1.5 s as today.

**Effects** (`effects.ts`) — the default is the store convention, and the exceptions are the whole
remaining per-layer knowledge. The attrs default is a **single-attribute** write, never the whole layer:
`invokeActiveZooming` (`zoom.ts`) overwrites `#labels font-size` and `#statesHalo stroke-width` on every
zoom, so `Styles.write("labels")` after editing one label colour would snap every label to the stored
`100px` until the next zoom. `Styles` gains `writeAttr(path)` — resolve the element by the path's
`data-layer`/`data-group` chain, set or remove the one attribute — and `Styles.write(layer)` stays the
preset-apply and load path only (both are followed by `invokeActiveZooming`, as today).

```ts
type Effect = (sel: Selection, value: unknown, previous: unknown, path: string[]) => void; // previous: the store value before the write
const write: Effect = (sel, _v, _p, path) => Styles.writeAttr(path); // the one attr → its element, no redraw
const draw: Effect = sel => Layers.draw(sel.layer); // options → renderer
const redraw =
  (id: LayerId): Effect =>
  () =>
    Layers.draw(id);
const seq =
  (...effects: Effect[]): Effect =>
  (...args) =>
    effects.forEach(effect => effect(...args));

const EFFECTS: [RegExp, Effect][] = [
  [/^(grid|rulers)\.attrs\./, seq(write, draw)], // the renderer bakes the stroke
  [/^relief\.options\.set$/, seq((_, v) => Relief.changeSet(v), redraw("relief"))],
  [/^relief\.options\.size$/, seq((_, v, prev) => Relief.changeSize(v / prev), redraw("relief"))],
  [/^relief\.options\.density$/, seq(() => Relief.generate(), redraw("relief"))],
  [/^markers\.options\.rescale$/, () => invokeActiveZooming()],
  [/^ocean\.options\.pattern/, () => applyOceanPattern()],
  [/^vignette\.options\./, () => applyVignetteOptions()],
  [/^labels\.groups\.[^.]+\.attrs\.(style|font-.*|letter-spacing)$/, seq(write, refitStateLabels)], // width-fitted groups
  [/^labels\.groups\.[^.]+\.attrs\.font-size$/, seq(write, fitLabelRanges)],
  [/^legend\.attrs\.font-family$/, seq(write, redraw("legend"))],
  [/^states\.statesHalo\.options\.width$/, seq((_, v) => (styles.states.statesHalo.attrs["stroke-width"] = v), write)],
  [/^military\.options\.boxSize$/, seq((_, v) => (styles.military.options.fontSize = v * 2), draw)],
  [/^scaleBar\./, redraw("scaleBar")], // both attrs and options lay the bar out
  [/^emblems\..*\.options\.size$/, redraw("emblems")]
];
export const effectFor = (path: string[]): Effect =>
  EFFECTS.find(([re]) => re.test(path.join(".")))?.[1] ?? (path.includes("attrs") ? write : draw);
```

`refitStateLabels` redraws labels when the edited group is of type `state` (`options.map.labels.groups`):
state labels are fitted to their outline width, which every typography attr moves — today only
`text-transform` on the `state` group triggers it, so this is a small correctness gain, not a behaviour
change elsewhere. `fitLabelRanges` keeps today's behaviour: the stroke-width and letter-spacing sliders of a label group get
`max = fontSize / 2`, `min = -fontSize / 10`, widened to hold the stored value; it addresses them through
`[data-field="attrs.stroke-width"] slider-input`. `effects.test.ts` asserts, for a table of paths, which
side effect fires — with `Styles`, `Layers`, `Relief` stubbed.

**Custom controls** (`controls.ts`), each owning its option source and any dialog; the composed ones call
`set` with the whole string:

| kind           | binds                      | source / dialog                                                                                                                                                     | composes                                                                                       |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| filter         | `*.attrs.filter`           | `<option>`s from `#filters > filter[id][name]`, "None" first                                                                                                        | `url(#id)` / `null`                                                                            |
| mask           | `*.attrs.mask`             | the `mask` enum                                                                                                                                                     | —                                                                                              |
| font           | `attrs.font-family`        | `fonts` list + `+` button → add-font dialog (owned here; `fonts.ts` `addGoogleFont/addLocalFont/addWebFont` return the family and stop touching `#styleSelectFont`) | —                                                                                              |
| unit           | `font-size` strings        | number + `%`/`px` select                                                                                                                                            | `"22%"`                                                                                        |
| blur           | halo/vignette `filter`     | `<slider-input 0…10 step .1>` + "px"                                                                                                                                | `blur(5px)` / `null` at 0                                                                      |
| transform      | compass rose               | x, y numbers + scale slider                                                                                                                                         | `translate(x y) scale(s)`                                                                      |
| labelStyle     | label `attrs.style`        | shadow text, transform select, dx/dy numbers (em)                                                                                                                   | `text-shadow: …; text-transform: …; transform: translate(dx em, dy em)`, `null` when all empty |
| percent        | vignette geometry          | number + "%"                                                                                                                                                        | `"5%"`                                                                                         |
| scheme         | heightmap `options.scheme` | `HeightmapColorSchemes.names()` + `+` → gradient builder dialog (ported from `style.js`, adds via `addCustomScheme`)                                                | —                                                                                              |
| texture        | `texture.options.href`     | the texture list (moves from the template to `src/data/textures.ts`) + `+` → URL dialog with preview                                                                | —                                                                                              |
| icon           | burg/anchor `options.icon` | `<burg-icon-picker>` (exists); `fill`/`stroke` rows update its preview through a `MutationObserver` on the row values, not a special case in `onChange`             | —                                                                                              |
| emoji          | `markets.options.icon`     | button → `Controllers.IconSelector.open(current, set)`                                                                                                              | —                                                                                              |
| vignettePreset | (no field: an extras row)  | `VIGNETTE_PRESETS` select; applying assigns into `styles.vignette` and calls `refresh()`                                                                            | —                                                                                              |
| mapFilter      | `map.options.dataFilter`   | the four radio buttons; on change also sets `styles.map.attrs.filter = url(#filter-id)` (`map.attrs.filter` is `hidden`)                                            | —                                                                                              |

Two decorations, not rows: grid `options.scale` appends a friendly size (`scale × 25 × units.scale unit`,
re-computed on `input`, exported for `units-editor.ts` which calls it today), and `relief.options.density`
carries the "regenerates the icons" tip from the schema meta.

**Extras.** `options.app.emblems.showAll` is not style; the editor appends it as one hand-written row under
`emblems` (`extras: Partial<Record<StyleElement, () => HTMLElement>>` with exactly one entry) so users find it where
it was. The vignette preset row is the other entry.

**Own the DOM.** `open` builds, `close` (called from `selectTab` when leaving the tab, and on `open` of another
layer) empties `#styleForm` and destroys any dialog the controls opened. The Style Saver and add-font
dialogs are created by their owners and removed on close; `#styleSaver` and `#addFontDialog` leave
`index.html`.

**UX.** Rows keep the two-column table look (label column 8.5em, control fills the rest); subsections are
`<details>` with the header carrying the gate; colour rows show the hex; sliders are `<slider-input>`; the
hidden-layer banner offers a one-click turn-on; opened from another editor, the selects glow. Stable
`data-field` addresses replace the `#styleFontSize`-style ids in the eight e2e specs.

### 4. Presets — `src/services/style-presets.ts` + `src/controllers/style-presets.ts`

```ts
// services/style-presets.ts — sources only, reads no pack/grid
export const SYSTEM_PRESETS = ["default", "ancient", …, "frostbite"] as const;
export const CUSTOM_PREFIX = "fmgStyle_";
export const StylePresets = { load, saveCustom, removeCustom, listCustom, isSystem };
function load(name: string): Promise<{ name: string; styles: unknown }>; // custom → localStorage; "default" → bundle; else fetch ./styles/<name>.json?v=; any failure → default, one console.error
function saveCustom(name: string, json: string): void; function removeCustom(name: string): void; function listCustom(): string[];
```

`auto-update.ts` calls `StylePresets.load` and passes the result into `restoreStrippedLayerStyles(preset)`,
so `styles-legacy.ts` stops fetching (a generator importing a service is the wrong direction).

```ts
// controllers/style-presets.ts
export const StylePresetsEditor = {
  init,
  applyOnLoad,
  applyPreset,
  change,
  openSaver,
  remove
};
```

- `init()` fills `#stylePreset` (system + `listCustom()` as `name [custom]`) and wires `change` →
  `change(name)` (session-scoped confirmation via `confirmationDialog`, revert the select on cancel),
  `+` → `openSaver()`, `−` → `remove()`; the remove button shows only for a custom preset.
- `applyPreset(json)`: `isLegacyPreset` → `presetFromLegacy` else `Styles.parse`; `Styles.set`; fill missing
  label groups from their type's fallback group; `Burgs/Routes/Lakes.ensure*GroupStyles()`;
  `Styles.write(...all)`; `applyVignetteOptions()`; `applyOceanPattern()`; relief `changeSize(new / prev)`
  and `changeSet`; `HeightmapColorSchemes.ensure(scheme)` for both heights. Used by load (`load.ts:672`)
  and by every UI path.
- `change(name)`: `load` → `options.map.style.preset = name; Options.save()` → `applyPreset` →
  `Layers.drawAll()` → `invokeActiveZooming()` → `StyleEditor.refresh()` → select follows the preset
  (`setStylePresetSelect` semantics: an unknown name falls back to `default`).
- `openSaver()`: builds the Style Saver dialog (name input with the new/existing/system hint, JSON textarea
  prefilled with `JSON.stringify(styles, null, 2)`, save / download / upload buttons), `destroyDialog` on
  close. Save validates JSON + `isKnownStyleFormat`, refuses a system name, `saveCustom`, applies.
- `applyOnLoad()` (called from `url-params.ts:63`) = `load(options.map.style.preset)` → `applyPreset` →
  store the resolved name back.

Heightmap colour schemes (`heightmapColorSchemes`, `getColorScheme`, `getColor`, `addCustomColorScheme`) are
renderer data with six TypeScript consumers (`draw-heightmap`, `heightmap-editor`, `heightmap-selection`,
`elevation-profile`, `export`, `debugUtils`); they move to `src/renderers/heightmap-color-schemes.ts` first:

```ts
export const HeightmapColorSchemes = { get, getColor, names, add, ensure }; // ensure(name) adds a "#hex,#hex,…" custom scheme once
```

imported, no bridge, `global.ts` loses the four declarations.

## Migration

Every step lands green (tsc, vitest, e2e) and the attribute-snapshot baselines stay byte-identical — a style
edit must render the same before and after.

1. **Colour schemes and vignette presets out of `style.js`** → `renderers/heightmap-color-schemes.ts`,
   `data/vignette-presets.ts`; the six consumers import; `style.js` reads the schemes through
   `HeightmapColorSchemes` for the remaining steps; `global.ts` drops five declarations.
2. **Schema tightening** (§1): the format consts and enums, the normalization pass over the 15 JSONs and
   fixtures, the `auto-update.ts` step and the custom-preset upgrader for the same normalization, and a
   "every preset parses" case in `styles.test.ts`. One PR; nothing renders differently.
3. **Metadata**: `styleMeta` registry, `ControlKind`/`FieldMeta` types, `.register` on the shared constants
   and the per-field overrides, `hidden` on the non-editable fields. No behaviour change; the completeness
   test lands here (it lists the custom kinds the editor will provide).
4. **`SchemaForm`** with the six standard controls and its jsdom tests. Dormant: nothing renders it yet.
5. **Presets**: `services/style-presets.ts` + `controllers/style-presets.ts` with tests; `url-params.ts`,
   `load.ts`, `auto-update.ts` call them; `style-presets.js` is `git rm`-ed with its `<script>` tag;
   `#styleSaver` leaves `index.html`. The controller's "re-select after apply" calls the still-classic
   `window.selectStyleElement()` for exactly one step — the declaration already exists in `global.ts`.
6. **`StyleEditor`** behind `Controllers.StyleEditor`: `index.ts`, `effects.ts`, `groups.ts`, `controls.ts`
   and tests; `Styles.writeAttr`; `style-tab.ts` shrinks to the shell; `options-panel.selectTab` opens it; the
   presets controller's re-select becomes `StyleEditor.refresh()`; the 20 `editStyle(elementId)` call sites
   become `Controllers.StyleEditor.open(element, group)` (one line each, ids translated: `regions` → `states`,
   `terrs` → `heightmap`, `cults` → `cultures`, `relig` → `religions`, `provs` → `provinces`, `armies` →
   `military`, `terrain` → `relief`, `ruler` → `rulers`, `prec` → `precipitation`, `gridOverlay` → `grid`,
   `goodsIcons`/`goodsBurgs`/`goodsCells` → `goods`, `anchors` → `burgIcons`); `fonts.ts` loses its select coupling; `units-editor.ts`
   calls the grid readout export; `style.js` is `git rm`-ed with its `<script>` tag; `#addFontDialog` leaves
   `index.html`; `global.ts` drops the last `style*` declarations; the eight e2e specs move to `data-field`
   selectors and `await` the now-async `open`.
7. **Sweep**: `styleNodeFor` and the editor-only helpers leave `styles-legacy.ts`; `docs/architecture/architecture.md`
   "Map Styling" gains a paragraph on the schema-driven editor; `docs/wiki` Style page screenshots refresh.

## Verification

- Unit: `schema-form.dom.test.ts` (render each kind, change → `onChange`, gate collapse, null round-trip,
  flatten); `styles-schema.test.ts` completeness (every leaf edited or `hidden`) and format cases (a value
  per regex, valid and invalid); `effects.test.ts` (path → which stub fired); `style-presets.test.ts`
  (fallback chain, custom CRUD, unknown name → default).
- E2E: the existing style specs re-pointed at `data-field`; `style-parity` baselines unchanged through every
  step; one new spec opens every element and every group and asserts the form renders with no console errors
  and no unknown control kind.

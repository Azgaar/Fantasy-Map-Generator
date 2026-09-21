# Map Style

How the map looks is map state: one typed, JSON-compatible record — `styles` — holds every value
needed to reproduce the appearance, and the SVG is a projection of it. This page covers the record,
the store that owns it, how presets and persistence manage it, and how the Style tab edits it. The
architectural summary is in [architecture.md](./architecture.md#map-styling).

## The idea

- **One record, one declaration.** The shape is a zod schema (`src/generators/styles-schema.ts`).
  The `Styles` TypeScript type is inferred from it, the defaults are parsed by it, a loaded record is
  validated by it, and the editor's form is built from it. A field declared in the schema exists
  everywhere at once.
- **The DOM is output.** Attrs are written to SVG elements; nothing reads them back. Re-rendering
  from the same world data and the same `styles` gives the same map.
- **Complete by construction.** `Styles.parse` repairs an invalid or missing section from the
  defaults, so a read site never carries a fallback: `styles.rivers.attrs.fill` is always there.
- **Addressed by role, not id.** Elements are found by `data-layer` and `data-group`, stamped by the
  layers registry on the groups it owns and by renderers on the elements they create. SVG ids
  (`terrs`, `regions`, `armies`) never enter the style code.
- **Layers are not style.** Visibility and z-order belong to the layers registry. A per-entity
  override (one label's size) stays with the entity, an exception to its group style.

## The record

The record is keyed by **style element**: every map layer, plus `map` for the whole-map filter.
`StyleElement = keyof Styles`. Every element is a **node**, and a node carries the same three bags at
every level:

| bag       | what it holds                                      | goes to                          |
| --------- | -------------------------------------------------- | -------------------------------- |
| `attrs`   | SVG attributes, by their SVG name (`stroke-width`) | the element, as they are         |
| `options` | renderer inputs (`scheme`, `icon`, `boxSize`, …)   | the renderer, read from `styles` |
| `groups`  | named child nodes, fixed or user-created           | one child element per entry      |

`attrs`, `options` and `groups` are reserved, so a group is never named one of them. A **group entry is
a node too**, so groups nest to any depth — a burg group holds its `icons` and `anchors`. The tree
mirrors the DOM tree: every `groups` entry addresses one `data-group` child of its parent's element.

```json
{
  "rivers": { "attrs": { "fill": "#5d97bb", "opacity": null, "filter": null } },
  "grid": {
    "attrs": { "stroke": "#777", "stroke-width": 0.5 },
    "options": { "type": "pointyHex", "scale": 1 }
  },
  "labels": {
    "groups": {
      "capital": { "attrs": { "font-family": "Almendra SC", "font-size": "22%" } }
    }
  },
  "states": {
    "groups": {
      "statesBody": { "attrs": { "opacity": 0.4 } },
      "statesHalo": { "attrs": { "stroke-width": 10, "filter": "blur(3.5px)" } }
    }
  },
  "burgIcons": {
    "groups": {
      "capital": {
        "groups": {
          "icons": { "attrs": { "fill": "#ffffff" }, "options": { "size": 2, "icon": "#icon-square" } },
          "anchors": { "attrs": { "fill": "#ffffff" }, "options": { "size": 1.9, "icon": "#icon-anchor" } }
        }
      }
    }
  }
}
```

- `null` on an attr means "attribute not set" — written as `removeAttribute`.
- **Fixed groups** (`statesBody` / `statesHalo`, `landHeights` / `oceanHeights`, ocean `base` /
  `pattern` / `oceanLayers` / `oceanWaves`, legend `box`, scale bar `back`, the emblem / goods /
  coastline parts, a burg group's `icons` / `anchors`) are a closed set, declared in the schema.
  **User groups** (`labels.groups`, `routes.groups`, `lakes.groups`, `icons.groups`) are unbounded
  and keyed by the map's own group names — the editor's group select lists those.
- **A font size is an attr**, in px on the layer (`legend.attrs["font-size"]: "13px"`), and its
  texts size by inheritance; a label group's is a `%` of the viewbox font size, which is 100px at
  scale 1 and which the zoom scales by the inverse square root of the scale (the geometric
  half-way between a map-fixed and a screen-fixed size) — so anything sized in `%` or `em` (label
  groups, the markers) follows the zoom, per frame or once it settles as `viewportRedraw` says.
  There is no switch for it: `labels.resizeOnZoom` and `markers.options.rescale` were retired with
  v1.154. An `options` size (`markets.options.iconSize`, `military.options.boxSize`) is a renderer
  input, not a font; the regiment font follows the box.
- **A zoom-derived attr keeps its base in the store.** The zoom writes what it derives — the halo
  `stroke-width` scaled to the viewport, the coordinates `font-size` on redraw — over the stored
  base; the store never holds the derived value.
- `attrs` and `options` are the store's convention, not the UI's: the form flattens them and renders
  every `groups` entry as a card — a user group's entries drive the group select, a fixed group's
  entries render inline.

### Formats

A string attr is an SVG attribute and stays one — `Styles.write` applies it without a redraw. The
packed ones are not split into options; instead the schema pins the format
(`src/generators/styles-formats.ts`) and the control that knows the format parses it into parts and
composes it back. The store never holds a half-written string.

| attr                    | format                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `filter`                | `none`, `url(#id)`, or a CSS filter-function list (`sepia(0.6)`)                                     |
| halo/vignette blur      | `blur(5px)`                                                                                          |
| `mask`                  | `url(#id)`; the layers that clip to land/water pick from a `clip` enum                               |
| `stroke-dasharray`      | `none` or space-separated lengths                                                                    |
| label group `font-size` | `22%` — relative to the viewbox font size, which the zoom scales                                     |
| other `font-size`       | `8px`                                                                                                |
| compass `transform`     | `translate(x y) scale(s)`                                                                            |
| label group `style`     | cssText limited to `text-shadow`, `text-transform`, `font-variant`, `transform: translate(…em, …em)` |

Colours are `#rrggbb`; `stroke-linecap`, `stroke-linejoin`, `font-style` and every choice with a
fixed list are enums (`src/data/style-choices.ts`), `null` meaning "inherit".

### Field meta

Zod says what a value is: type, range, choices, nullability, default, format. A form also needs what
it cannot derive, and the schema carries that too, in a typed registry (`styleMeta`) beside each
field:

```ts
const strokeWidth = meta(z.number().min(0), {
  group: "Stroke",
  label: "Width",
  nullAs: 0,
  range: [0, 10],
  tip: "…"
});
```

`FieldMeta` names the control kind when the type is not enough (`color`, `filter`, `font`, …), the
label and tip, a slider `range` and `step` for an unbounded number, `nullAs` (what an unset attr
shows as), `hidden` for a stored value that is never edited (`transform`, defs `mask` references),
`gate` on a nested object (the key that switches
the rest of the section on) and `group` (a caption over a run of fields: **Stroke** › Color, Width,
Dash array).

`StyleMeta` adds `effect`: the name of what the editor runs after the value changes, set on a field
or on a whole node (the nearest wins). The schema is the one place that says which field does what;
the editor only implements the names (see [Effects](#effects)). Every type of the style system —
the form vocabulary, the style form's additions, the record, the editor's selection — is in
`src/types/styles.ts`, generic first.

Shared constants (`fill`, `opacity`, `strokeAttrs`, `fontFamily`) are declared once and spread into
many elements; a use site that needs different meta registers on a `.clone()` so the shared instance
stays untouched. What the schema does **not** say is where a select's options come from — that is
the control's.

## The store — `Styles`

`src/generators/styles.ts` owns the `styles` global and the API over it. It is a class singleton
(`StylesStore`) holding the record the global points at, so it lives with the generators, not in `data/`.

```ts
Styles.defaults; // the parsed default preset (src/generators/default-styles.json), deep-readonly
Styles.parse(json); // unknown → Styles: per-section validation, repair from defaults, one warning
Styles.set(record); // replace the global wholesale
Styles.write(...elements); // walk the element's tree and put every attr on its data-layer/data-group element
Styles.writeAll(); // write every element
Styles.writeAttr(path); // set or remove the one attribute at [element, …, "attrs", name]
Styles.apply(...elements); // write + Layers.draw
```

- **`parse` repairs, never rejects.** Each top-level section is validated on its own; an invalid one
  is repaired value-by-value from the defaults and re-parsed, with one `console.warn` naming the
  section. Custom group names have no default of their own, so any stock group of the same record
  stands in as the template.
- **`write` skips `options`** — they are renderer inputs. Renderers read `styles.<element>.options`
  directly when they draw (`draw-grid` reads `styles.grid.options`, `draw-legend` the columns).
- **`writeAttr` is the edit path.** The zoom (`invokeActiveZooming`) rewrites a few attrs on every
  zoom step — the states halo `stroke-width` — so rewriting a whole layer after
  one edit would snap those back to the stored value. An edit writes exactly one attribute;
  `Styles.write` of whole elements is the preset-apply and load path, and both are followed by
  `invokeActiveZooming`.
- **Defs resources are renderer-owned.** The vignette mask rect and the heightmap colour schemes
  are shaped from the store by their renderer's applier (`applyVignetteOptions`,
  `HeightmapColorSchemes.ensure`), called after a wholesale `set`. The ocean pattern is not one: its
  `<pattern>` lives in the ocean layer, so the tile image is an ordinary `data-group="pattern"`
  element the store writes.

## Presets and persistence

A **preset** is a complete record in the same shape as the store. Built-in presets, custom presets
and the style saved in a `.map` all use the schema; there is no second format.

- **In the `.map`** the record is `JSON.stringify(styles)` at `data[48]`; `options.map.style.preset`
  keeps the preset _name_ the record was derived from. The name is config (it survives regeneration,
  see [configuration.md](./configuration.md)); the record is map state. Load runs the auto-update
  migrations over `data[48]`, `Styles.parse`s and `set`s it, draws the layers, `Styles.write`s every
  element and runs the defs appliers.
- **System presets** are the fifteen names in `SYSTEM_PRESETS`: `default` ships in the bundle, the
  rest are fetched from `public/styles/<name>.json`. `public/images/style-presets/<name>.png` is each
  one's thumbnail for the gallery.
- **Custom presets** live in `localStorage` under `fmg-style-<name>` (older ones under
  `fmgStyle_<name>`) — an app preference by scope, but the same schema as map state.

`src/services/style-presets.ts` is the source: `StylePresetsService.load(name)` resolves a name to a
record (custom → `localStorage`, `default` → bundle, else fetch) and falls back to `default` with an
`error` message when the preset is missing or broken — the caller that applies the fallback shows it,
a comparison does not; `saveCustom`, `removeCustom`, `listCustom`, `displayName`, `isSystem` are the
rest. It reads no map state and shows no UI.

`Controllers.StylePresetsEditor` (`src/controllers/style-preset.ts`) applies a preset to the map:

1. `parsePreset` — a legacy selector-keyed file is converted, a store-shaped one is `Styles.parse`d;
   anything else is refused with a tip.
2. `Styles.set`, then fill what the preset cannot know: label groups it lacks take the style of
   their type's fallback group, and `Burgs` / `Routes` / `Lakes` ensure every group of the map has a
   style.
3. `Styles.write` of every element, the defs appliers, the relief icon set and size, the heightmap
   colour schemes.

`change(name)` stores the name in `options.map.style.preset`, applies, redraws all active layers and
refreshes the editor; the select asks for confirmation once per session because unsaved edits are
lost. The **Style Saver** dialog (the `+` button) saves the current record as a custom preset, or
downloads / uploads it as JSON; `−` removes a custom one. System names are protected.

### Legacy

`src/generators/styles-legacy.ts` is the only code that understands the old shapes, and it is
reached only from the load migrations (`auto-update.ts`) and `parsePreset`:

- selector-keyed presets (`"#stateBorders": { … }`, `"#labels > #states"`) → `presetFromLegacy`
- maps saved before the store was the source of truth → `stylesFromMap` harvests the SVG attributes,
  `restoreStrippedLayerStyles` re-seeds what a few versions stripped
- `normalizeStyles` rewrites older records to the current shape and formats: folding the fixed
  children under their element's `groups`, merging the two burg records into one entry per group,
  folding
  the mirrored fields into their attrs (`map.options.dataFilter` → `map.attrs.filter`, the halo
  `width`, the `fontSize` options, the ocean pattern options → `ocean.groups.pattern.attrs`), dropping
  the retired ones (`markers.options.rescale`, `military.options.fontSize`), then `""` → `null`,
  `inherit` → `null`, the font-size units
- a value repair that is about the map rather than the format lives in the migration itself, next
  to its version (the anchors that carried the burg icon before ports were stylable)

The store never sees a legacy value: conversion happens before `Styles.parse`, and a value that still
fails afterwards is repaired with a warning like any other.

## Editing — the schema-driven editor

The Style tab is not hand-written. `Controllers.StyleEditor` renders the selected element's subtree
of the schema into a form at open time; the schema says what a value is, the editor says what
happens when it changes.

```
stylesSchema + styleMeta  ──►  SchemaForm.render(schema, node, …)  ──►  cards and rows in #styleForm
     (what a field is)            (how a field is edited)                     │ onChange(path, value)
                                                                              ▼
                                                                  StyleEditor: set store, run effect
```

### The shell

`src/components/options/tabs/style-tab.ts` injects the static part into the Options panel: the
preset row (select, `+`, `−`, gallery button), the element select with the elements-dialog button,
the group select, and an empty `#styleForm`. No rows, no state. Selecting the tab calls
`StyleEditor.open()`; other editors call `open(element, group)`. An editor may still name an element
by its svg group id (`regions`, `terrs`, `goodsIcons`); the editor derives the store key from the
layers registry, where a layer's own id, its element id and its declared children all address the
same style element, so there is no alias table to keep in step.

### Selection speaks the store

The element select lists `Object.keys(stylesSchema.shape)` by their layer label. An element with a
user `groups` record shows the group select, filled by `GROUP_SOURCES` (`dialogs.ts`) — each entry
with a count of the things using it (labels per group, burgs and ports, routes, lakes). A fixed
`groups` record is not a selection: its entries render inline as collapsible cards under the
element's own rows, so an element is seen whole. `burgIcons` is one user record whose entries hold
their own `icons` and `anchors` groups, so one group select serves both and the anchor rows are a
card inside the group.

`resolve` turns the selection into a store node, its schema subtree and a path
(`["labels", "groups", "capital"]`); a group that no longer exists falls back to the first.

### The form engine — `SchemaForm`

`src/components/shared/schema-form.ts` is generic: it takes any zod object schema, a value, a meta
registry, an `onChange`, and optional extra controls. It knows nothing of `styles`, `Layers` or
`pack` and is tested in jsdom against a mini schema.

- **Reading a field** unwraps `ZodDefault → ZodNullable → ZodOptional → ZodPipe` to the leaf, reads
  its meta and derives the control: boolean → checkbox, enum → select, bounded number → slider,
  number → number input, string → text; `meta.control` overrides.
- **Walking** iterates the shape in declaration order. `attrs` and `options` are flattened into the
  parent; a `groups` node is structural and renders one card per entry, recursively; any other object
  becomes a card — `<details data-section="options.contours">` with the title, the gate control and a
  preview slot in its `<summary>`. A gated card hides its body while the gate is `false | "off" |
"none"`. With `rootTitle` the element's own rows get a card too.
- **Rows** are `<div class="row" data-field="attrs.fill">` with a label and the control; the
  `data-field` path is relative to the rendered root, so it is stable across groups and is what the
  e2e specs address.
- **Null** — a nullable field shows `value ?? nullAs ?? ""`; clearing it emits `null` (never `""`),
  which `writeAttr` turns into `removeAttribute`. A non-nullable field never emits `null`.

The standard controls are checkbox, select, slider (`<slider-input>`), number, text and colour
(swatch + editable hex). Everything else is registered by the editor.

### Custom controls

`style-editor/controls.ts` adds the controls that need map knowledge or a format, each owning its
option source and any dialog it opens: `filter` (the map's `<defs>` filters), `font` (loaded
families plus the add-font dialog), `blur`, `dash` (a dash array the schema format is checked
against), `transform` (the compass placement as three sliders), `labelStyle` (shadow, letter case and
shift as four rows), `scheme` (heightmap colour schemes plus a gradient builder), `texture` (bundled
textures plus a URL dialog), `icon` (the burg / port icon picker) and `emoji` (markets, through the
icon selector). A composed control parses the stored string into parts and calls `set` with the whole
string back. `close` destroys whatever dialogs they opened.

### Effects

What happens after the store is written is declared in the schema as `effect` (`StyleEffect`, a
closed set of names) and run by `style-editor/effects.ts`.
`effectAt(path)` takes the effect declared nearest to the store path — on the field, else on a node
above it — and falls back to the store convention:

- an `attrs` path → `write`: `Styles.writeAttr(path)`, the one attribute onto its element, no redraw
- an `options` path → `draw`: `Layers.draw(layer)`, the renderer reads the store again

The declared ones: `draw` on an attr whose renderer bakes it into the drawing (the grid, rulers,
ocean waves and scale bar attrs, the legend and coordinates fonts, a label group's typography); `zoom`
on an attr the zoom derives from (the halo width): written, then the zoom re-run;
`regenerateRelief` for the relief icons (the icon size is a plain `draw`—it is a render multiplier).
A vignette option takes the
same `draw`: the renderer reshapes the defs mask and redraws the layer.
`effects.test.ts` asserts which name a path resolves to and which stub each name fires.

### Baseline and decoration

The current preset (`options.map.style.preset`, loaded through `StylePresetsService` and cached) is the
**baseline** the form is compared with (`baseline.ts`). A field is _changed_ when the preset defines
the path and its value differs; a path the preset never had (a label group added later) is never
marked. The `FormDecoration` class in `style-editor/index.ts` marks changed rows with an accent and a
per-field reset button (a reset writes the preset value through the normal change path, so its effect
runs), gives each card header a preview of its own rows by `style-editor/preview.ts`, and remembers
which cards the user folded for the session. The preview slot has a fixed height, so a header does not
move with what it shows: one chip carries the card's fill and stroke together, a card that sets a font
shows the map's own words in it, a colour scheme its ramp, a texture its image, a burg icon or emoji
the icon, a grid its own pattern tile, and a card that sets no colour of its own is sampled in the
theme's darkest tone at the card's opacity and width. A filter the card sets is applied to whatever the
preview draws and named in its tip, and a card whose gate is off is dimmed. A value written by a
control's own dialog (a font, an icon) refreshes the previews too. Edits update the marks in place;
nothing re-renders. There is no whole-element reset — selecting the preset again is that.

### Dialogs

`style-editor/dialogs.ts` holds the panels the tab opens, alongside the element and group listings
they share with the editor:

- **Elements dialog** — every element in the select's order with a visibility dot (a click toggles
  the layer), grouped elements expandable to their groups with counts, and a filter box.
- **Presets gallery** — a thumbnail per system preset, a neutral tile for customs, the current one
  outlined; a click goes through the same once-per-session confirmation as the select.
- **Burg icon dialog** — the icon sets from `src/data/burg-icons.ts`, drawn in the group's current
  fill and stroke; a pick applies and keeps the dialog open.

### The rows that are not fields

A handful of extras the editor appends by hand: the grid "Cell size" readout under `options.scale`,
the vignette preset select (assigns a ready-made look into `styles.vignette` and re-renders), and
`options.app.emblems.showAll` under emblems — an app preference, not style, but users look for it
there.

### Invariants and lifecycle

- **Every leaf has a control or is `hidden`** — `styles-schema.test.ts` walks the real schema with
  `styleMeta` and fails on a field with no known control kind, so a field cannot be added without UI.
- **No label longer than 13 characters** — the column shows it on one line.
- **Every preset parses** — the fifteen JSONs and the fixtures are validated in `styles.test.ts`.
- **Build on open, destroy on close.** `open` renders into `#styleForm`; `close` (leaving the tab)
  empties it and destroys the controls' dialogs, the elements dialog and the gallery.
- **The attribute snapshot stays identical.** The `style-parity` e2e baselines pin what a preset
  writes to the SVG, so a store or editor change that renders differently fails.

## Adding a style field

1. Declare it in `styles-schema.ts` with its meta — under `attrs` if it is an SVG attribute, under
   `options` if a renderer interprets it. Reuse a shared constant or `variant` one.
2. Give it a value in `default-styles.json`. Older presets and maps are repaired from the defaults
   on parse, so they keep working; give the system presets their own value where the look differs.
3. An attr needs nothing else. An option is read by its renderer from `styles.<element>.options`.
4. Give the field an `effect` in its meta only if the default (write the attr / redraw the layer) is wrong.
5. The form renders it; `styles-schema.test.ts` fails if the meta leaves it without a control.

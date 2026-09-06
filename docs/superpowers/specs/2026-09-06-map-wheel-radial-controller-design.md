# Design: Map Wheel — spin-out radial controller

Date: 2026-09-06
Status: approved design, ready for implementation planning
Design source: `~/Downloads/Radial options controller concepts/design_handoff_spin_out_wheel/`
(concept 3a, "Spin-out"; `README.md` is the fidelity spec, the standalone preview is the
behavioural spec)

## Purpose

Add a radial context controller to the map, opened on right-click at the pointer. It carries two
things at once: the actions for whatever was right-clicked, and the five global menus.

The defining behaviour is that **drilling into a submenu does not replace the ring**. Each level
fans a new ring outward from the sector that was picked; the picked sector stays solid dark, its
siblings fade back, and a spine connects parent to child. The whole route back to the centre stays
on screen, so there is no Back button and no lost place.

**This is additive.** The existing top bar (`#options` with its Layers / Style / Options / Tools /
About tabs) and the existing left-click-to-edit behaviour in `viewbox-events.ts` are unchanged.
The only edit to existing code is one added import line in `src/components/index.ts`.

## What already exists

Azgaar's `map-wheel-concept` branch (`upstream/map-wheel-concept`, cfe62964) already contains a
complete, working context resolver for exactly this problem:

- `src/components/map-wheel/context.ts` (595 lines) — resolves a right-click into a ranked stack of
  subjects and their real action lists, wired to `Controllers.*`.
- `src/components/map-wheel/wheel.ts` / `styles.ts` — a **single-ring, non-nesting** wheel. Not the
  spin-out design; discarded.

All 42 controllers `context.ts` names exist in this fork, and `Layers.isOn` exists. `context.ts` is
therefore ported, not rewritten. Its subject ranking is the piece we most want to keep:

1. **HIT** — how the point matched. Clicking a burg icon is intent; containing the point in a state
   is an accident of geography. (`direct` 30000 > `point` 20000 > `area` 10000 > `fallback` 0)
2. **VISIBLE** — whether the subject's layer is drawn (+5000). On a religions map a right-click is
   about religion even though the province is smaller.
3. **EXTENT** — how tightly the subject bounds the point, measured in cells actually covered
   (0..4999). A duchy beats the empire containing it.

Within a subject, actions are sorted by verb: `open` → `inspect` → `create` → `modify`, so the
first sector is always "the thing you meant" and the ring's shape is learnable.

## Architecture

New directory `src/components/map-wheel/`. Registered by adding `import "./map-wheel";` to
`src/components/index.ts`.

| File | Origin | Responsibility |
| --- | --- | --- |
| `context.ts` | ported from `upstream/map-wheel-concept` | Right-click → ranked `WheelSubject[]` with real action lists. |
| `menu-tree.ts` | new | The MENU channel tree, reconciled against real FMG (§ Menu tree). Pure data + `run()` thunks. |
| `geometry.ts` | new | Pure math: bands, span/start-angle, sector path, label position, spine endpoints, the two scale factors. No DOM. |
| `palette.ts` | new | Samples the app's theme variables into resolved colour strings, with the handoff as fallback and a 4.5:1 guard. No ring knowledge. |
| `wheel.ts` | new | The spin-out renderer: fold `path` → rings, spines, HTML label layer, hub, breadcrumb. |
| `drawer.ts` | new | The side drawer: host reparenting, row filtering, restore (§ Side drawer). |
| `styles.ts` | new | The handoff's token table, plus the drawer's scoped skin, as one CSS string. |
| `index.ts` | ported + extended | contextmenu binding, open/close, dismissal, viewport clamping. |

Boundaries: `geometry.ts` knows nothing about menus or colour; `palette.ts` knows nothing about
geometry; `menu-tree.ts` and `context.ts` know nothing about either; `wheel.ts` renders any `WheelNode[]` fold and is the only file that touches the DOM
for the ring; `drawer.ts` is the only file that moves existing app DOM, and owns its own restore.
This is what makes the geometry, the tree and the drawer independently testable.

### Shared node type

Both channels produce the same node shape, so the renderer has one code path:

```ts
interface WheelNode {
  label: string;
  icon: string;            // icon-* class from public/icons.css
  note?: string;           // third label line; also auto-filled with "▸" when children exist
  danger?: boolean;        // destructive: danger ink, danger hover fill
  toggle?: LayerId;        // layer toggle: green when on, note flips on/off, ring does not close
  pick?: number;           // HERE: index into ctx.subjects
  children?: WheelNode[] | (() => WheelNode[]);
  panel?: DrawerSpec;      // opens the side drawer instead of a child ring
  run?: () => void;        // leaf command
}
```

`children` may be a thunk so a ring is built only when opened (the layer rings read live state).
A node has exactly one of `children`, `panel`, `run`, `toggle` or `pick`; a unit test asserts this.

## Geometry

The handoff's table is the base, and two independent factors sit on top of it. Neither is a module
variable: `geometry.ts` stays pure and takes the scale as an argument (`bands(scale)`,
`sectors(level, count, parentMid, scale)`, `spineLine(level, parentMid, scale)`, `boxRadius(scale)`,
`outerRadius(scale)`, `drawerOffset(scale)`).

Four concentric base bands `[innerRadius, outerRadius]`:

| Level | Band | rMid |
| --- | --- | --- |
| 0 | `[58, 108]` | 83 |
| 1 | `[112, 158]` | 135 |
| 2 | `[162, 204]` | 183 |
| 3 | `[208, 246]` | 227 |

### Factor 1: the base radius multiplier (×1.2, radii only)

**A label is almost as wide as the arc it occupies.** At the base radii the worst case is the root
ring at 7 items: `2π·83/7` = 74.5px of arc for a 74px label. Scaling the whole dial does not help —
arc and label grow together and the ratio never moves. The fix is a **×1.2 multiplier on the band
radii alone**, with label widths, font sizes and icon sizes untouched:

| Level | items at cap | arc per label | label width |
| --- | --- | --- | --- |
| 0 | 7 | 89px | 74px |
| 1 | 11 | 87px | 66px |
| 2 | 15 | 86px | 66px |
| 3 | 19 | 85px | 66px |

`ITEM_CAPS` are unchanged: the caps are about how many labels fit, and the multiplier only adds
headroom. Measured in the browser on the 7-item HERE root: before, the worst pair of root labels
overlapped by 7.7px; after, they clear by 3.9px.

### Factor 2: uiSize (uniform)

The dial follows the app's own sizing control, read at open from `#uiSize` (a `<slider-input>`, so
`.value`), applied **uniformly** to radii, label widths, font sizes and icon sizes. Two clamps:

1. the raw uiSize (0.6..3) to `[0.8, 2]` — more than that is not a dial anchored at a click point;
2. again, so the rendered box never exceeds `min(innerWidth, innerHeight) - 32`.

Missing or unreadable uiSize is 1. The values that were constants elsewhere are published on
`.mw-wheel` as `--mw-ui`, `--mw-box` and `--mw-drawer-offset` so the stylesheet can size labels, the
hub and the drawer's offset from them.

SVG `viewBox="-R -R 2R 2R"` rendered `2R` square, where `R = boxRadius(scale)` = 307.2 at scale 1
(295.2 outer radius + 12 clearance for the hover growth and the shadow).
`filter: drop-shadow(0 10px 26px rgba(38,28,12,.35))`.

- **Depth is capped at 4 rings.** Deeper trees are restructured, never allowed to overflow.
- Level 0 spans the full circle: `span = 2π`, `startAngle = -π/2 - (span/n)/2`, so item 0 is centred
  on 12 o'clock.
- Levels 1+ span only the arc they need, centred on the parent sector's mid-angle:
  `span = clamp(n * 0.55, 1.4, π * 1.88)`, `startAngle = parentMid - span/2`. This is what makes
  depth read as a fan rather than a new full circle.
- Per-sector angular gap: `gap / outerRadius` radians each side, `gap = 3px`.
- Sector path is an annular wedge: `M innerStart → L outerStart → A(outer) → L innerEnd →
  A(inner, reversed) → Z`, large-arc flag set when the sweep exceeds π.
- Hover expansion: hovered sector's **outer** radius +5px. Inner radius never moves.
- Spine: for each level ≥ 1, a line at the parent's mid-angle from `BANDS[L-1][1]` to `BANDS[L][0]`,
  `stroke #4a3a22`, `stroke-width 3`, `stroke-linecap round`.

### Derived item caps

The handoff does not state a per-ring item cap, but its own geometry implies one. A label is 74px
wide at level 0 and 66px at levels 1+; a sector needs roughly 70px of arc at its mid-radius to hold
one without collision. Therefore:

| Level | arc available at rMid | max items |
| --- | --- | --- |
| 0 | `2π · 83` = 521px | **7** |
| 1 | `5.906 · 135` = 797px | **11** |
| 2 | `5.906 · 183` = 1081px | **15** |
| 3 | `5.906 · 227` = 1341px | **19** |

These caps are enforced by a unit test over the menu tree, not merely documented. They are also why
the menu tree below is grouped the way it is. The base radius multiplier above turns each of these
into real headroom rather than a dead heat.

### Root overflow rule

The HERE root must hold the subject's actions *and* the trailing "What's here" sector inside 7
slots. The renderer enforces this generically rather than by trimming `context.ts`:

- reserve the last root slot for "What's here";
- if `actions.length > 6`, show the first 5 and put the remainder behind a **"More…"** sector whose
  children open at level 1.

This keeps the ported `context.ts` untouched and survives future growth in any subject's action
list. (Today only the Cell subject overflows: 7 actions.)

## State

Five variables, held in a closure per open wheel — not globals, and not persisted:

- `mode: "here" | "menu"` — which hub tab is active. **Every open starts on `menu`**: the five
  global menus are what most right-clicks are after, and the subject stack is resolved on open
  regardless, so HERE is fully populated the moment the hub is clicked.
- `path: number[]` — chosen sector index per open level. `[]` = root only. Length is drill depth,
  capped at 4.
- `subject: number` — index into `ctx.subjects`, the active entity (drives the HERE root).
- `hot: {level, index} | null` — hovered sector.
- `drawer: DrawerSpec | null` — the open drawer, if any.

**Deviation from the handoff, deliberate:** the handoff's fifth variable is
`layers: Record<string, boolean>`. Here that is real app state, so the wheel holds no copy. Layer
sectors read `Layers.isOn(id)` at build time and call the registry's toggle on click. The green
sectors therefore show the genuine layer state and stay correct if a layer is toggled from the top
bar while the wheel is open. `permanent` layers (`ocean`, `landmass`, `coastline`, `fogging`, `debug`, `legend`)
have no off state and are excluded from the toggle rings entirely.

Rendering is a pure fold: start from the root node list, walk `path`, emit one ring per level,
carrying the parent's mid-angle forward as the next ring's centre.

**Structural changes redraw; hover does not.** A change to `mode` or `path` rebuilds the whole DOM —
at most ~50 sectors are on screen, so diffing would buy nothing and would cost the clarity of "the
DOM is a function of the state". `hot` is the deliberate exception: it mutates the hovered sector's
`d` and `fill` and its label's colour in place, from values precomputed per sector at build time.
Rebuilding for hover is not merely wasteful, it is *unusable*: the rebuild deletes the very element
under the pointer, the browser fires `mouseleave` on the removed node and `mouseenter` on its
replacement, and that rebuilds again — a self-sustaining loop (measured at ~62 events/second with
the pointer held completely still) that restarts the entry animation every frame (so the ring never
becomes visible) and means no `mousedown`/`mouseup`/`click` ever lands on a sector. Hover therefore
has its own channel, `onHot`, which the renderer's returned handle applies; the keyboard's arrow
keys use the same channel, so mouse and keyboard share one non-destructive path. `hot` stays in the
state object because the keyboard reads it to know where the cursor is.

## Side drawer

Some of FMG is not a menu. The Style tab is a live form over `#styleElementSelect`; the Options tab
is 27 setting rows; About is prose. None of that can become sectors. A third node kind handles it:
a **drawer** that fans out from the side of the dial.

A `panel` node suppresses the child ring — the drawer *is* the child. Its sector stays solid dark
like any chosen ancestor and its siblings dim, exactly as for an open child ring. A 3px `#4a3a22`
connector runs **from the chosen sector's outer mid-point to the nearest point on the drawer's near
edge**, in the same spine language as the rings, so the drawer reads as belonging to that sector
rather than floating over the map. (The connector cannot simply follow the sector's mid-angle: the
drawer is a rectangle on one side, and a sector at 10 o'clock with the drawer on the right would
point away from it. Nearest-point keeps the tie legible for every sector position.)

### Placement

- 14px clear of the outer radius, so the near edge sits at `centre ± drawerOffset(scale)` — 309.2px
  at scale 1. Published as `--mw-drawer-offset`.
- Width 340px; height `min(560px, 100vh - 32px)`; vertically centred on the wheel centre and
  clamped to the viewport. The drawer hosts the app's real forms, so unlike the ring it does **not**
  scale.
- Side is chosen by the sector that opened it: the half the sector points into (`cos(mid) >= 0` →
  right), so the drawer fans out the way the sector is already aiming. That choice is overridden to
  the other side when the preferred side lacks room **where the wheel already sits** — giving up the
  sector's direction is cheaper than dragging the ring across the map. When neither side has room
  the wheel has to re-clamp regardless, and the sector's direction wins after all. When the sector
  points near-vertically (`|cos(mid)|` below 0.2) side is decided by room alone, ties going right.
  Chosen once per drawer open and never flipped while open.
- The wheel's own viewport clamping accounts for the drawer, so wheel + drawer are clamped as one
  bounding box.
- Animation: 140ms slide-and-fade outward from the wheel edge, matching the ring stagger. Respects
  `prefers-reduced-motion`.

### Chrome

Ground `--bg-light` — the same variable `#options` uses, so the drawer reads as the app's own panel —
with a `--dark-solid` border, 4px radius,
`box-shadow: 0 10px 26px rgba(38,28,12,.35)` — the same shadow as the wheel, so they read as one
object. Header bar on `--bg-lighter`: title in IBM Plex Sans 12px/600, uppercase,
`letter-spacing .09em`, in the accent ink, with a `✕` at the right. Body scrolls (`overflow-y: auto`,
`scrollbar-width: thin`).

### Content mechanism: reparent, filter, restore

```ts
interface DrawerSpec {
  host: string;    // id of the live element to host, e.g. "optionsContent"
  title: string;
  only?: string[]; // control ids; rows not containing one of these are hidden
}
```

1. **Open** — record the host element's parent and `nextSibling`, then append it into the drawer
   body.
2. **Filter** — when `only` is given, for each control id resolve `findEl(id)?.closest("tr")` and mark
   every *other* row in the host `hidden`, remembering exactly which elements we set. A section
   heading whose entire table ends up hidden is hidden too. Nothing moves within the table, so row
   order cannot be disturbed.
3. **Skin** — a CSS block scoped to `#mapWheelDrawer` (see below). Scoped, so top-bar rendering is
   untouched.
4. **Close** — clear every `hidden` we set, then reinsert the host at its recorded
   `parent.insertBefore(host, nextSibling)`. This runs before anything else in `close()`.

**Why reparent rather than clone or rebuild.** FMG's option and style wiring is `findEl()`/`getElementById` lookups
with listeners bound at init. A clone is dead DOM. A rebuild duplicates ~27 option rows and the
whole style form, and will drift from the originals. Reparenting keeps one source of truth and
guarantees behavioural parity; "modern" is then delivered by the skin, over the real controls.

### The skin

Scoped to `#mapWheelDrawer`, using the wheel's tokens:

- `.tabcontent { display: block }` — the host is hidden by the tab system in its normal home.
- `table, tbody, tr, td { display: block }`; each `tr` becomes a stacked field: label over control,
  `padding: 9px 0`, hairline `rgba(90,74,48,.16)` separator.
- Labels 12px/1.4, ink `#3b3226`. **Each row's `data-tip` is surfaced as a permanent hint line**
  beneath the control at 10.5px, `opacity .68` — the information already exists on every row and is
  currently hover-only.
- `input[type=range]`: 3px `rgba(90,74,48,.22)` track, 13px `#6b5535` thumb.
- `select`, `input[type=number]`, `input[type=text]`: parchment ground, 1px `edge` border, 3px
  radius, 12px type, full width.
- `input[type=color]`: 26px swatch, `edge` border, 3px radius.
- Checkboxes follow FMG's existing `.checkbox` convention — raw checkboxes are hidden app-wide, so
  the skin must style the label, not the input.

### Consumers

| Node | host | filter |
| --- | --- | --- |
| Style → Style editor | `styleContent` | none |
| Options → World / Realms / Peoples / Identity / Interface / Behaviour | `optionsContent` | per group, below |
| About | `aboutContent` | none |

Only one drawer is open at a time; opening a second closes the first (restoring its host) before
hosting the next.

## Menu tree

The prototype's MENU tree is placeholder content (8 layers, 4 tools). Real FMG has 39 registered
layers, 27 option rows and 54 tool buttons, so the tree below is the reconciliation against the
actual codebase. Every ring is within its level's cap and no branch exceeds depth 4.

### MENU root (level 0, 5 items)

`Layers` · `Style` · `Options` · `Tools` · `About`

### Layers (8 at L1)

33 toggleable layers (39 registered minus the 6 `permanent` ones), plus presets and an ordering
escape hatch:

| Group | Members |
| --- | --- |
| Presets | the 13 `#layersPreset` options: political, cultural, religions, provinces, biomes, heightmap, physical, poi, goods, trade, military, emblems, landmass |
| Terrain | heightmap, relief, biomes, rivers, lakes, ice, texture |
| Political | states, provinces, borders, burgIcons, emblems, military, zones |
| Cultural | cultures, religions, labels, markers |
| Economy | routes, goods, markets, trade, population, journeys |
| Climate | temperature, precipitation |
| Overlay | grid, coordinates, compass, scaleBar, vignette, cells, rulers |
| **Reorder layers…** | leaf — opens the Layers tab |

Toggle sectors are the design's live-status case: clicking flips the layer, the sector turns
`#8a9c6c`, the note flips `on`/`off` **in place**, and the ring neither changes nor closes. The
wheel therefore doubles as the layer panel's status display.

**Layer order is deliberately not on the dial.** Ordering in FMG is expressed by drag position in
the `#mapLayers` list — a linear, spatial gesture with no radial equivalent. Rather than invent a
worse one, `Reorder layers…` hands off to the existing UI.

### Style (4 at L1)

The prototype's `Fonts` / `Colours` / `Filters` children do not exist as menus in FMG. Substituted
with what is real:

- `Presets` → the 11 files in `public/styles/`: ancient, atlas, clean, cyberpunk, darkSeas, gloom,
  light, monochrome, night, pale, watercolor
- `Style editor` → **drawer** hosting `#styleContent`
- `Save as preset` — `#addStyleButton`
- `Remove preset` — `#removeStyleButton`, destructive

### Options (10 at L1)

Six themed drawers over `#optionsContent`, plus four non-form entries. All 27 setting rows are
assigned exactly once — a unit test asserts the partition is total and disjoint.

| Group | Rows (anchor control id) |
| --- | --- |
| World | `mapWidthInput`, `pointsInput`, `templateInput`, `optionsSeed` |
| Realms | `statesNumber`, `provincesRatio`, `sizeVariety`, `growthRate`, `manorsInput` |
| Peoples | `culturesInput`, `culturesSet`, `religionsNumber` |
| Identity | `mapName`, `yearInput`, `emblemShape` |
| Interface | `uiSize`, `tooltipSize`, `themeHueInput`, `transparencyInput`, `azgaarAssistant` |
| Behaviour | `autosaveIntervalInput`, `onloadBehavior`, `speakerVoice`, `zoomExtentMin`, `shapeRendering`, `viewportRedraw`, `resetLanguage` |

Plus: `Units` (`#editUnitsButton`) · `World configuration` (`#configureWorld`) ·
`File` → `New map` / `Save` / `Load` / `Export` · `Reset options` (`#optionsReset`, destructive).

Hotkeys are a wiki page in FMG, not a dialog, so the prototype's `Hotkeys` entry is dropped rather
than faked.

### Tools (5 at L1)

| Branch | Contents |
| --- | --- |
| `Edit` (15 at L2) | Biomes, Coastlines, Cultures, Diplomacy, Emblems, Goods, **Heightmap**, Measurers, Namesbase, Notes, Provinces, Religions, States, Trade, Zones |
| `Overview` (10 at L2) | Burgs, Markers, Markets, Labels, Military, Rivers, Routes, Journeys, Cells, Charts |
| `Add` (5 at L2) | Burg, Label, Marker, River, Route |
| `Regenerate` (3 groups at L2, 19 commands split 4/9/6 at L3) | *Terrain*: Rivers, Relief, Ice, Zones · *Society*: Cultures, Religions, States, Provinces, Burgs, State Labels, Population, Military, Emblems · *Economy*: Economy, Goods, Markets, Production, Routes, Markers |
| `More` (5 at L2) | Minimap, AI Chat, Submap, Transform, Reset zoom |

Heightmap stays under `Edit`: it is where the heightmap is edited and adjusted, not a mode toggle
filed under miscellany. Only `Units` moves out of the flat Tools grid, to Options where it belongs,
which puts `Edit` at 15 — exactly the level-2 cap.

Regenerate sits one level deeper than the other branches. That is intentional as well as
geometrically necessary: these are the destructive commands, and depth is the right cost for them.
Every regenerate leaf is marked `danger`.

### About (leaf)

Opens the drawer hosting `#aboutContent`.

### Binding rule

A leaf calls `Controllers.<Name>.open()` where a controller exists, and
`findEl("<buttonId>")?.click()` for the legacy top-bar buttons that have no controller (all
`regenerate*`, the presets, the file operations). The wheel never reimplements a feature — it is a
second route to the one that already exists. A unit test asserts every leaf resolves to a real
`Controllers` key or an id present in `src/index.html`, which is what stops the tree silently
drifting from the app.

## HERE channel

Root = the active subject's actions (already verb-sorted by `context.ts`), subject to the root
overflow rule, plus a trailing **What's here** sector. Its note is the subject count; its children
are the full ranked subject stack with each subject's `kind` as the note line. Picking one sets
`subject`, switches the hub to HERE and resets `path` to root.

The subject stack for a single click can reach 9 (burg, province, state, market, culture, religion,
biome, river, cell), inside the 11-item cap at level 1.

## Interaction

Click on a sector, in this order:

1. **Layer toggle** — flip the layer. Sector turns green, note flips in place, ring does not change
   or close.
2. **Entity pick** — set the active subject, switch to HERE, reset path.
3. **Panel** — truncate `path` to this level, append this index, open the drawer. No child ring.
   Clicking the same sector again closes the drawer and collapses, exactly like an ancestor.
4. **Has children** — open a child ring. If this sector is already the chosen one at its level,
   clicking again **collapses** back to that level. Otherwise `path` is truncated to this level and
   this index appended — which is what lets clicking a faded sibling swap branch at that level
   without disturbing the levels below.
5. **Leaf** — close the wheel, then fire the command. (The prototype's toast is a stand-in for
   exactly this; there is no toast in production.)

Other behaviour:

- Hover: fill/ink per the table below, outer radius +5px, 120ms transition; clears on `mouseleave`.
  Applied by mutating the existing sector and label, never by redrawing (see *Structural changes
  redraw; hover does not* above). The label keeps the band's mid-radius when its sector grows, so
  the text never moves out from under the pointer.
- Clicking a dark ancestor collapses to it; clicking breadcrumb *n* truncates `path` to depth *n*.
  Either closes an open drawer below that depth.
- HERE / MENU tab click switches channel, resets `path` and closes any drawer.

### Production behaviour not in the prototype

All in scope:

- Open on **right-click** at the pointer position. Suppressed while `customization` is active and
  while a journey path is being drawn — both already claim right-click
  (`journey-path-editor.ts:133,164`).
- **Dismiss** on Escape, on outside `pointerdown`, on map pan or zoom, and on window blur. An open
  drawer is part of the wheel for hit-testing: a pointerdown inside it is not "outside".
  The host is `position: fixed; inset: 0` so the ring can be centred anywhere in the viewport, which
  means it **must** be `pointer-events: none`: otherwise it covers the whole application, every
  pointerdown lands inside it and "outside" is never true. The interactive parts opt back in with
  `pointer-events: auto` — `.mw-sector`, `.mw-tab`, `.mw-crumb` and the whole of `#mapWheelDrawer`,
  so the real controls it borrows stay usable. Labels (`.mw-label`) stay `none` by design.
- **Viewport clamping**: a wheel opened near an edge is offset so it stays fully visible; with a
  drawer open, wheel and drawer clamp as one box. The centre moves; the ring is never rotated. A
  marker at the true click point keeps the anchor visible when the wheel is offset.
- **Open animation**: staggered outward scale/fade, child rings animating outward from the parent
  sector's mid-angle, ~140ms per ring, so the fan reads as motion. Respects
  `prefers-reduced-motion`.
- **Keyboard**: left/right steps within a ring, out/in crosses rings, Enter commits, Escape closes
  the drawer if open, else the wheel.

## Visual specification

**The wheel follows the app's live theme.** `changeDialogsTheme()` (public/modules/ui/options.js)
writes the user's palette onto `document.documentElement` as custom properties whenever the theme
hue, colour or transparency sliders move, and runs once at startup from `applyStoredOptions`. The
wheel samples those; the handoff's parchment is the fallback for every one of them, so a build that
has published no theme is pixel-identical to the original design.

Fills and ink, in priority order:

| Condition | Fill | Ink |
| --- | --- | --- |
| Chosen ancestor (its child ring or drawer is open) | `--dark-solid` (`#4a3a22`) | `--light-solid` (`#fffdf7`) |
| Hovered | `--header-active` (`#6b5535`); **`#a33a2e` if destructive** | `--light-solid` (`#fffdf7`) |
| Layer toggle that is ON | **`#8a9c6c`** | **`#20261a`** |
| Dimmed sibling | `--light-solid` at .82 (`rgba(251,247,236,.82)`) | `--dark-solid` at .82 (`rgba(59,50,38,.82)`) |
| Default | `--light-solid` at .97 (`rgba(251,247,236,.97)`) | `--dark-solid` (`#3b3226`) |
| Destructive, not hovered | default fill | **`#8d2f24`** |

Stroke `--dark-solid` at .32; dimmed at .16. `transition: fill 120ms`.

The bold entries are **deliberately not themed**: the danger red and the layer-on green carry
meaning rather than style, and a hue slider must not be able to turn "this deletes things" into the
same colour as everything else.

Hub, breadcrumb and drawer follow the same theme through the stylesheet: hub active tab
`--header-active`, inactive `--light-solid`; breadcrumb on `--bg-lighter` with `--dark-solid` ink;
drawer ground `--bg-light` (the variable `#options` itself uses), header `--bg-lighter`, border
`--dark-solid`.

**How, and why not `var()` everywhere.** Sector fills are SVG *presentation attributes* written with
`setAttribute("fill", …)`, and a presentation attribute does not accept `var()` — it silently
renders black. `palette.ts` therefore resolves the variables to literal colour strings once per
build and feeds them into the renderer's existing precomputed hover skins; the stylesheet-side
chrome uses `var()` directly, reading the same sampled palette back off `.mw-wheel` as `--mw-*`
properties. The palette is sampled per build rather than watched: the wheel is transient and closes
on an outside pointerdown.

**Accessibility:** dimmed siblings remain full click targets ("swap branch at this level"), so their
ink stays at ≥4.5:1 — do not fade further than the `.82`/`.82` pair. De-emphasis comes from the
solid dark ancestor, not from making siblings unreadable. Following the theme cannot be allowed to
break that: FMG's own `--dark-solid` on `--light-solid` is **2.5:1** at the default theme colour
(#997787). Every ink the wheel computes is therefore held to 4.5:1 over the fill it sits on, moving
only its lightness toward black or white and keeping the theme's hue. With no theme published the
handoff's colours already clear the bar and the guard is a no-op.

### Labels

Labels are **HTML**, not SVG text — absolutely positioned divs in a sibling layer with
`pointer-events: none`, so text never intercepts clicks and gets normal wrapping. Hit-testing is
done by the SVG `<path>` underneath.

- Position `(cos(mid) · rMid, sin(mid) · rMid)`, `translate(-50%,-50%)`.
- Width 74px at level 0, 66px at levels 1+. Column flex, centred, `gap: 2px`, `line-height: 1.15`.
- Font: IBM Plex Sans, 10.5px at level 0, 9.5px at levels 1+.
- Icon above the label: **FMG's own `icon-*` set from `public/icons.css`**, 19px at level 0, 16px at
  levels 1+.
- Every one of those lengths is `calc(<base> * var(--mw-ui, 1))`, so they follow uiSize with the
  radii. They do **not** carry the ×1.2 base multiplier — that is the whole point of it. (The prototype uses Material Symbols; substituted per the handoff's own instruction, to
  avoid a Google Fonts dependency in the desktop build and a second icon vocabulary.)
- Optional third line: 8.5px, `opacity .68`, `letter-spacing .05em` — `on`/`off` for layer toggles,
  the subject kind under an entity name, the subject count, and `▸` on any sector with children.

### Hub

104×104 circle, `overflow: hidden`, `border-radius: 50%`, `pointer-events: none` on the wrapper with
`auto` on the two tabs. `box-shadow: 0 0 0 1px rgba(90,74,48,.4), 0 6px 16px rgba(20,14,4,.35)`.
Split into two equal stacked tabs, **HERE** over **MENU**. Tab type IBM Plex Sans 10px/600,
`letter-spacing .1em`, uppercase, centred. Active tab `#6b5535` on `#fffdf7`; inactive
`rgba(251,247,236,.94)` on `#6b5535`; `transition: background 120ms`.

### Breadcrumb

Top-left of the overlay bounds, `left 18px / top 16px`. IBM Plex Sans 11px, `letter-spacing .04em`,
colour `#6b5535`, background `rgba(251,247,236,.86)`, padding `6px 11px`, radius 3px, border
`1px solid rgba(90,74,48,.25)`. Clickable (`pointer-events: auto`). Last crumb `#3b3226`/600,
earlier `#8a7248`/400, separator `›` at `opacity .45`, margin `0 5px`.

### Tokens

The fallbacks, used verbatim when the app has published no theme. Colours: parchment `rgba(251,247,236,.97)` · parchment-dim `rgba(251,247,236,.82)` · ink `#3b3226` ·
ink-dim `rgba(59,50,38,.82)` · brown `#6b5535` · brown-deep `#4a3a22` · brown-mid `#8a7248` ·
danger `#a33a2e` · danger-ink `#8d2f24` · layer-on `#8a9c6c` · layer-on-ink `#20261a` ·
ink-light `#fffdf7` · shell `#2b2519` · shell-ink `#f3ead6` · edge `rgba(90,74,48,.32)` ·
edge-dim `rgba(90,74,48,.16)`.

Typography: IBM Plex Sans at 8.5 / 9.5 / 10 / 10.5 / 11 / 12px. The display face (Spectral) is not
needed — the hub in this concept carries tab type only, not entity names.

## Error handling

- `resolveContext` returns `null` when there is no `pack.cells.p` or the point resolves to no cell
  (no map loaded, click outside the map). The wheel does not open; right-click falls through to the
  browser default.
- A subject whose backing object was removed between resolve and click (`burg.removed`, a deleted
  river) is already filtered at resolve time. A leaf whose controller throws is caught at the call
  site so a broken action closes the wheel rather than stranding an overlay over the map.
- `menu-tree.ts` binds legacy buttons through `findEl(id)?.click()` — optional chaining, so a button
  hidden or absent in a given build is a no-op, not a crash. The unit test is what catches the
  missing id at development time.
- **Drawer restore is the critical path.** While a drawer is open, its host element is out of
  `#options`; if the top-bar Style tab were opened in that window it would render empty. Guards:
  `close()` restores the host before anything else; the wheel already closes on outside
  `pointerdown`, which includes the top bar; and a `visibilitychange` listener restores as well.
  Restore is idempotent and tolerates the recorded `nextSibling` having been removed (falls back to
  appending to the recorded parent).
- The wheel removes itself, its drawer and all its window listeners in one `close()`; opening twice
  closes the first. Listeners are registered on `window` with `capture`, matching upstream's
  `index.ts`.

## Testing

**Unit (vitest, no DOM):**

- `geometry.test.ts` — sector path shape; large-arc flag set exactly when the sweep exceeds π; root
  start angle centres item 0 on 12 o'clock; child span clamp at both ends (`n·0.55`, floor 1.4,
  ceiling `π·1.88`); gap converted to radians per level; spine endpoints; band table; depth cap.
  Plus the two scale factors: `bands()` applies ×1.2 and nothing else, every radius scales
  uniformly, `sectors(…, 1)` is identity, a 3px gap stays 3px as the dial grows, every ring at its
  cap has more arc per label than the label is wide, and `wheelScale` clamps to `[0.8, 2]` and then
  again to the viewport.
- `palette.test.ts` — the fallback palette is byte-identical to the handoff when no theme is
  published; the app's variables are followed when they are; danger and layer-on stay literal; every
  ink clears 4.5:1 over its own fill, dimmed siblings included, and dimming stops at `.82`/`.82`.
- `menu-tree.test.ts` — every ring within its level's item cap; no branch deeper than 4; every node
  has exactly one of `children`/`panel`/`run`/`toggle`/`pick`; every leaf resolves to a real
  `Controllers` key or an id present in `src/index.html`; every `toggle` names a real,
  non-`permanent` `LayerId`; the 33 toggleable layers each appear exactly once; the six Options
  theme groups partition all 27 rows exactly once, with the expected row count DERIVED from src/index.html rather than hardcoded, and every anchor id present there.
- Root overflow rule: a 7-action subject produces 5 actions + `More…` + `What's here`.

**Integration (vitest + jsdom):**

- `drawer.test.ts` — open reparents the host into the drawer; `only` hides exactly the complementary
  rows; close clears every `hidden` it set and reinserts the host at its original `nextSibling`;
  restore is idempotent; restore still works when the recorded `nextSibling` has been removed;
  opening a second drawer restores the first host before hosting the next.

**Browser (Playwright, own server on :5199 per the fork's convention — never 5173):**

- Right-click on the map opens the wheel at the pointer; Escape closes it; outside click closes it;
  a zoom closes it.
- `MENU → Layers → Political → Borders` flips the real layer: `Layers.isOn("borders")` changes and
  the sector's fill becomes `#8a9c6c` without the ring closing.
- Drilling to depth 4 renders 4 rings with 3 spines; clicking a faded sibling swaps branch and
  leaves the deeper ring's parent chain consistent; clicking the dark ancestor collapses.
- `MENU → Options → Realms` opens the drawer showing exactly the five Realms rows; changing
  `statesNumber` in the drawer updates the same value the top-bar Options tab shows after close.
- Closing the wheel with a drawer open leaves `#optionsContent` back inside `#options` in its
  original position, and the top-bar Options tab renders normally.
- Right-click near a viewport corner keeps wheel and drawer on screen together.
- Right-click while `customization` is active does not open the wheel.
- Every root label on the 7-item HERE root gets more arc than it is wide, and no two of them
  overlap — measured on the laid-out labels, which is the only place that can be settled.
- The box grows with uiSize and is capped at `min(innerWidth, innerHeight) - 32` at the extreme,
  staying wholly on screen at every size.

## Out of scope

- Any change to the top bar, the existing options panel, or left-click behaviour.
- Rebuilding any option or style control. The drawer hosts the real ones.
- Layer reordering on the dial — it hands off to the existing list.
- Touch / long-press opening (right-click only for this iteration).
- Persisting wheel state across opens — every open starts at MENU-or-HERE root.
- Making the wheel a replacement for the top bar. It is a second route in, permanently.

## Risks and open items

- **Drawer restore.** The highest-risk part of this design: app DOM is temporarily relocated. The
  guards and the idempotent restore above are the mitigation, and the jsdom test is what keeps them
  honest. If restore proves fragile in practice, the fallback is to host a `<slot>`-style wrapper
  that leaves a placeholder node in `#options`.
- **Controller signatures.** All 42 controller names `context.ts` references exist in this fork, but
  their argument shapes were not verified. The port may need fixes at compile time; `tsc --noEmit`
  is the gate.
- **`context.ts` provenance.** It is ported from Azgaar's branch. If this fork later syncs that
  branch, the port must be reconciled rather than duplicated.
- **Icon coverage.** `context.ts` names icons like `icon-drafting-compass`, `icon-balance-scale`,
  `icon-handshake-o`. These come from Azgaar's branch so they should exist in `public/icons.css`,
  but the menu-tree's new entries need icons chosen from what is actually in that file.
- **Skin coverage.** The drawer skin must handle every control type present in the three hosts.
  FMG hides raw checkboxes app-wide (`class="native"` / `.checkbox`), so the skin styles the label,
  not the input — getting this wrong makes checkboxes invisible in the drawer.
- **`public/` edits.** If any asset under `public/` is touched, `npm run stamp-assets` must run
  (fork CI gate). This design does not expect to touch `public/`.

## Branch

`feat/map-wheel` off `origin/main`, in a git worktree. The `feat/climate-rework` checkout is not
disturbed.

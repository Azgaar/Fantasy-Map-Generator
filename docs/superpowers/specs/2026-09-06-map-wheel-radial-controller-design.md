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
| `geometry.ts` | new | Pure math: bands, the label metrics they are sized to, span/start-angle, sector path, label position, spine endpoints, the parent tick, uiSize scaling. No DOM. |
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
  note?: string;           // third label line, for a note that says something (see § Labels)
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

`geometry.ts` stays pure and takes the scale as an argument (`bands(scale)`,
`sectors(level, count, parentMid, scale)`, `spineLine(level, parentMid, scale)`, `boxRadius(scale)`,
`maxOuterRadius(scale)`, `openOuterRadius(level, scale)`, `drawerOffset(level, scale)`,
`markPath(mid, outer, scale)`).

**Two different outer radii, and keeping them apart is load-bearing.** The SVG box is sized for the
deepest drill the wheel *could* reach (`maxOuterRadius` = level 3's outer edge, 355), because a box
that resized as rings opened would relayout the dial under the pointer. But only the rings actually
open are drawn, so everything anchored to the *ring* — the drawer and the breadcrumb — hangs off
`openOuterRadius(level)`, the outer edge of the outermost open ring. Anchoring chrome to the maximum
put a two-ring wheel's drawer 156px past where the ring visibly ends (measured in the browser) and
its breadcrumb in the corner of the screen.

Four concentric bands `[innerRadius, outerRadius]`, at uiSize 1:

| Level | Band | depth | rMid | fit it must clear |
| --- | --- | --- | --- | --- |
| 0 | `[58, 130]` | 72 | 94 | 70.41 |
| 1 | `[135, 205]` | 70 | 170 | 68.06 |
| 2 | `[210, 280]` | 70 | 245 | 68.06 |
| 3 | `[285, 355]` | 70 | 320 | 68.06 |

### The band depths are solved for the labels, and that is the whole of it

The handoff's `[58,108] … [208,246]` table (depths 50/46/42/38) came with no statement of what a
band had to hold, and the first sizing pass measured only label WIDTH against the sector's ARC.
**A label is an upright box centred on the band's mid-radius, so how much of the band's RADIAL depth
it eats depends on where the sector points**: the widest text LINE at 3 o'clock, the whole STACK
(icon, up to two text lines, an optional note) at 12 o'clock, and a mix of the two in between.
Nothing checked the radial direction, and a ×1.2 multiplier on the radii could not fix it — it grew
the arc, which was never the binding constraint. Measured over every label placement in the tree,
**157 of 882 had ink outside their own sector**, worst 9.5px on `World configuration`.

The maximum over all angles has a closed form, and it is what the band table is solved against. For
an ink box of half-width `a` whose furthest edge is `reach` from the label's centre, the radial
half-extent at sector angle `t` is `a·|cos t| + reach·|sin t|`, whose maximum over `t` is
`hypot(a, reach)` — larger than either axis alone, and reached at an angle in between. The label's
centre sits on the mid-radius, so that maximum *is* the distance from the mid-radius to the furthest
ink, and the requirement is exactly

    for every ink box in the stack:  2 · hypot(a, reach)  ≤  bandDepth(level)

`labelRects(level)` enumerates those boxes — the icon, each text line, the note — and `labelFit`
takes the maximum; a unit test holds every band to it. Both sides scale with uiSize, so asserting it
once at scale 1 settles every size. Four levers made the numbers work:

1. **The "▸" note came out of the text stack** and became a tick drawn in the SVG at the sector's
   outer edge (`markPath`, `MARK_SIZE`/`MARK_CLEAR`). Every parent sector used to spend a whole line
   of the band's depth saying it had children. Notes still render as text where they say something:
   a layer's `on`/`off`, a subject's kind, the subject count — and a sector with both gets both,
   since the tick says "this opens a ring" and the note says what the sector is.
2. **The label is bounded structurally**, which is what lets the bound be stated over ink boxes at
   all rather than over the strings the tree happens to hold today: the text is clamped to
   `LABEL.lines` (2) with an ellipsis, a word longer than the label breaks
   (`overflow-wrap: anywhere`, `hyphens: auto`) instead of spilling, and the note is capped at
   `LABEL.noteWidth` (65%) of the label with an ellipsis. The bound then takes every text line at
   the FULL label width, because a broken word is exactly that wide — and the HERE channel labels
   sectors with generated names (`Confederation of …`) that do break.
3. **One label width for every level** — `LABEL.width` = 62, replacing 74/66. The root keeps its
   larger font and icon; only the width is shared. 62 is not free choice either: it is the width at
   which the longest word in the tree (`Monochrome`, 61.7px at the deep font) still sets on one line,
   and a label narrower than its longest word breaks that word across two lines with a letter
   stranded on the second.
4. **The band depths satisfy the bound**, with the note's width cap (lever 2) trimming what they had
   to be: the note sits at the end of the stack, so its `reach` is the largest in the label and its
   width is what the depth pays for. Two labels were shortened rather than paid for in radius:
   `World configuration` → `Configure world` (the button's own words) and the market action
   `Trade animation` → `Animate trade`.

`LABEL` lives in `geometry.ts` beside the band table, and `styles.ts` writes those very numbers into
the stylesheet, so the two cannot drift. Every band clears its `labelFit` by at least 1.59px (the
root's second text line is the binding box), and a browser measurement over the whole tree agrees:
**zero ink outside any sector at uiSize 0.8, 1 and 2**, tightest measured clearance 2.75px, and no
word broken mid-word.

The cost is size: the box is 722px at uiSize 1, so on a viewport shorter than ~754px the second
clamp scales the dial down rather than growing it with uiSize. That is the right trade — the clamp
scales radii and labels together, so the fit above is a ratio it cannot break, whereas a shallower
band breaks it outright.

### uiSize (uniform)

The dial follows the app's own sizing control, read at open from `#uiSize` (a `<slider-input>`;
either `.value` or `.valueAsNumber` works, both are implemented and both are used elsewhere in the
app), applied **uniformly** to radii, label widths, font sizes and icon sizes. Two clamps:

1. the raw uiSize (0.6..3) to `[0.8, 2]` — more than that is not a dial anchored at a click point;
2. again, so the rendered box never exceeds `min(innerWidth, innerHeight) - 32`.

Missing or unreadable uiSize is 1. The values that were constants elsewhere are published on
`.mw-wheel` as `--mw-ui`, `--mw-box` and `--mw-drawer-offset` so the stylesheet can size labels, the
hub and the drawer's offset from them.

SVG `viewBox="-R -R 2R 2R"` rendered `2R` square, where `R = boxRadius(scale)` = 361 at scale 1
(355 outer radius + 6 clearance for the hover growth; the shadow is drawn outside the box, which is
`overflow: visible`). `filter: drop-shadow(0 10px 26px rgba(38,28,12,.35))`.

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
- Parent tick: a 4px triangle pointing outward, 2px inside the band's outer arc, on **any** sector
  that opens a child ring — a note line does not replace it, since the two say different things.
  Filled with the sector's ink and repainted with it on hover. This is the affordance the "▸" note
  line used to carry, at no cost in the band's depth.
- Spine: for each level ≥ 1, a line at the parent's mid-angle from `BANDS[L-1][1]` to `BANDS[L][0]`,
  stroke `--dark-solid` (`#4a3a22`), `stroke-width 3`, `stroke-linecap round`. Rings only: the
  drawer has no connector (see § Side drawer).

### Derived item caps

The handoff does not state a per-ring item cap, but its own geometry implies one: a sector needs
more arc at its mid-radius than the label is wide (`LABEL.width` = 62). Therefore:

| Level | arc per label at the cap | max items |
| --- | --- | --- |
| 0 | `2π · 94 / 7` = 84px | **7** |
| 1 | `5.906 · 170 / 11` = 91px | **11** |
| 2 | `5.906 · 245 / 15` = 96px | **15** |
| 3 | `5.906 · 320 / 19` = 99px | **19** |

These caps are enforced by a unit test over the menu tree, not merely documented. They are also why
the menu tree below is grouped the way it is. Arc was never the binding constraint — the band's
radial depth was — so the caps have comfortable headroom rather than a dead heat.

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
like any chosen ancestor and its siblings dim, exactly as for an open child ring.

**There is no connector line.** An earlier revision ran a 3px spine from the chosen sector to the
nearest point on the drawer's near edge. It was there to tie a drawer that floated 156px away back
to its sector; with the drawer anchored to the open ring the drawer sits 14px off it, the line is a
stub, and the dark ancestor plus the placement already say what it said. Removed on the user's call.

### Placement

- 14px clear of the **outermost open ring**, so the near edge sits at
  `centre ± drawerOffset(openLevel, scale)` — 144 / 219 / 294 / 369px at scale 1 for a wheel open to
  levels 0..3. Published as `--mw-drawer-offset` and recomputed on every structural redraw, since
  the open depth is what it is a function of. A `panel` node has no children, so while its drawer is
  open the outermost open ring is the panel sector's own level — but that is derived from the
  render, never assumed.
- Width 340px; height `min(560px, 100vh - 32px)`; vertically centred on the wheel centre and
  clamped to the viewport. The drawer hosts the app's real forms, so unlike the ring it does **not**
  scale.
- Side is chosen by the sector that opened it: the half the sector points into (`cos(mid) >= 0` →
  right), so the drawer fans out the way the sector is already aiming. The room it measures is
  measured from the **same** `drawerOffset(openLevel, scale)` the drawer is then placed at — two
  different radii there make the side choice and the placement disagree. That choice is overridden to
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
  radius, 12px type, full width — `width: 100% !important`. FMG carries inline widths on some of
  these controls for the top bar's wide panel (`#stylePreset` 45%, `#styleElementSelect` 42%, the
  style form's paired number inputs 5em); an inline style beats an author rule, so in a 340px drawer
  those selects rendered ~150px wide and clipped their own option text. `!important` is the only way
  to beat an inline style, and `src/index.html` is not this feature's to edit — the same
  justification the `[hidden]` rule carries.
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

### Layers (9 at L1)

33 toggleable layers (39 registered minus the 6 `permanent` ones), plus presets and an ordering
escape hatch. Grouped by **what each layer depicts**. The first grouping was invented to fit the ring item caps
and put Labels under "Cultural", which is not what a label is about; the caps constrain the answer,
they are not the question. The distinction that decides the last two: **Annotations** are things the
user places on the map, **Decoration** is the map's own furniture and presentation.

| Group | Members |
| --- | --- |
| Presets | the 13 `#layersPreset` options: political, cultural, religions, provinces, biomes, heightmap, physical, poi, goods, trade, military, emblems, landmass |
| Terrain | heightmap, relief, biomes, rivers, lakes, ice |
| Climate | temperature, precipitation |
| Political | states, provinces, borders, zones, military, emblems |
| People | cultures, religions, population, burgIcons |
| Economy | routes, goods, markets, trade, journeys |
| Annotations | labels, markers, rulers |
| Decoration | texture, grid, coordinates, compass, scaleBar, vignette, cells |
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

Plus: `Units` (`#editUnitsButton`) · `Configure world` (`#configureWorld`, the button's own words —
"World configuration" put a 13-character word in a 56px label) ·
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
  The dismiss-on-zoom listener is a `wheel` listener, and it **exempts the drawer**: the drawer
  hosts the app's real forms and scrolls, and closing on the first notch of a scroll over it
  detached the drawer mid-gesture and handed the rest of that scroll to the map, which zoomed. The
  exemption is the drawer only, deliberately not the whole overlay — wheeling over the *ring* means
  reaching for the map behind it, so the dial still dismisses and the map still zooms.
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
| Chosen ancestor (its child ring or drawer is open) | `--dark-solid` (`#4a3a22`) | `--light-solid` (`#fffdf7`), resolved for this fill |
| Hovered | `--header-active` (`#6b5535`); **`#a33a2e` if destructive** | `--light-solid` (`#fffdf7`), resolved for whichever of the two it is |
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
properties.

**The palette is watched, not sampled once.** A `MutationObserver` on `document.documentElement`'s
`style` attribute repaints the dial whenever the app rewrites its theme variables — which catches
`changeDialogsTheme`, `changeThemeHue` and the restore-defaults button without naming any of them.
The original reasoning ("the wheel is transient, it closes on an outside pointerdown") was
invalidated by the drawer: Options → Interface opens *inside* the wheel, so the user can sit there
moving the hue and transparency sliders while watching the dial. The repaint recomputes each
sector's two precomputed skins and re-wears the one it is in; it never rebuilds, because a rebuild
on every slider step is the hover-redraw loop all over again. The observer is disconnected in
`closeMapWheel` alongside the key handler.

**Accessibility:** dimmed siblings remain full click targets ("swap branch at this level"), so their
ink stays at ≥4.5:1 — do not fade further than the `.82`/`.82` pair. De-emphasis comes from the
solid dark ancestor, not from making siblings unreadable. Following the theme cannot be allowed to
break that: FMG's own `--dark-solid` on `--light-solid` is **2.5:1** at the default theme colour
(#997787). Every ink the wheel computes is therefore held to 4.5:1 over the ground it is *actually
painted on*, moving only its lightness toward black or white and keeping the theme's hue. With no
theme published the handoff's colours already clear the bar and the guard is a no-op.

"Actually painted on" is the load-bearing half of that sentence, and one ink per rule is not enough:

- The **light ink** appears on three different fills — the chosen ancestor (`--dark-solid`), the
  hover fill (`--header-active`) and the unthemed danger red. It is resolved once per fill
  (`inks.onChosen` / `onHot` / `onDanger`) and the renderer picks the one matching the fill it just
  chose. Guarding a single shared value against one of the three is worse than not guarding at all:
  the guard moves the ink *away* from the other two. Measured with a shared ink guarded against the
  hover fill, light ink on the danger red fell to **1.18:1** at a white theme colour and 1.46:1 at a
  near-black one.
- The **accent ink** appears on three grounds — the hub's inactive tab (`--light-solid`), the
  breadcrumb (`--bg-lighter`) and the drawer's headings (`--bg-light`) — and is guarded against all
  three in turn. That is safe because those three are one theme lightness plus 0.02, 0.05 and 0.06,
  so they never straddle mid-grey and the guard never has to reverse direction.

**The ring carries the user's transparency**, like every other panel in the app. `changeDialogsTheme`
publishes the alpha it derives from the slider as `--bg-opacity` = `(100 - transparency) / 100`, and
every sector fill is emitted at that alpha — mapped onto `[ALPHA_FLOOR, 1]` rather than clamped to
it, so the whole slider is visible on the dial and full opacity still lands exactly on the design's
own `.97` / `.82`. A fill whose nominal alpha is already lower than the result keeps its own (the
dimmed sibling stays at `.82` until the user asks for more).

`ALPHA_FLOOR` is **0.8**, and it is what makes the rest of this section still true. What shows
through a sector is the MAP: arbitrary, and at full contrast. Measured against a pure white and a
pure black ground, the worst pair at `.8` is the layer-on green — nominally the weakest at 5.21:1 —
at 3.49:1, and every ink the guard holds to 4.5:1 stays at 4.25:1 or better; at `.7` that worst pair
falls to 2.81:1. Real map ground is mid-tone, where the loss is far smaller than at either extreme.

Contrast is measured on the **nominal opaque pair**, and **transparency is applied after the guard**
— the guard's inputs are the opaque colours, and `withAlpha` only rewrites the emitted fill.
`--header-active` and the `--bg-*` grounds carry the user's transparency of their own (and
`--header-active` an `alphaReduced` of `min(alpha + 0.3, 1)`), and what shows through all of them is
the map. Measuring the opaque colours is therefore the only stable reading available, and the floor
is what preserves legibility once the alpha is applied.

The unit test for this asserts a universal, so it is exercised as one: the whole pair table runs
across four reproduced themes — the default `#997787`, `#ffffff`, the pale blue `#dfe9f5` and the
near-black `#221a20` — not against the default alone. Only mid-lightness themes hid the bug above,
and the hue slider preserves lightness, so the default look never showed it.

### Labels

Labels are **HTML**, not SVG text — absolutely positioned divs in a sibling layer with
`pointer-events: none`, so text never intercepts clicks and gets normal wrapping. Hit-testing is
done by the SVG `<path>` underneath.

- Position `(cos(mid) · rMid, sin(mid) · rMid)`, `translate(-50%,-50%)`.
- Width `LABEL.width` = 62px at every level. Column flex, centred, `gap: 2px`, `line-height: 1.15`.
- Font: IBM Plex Sans, 10.5px at level 0, 9.5px at levels 1+.
- Icon above the label: **FMG's own `icon-*` set from `public/icons.css`**, 19px at level 0, 16px at
  levels 1+.
- Every one of those lengths is `calc(<base> * var(--mw-ui, 1))`, so they follow uiSize with the
  radii. (The prototype uses Material Symbols; substituted per the handoff's own instruction, to
  avoid a Google Fonts dependency in the desktop build and a second icon vocabulary.)
- The text is clamped to `LABEL.lines` = 2 lines with an ellipsis, and a word wider than the label
  breaks rather than spilling (`overflow-wrap: anywhere`, `hyphens: auto`). This is what bounds an
  entity name of arbitrary length to a known set of ink boxes, which is what the band depths are
  solved against (§ Geometry) — the fit is a property of those bounds, not of today's strings.
- Optional third line: 8.5px, `opacity .68`, `letter-spacing .05em`, ellipsised at 65% of the label
  width (it is the ink furthest from the mid-radius, so its width is what the band depth pays for) — `on`/`off` for layer toggles, the subject kind under an entity name, the subject count.
  "This has children" is **not** one of them: it is the SVG tick at the sector's outer edge, because
  a line of text costs the band's depth and a tick costs none.
- Every one of these lengths comes from `LABEL` in `geometry.ts`, which `styles.ts` interpolates into
  the stylesheet, so the band table and the labels it must hold cannot drift apart.

### Hub

104×104 circle, `overflow: hidden`, `border-radius: 50%`, `pointer-events: none` on the wrapper with
`auto` on the two tabs. `box-shadow: 0 0 0 1px rgba(90,74,48,.4), 0 6px 16px rgba(20,14,4,.35)`.
Split into two equal stacked tabs, **HERE** over **MENU**. Tab type IBM Plex Sans 10px/600,
`letter-spacing .1em`, uppercase, centred. Active tab `--header-active` (`#6b5535`) with the light
ink resolved for that fill (`#fffdf7`); inactive `--light-solid` (`rgba(251,247,236,.94)`) with the
accent ink (`#6b5535`); `transition: background 120ms`. Diameter and type size follow `--mw-ui`.

### Breadcrumb

Centred on the wheel's centre, `CRUMB_CLEAR` (10px, scaled) above the outermost **open** ring, and
clamped into the viewport so a deep drill on a short window cannot push it off the top or the sides.
(It used to be pinned to the top-left of the overlay *box*, which is sized for a drill to level 3 —
so on a two-ring wheel it sat 236px left of the dial and 106px above the ring, in the corner of the
screen.) It stays `pointer-events: auto`, since clicking crumb *n* is the only route back to depth
*n*. IBM Plex Sans 11px, `letter-spacing .04em`,
in the accent ink (`#6b5535`) on `--bg-lighter` (`rgba(251,247,236,.86)`), padding `6px 11px`,
radius 3px, border `1px solid` the themed edge (`rgba(90,74,48,.25)`). Clickable
(`pointer-events: auto`). Last crumb `--dark-solid` (`#3b3226`)/600, earlier the accent
(`#8a7248`)/400, separator `›` at `opacity .45`, margin `0 5px`.

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
  Plus: every radius scales uniformly with uiSize and by nothing else, `sectors(…, 1)` is identity,
  a 3px gap stays 3px as the dial grows, every ring at its cap has more arc per label than the label
  is wide, and `wheelScale` clamps to `[0.8, 2]` and then again to the viewport.
  Plus the open-ring/max-ring split: `openOuterRadius` is the band it names and never the deepest,
  `boxRadius` still clears the deepest, `drawerOffset` keeps one clearance at every level, and an
  out-of-range level clamps rather than reading off the end of the table.
  Plus the label-fit guard, which is the regression test for the overflow bug: for **every ink box**
  `labelRects(level)` can produce — the icon, each text line at the full label width, the note at its
  width cap — `2 · hypot(a, reach)` is inside the band's depth. That is the maximum over all sector
  angles, not the two axes; asserting only `width` and `stack` passed while angles in between still
  spilled. It needs asserting once because both sides scale with uiSize together, which is itself
  asserted. Also: the parent tick has room outside the tallest label that carries one, and `LABEL`
  equals the literal metrics the band table was solved for (an assertion against `LABEL` itself would
  pass for any value, since `styles.ts` interpolates it).
  `markPath` is tested for shape and for staying inside its band at every angle and scale.
- `palette.test.ts` — the fallback palette is byte-identical to the handoff when no theme is
  published; the app's variables are followed when they are; danger and layer-on stay literal;
  `readable` moves the same ink opposite ways for a light and a dark ground. The contrast assertion
  runs the full ten-pair table (including light ink on the danger red, and the accent on the
  breadcrumb and drawer grounds) **across four reproduced themes** spanning the lightness range, and
  dimming stops at `.82`/`.82` in every one of them.
  Transparency: the fills are byte-identical to the design at full opacity, follow `--bg-opacity`
  monotonically, never go below `ALPHA_FLOOR` however far the slider is pushed, keep the danger red
  and layer-on green themselves (only veiled), and ignore an unreadable `--bg-opacity` rather than
  veiling for nothing.
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
  opening a second drawer restores the first host before hosting the next. `pickSide` measures room
  against the ring that is OPEN, not the deepest one possible — the same centre and sector chooses
  differently at level 1 and level 3.
- `wheel.test.ts` — the breadcrumb is anchored above the outermost open ring and scales with the
  dial; the handle reports that open level (a `panel` node's own level, since it opens no ring);
  `repaint` follows a theme change without replacing a single element, and leaves a hovered sector
  in its hot skin.
- `index.test.ts` — the published `--mw-drawer-offset` is the open ring's, not the box's; a deeper
  wheel reserves more viewport room for its drawer; a theme change on `<html>` repaints the live
  wheel and a closed wheel stops watching; a `wheel` event inside the drawer scrolls it instead of
  dismissing, while one anywhere else still dismisses.

**Browser (Playwright, `playwright.local.config.ts`, which starts its own vite on :5211 — never 5173,
and never the port a user session is browsing):**

- Right-click on the map opens the wheel at the pointer; Escape closes it; outside click closes it;
  a zoom closes it — but a scroll inside the drawer scrolls the drawer, leaves the wheel open and
  leaves `#viewbox`'s transform untouched (the map-transform assertion is what catches the bug: the
  overlay closing mid-gesture handed the rest of the scroll to the map).
- The drawer sits 14px clear of the ring **actually open**, measured at level 0 and level 1 as the
  real distance from the last ring's painted edge to the drawer's near edge.
- The breadcrumb is centred on the wheel centre and 10px above the outermost open ring at depths 0,
  1 and 2, stays inside the viewport for a depth-3 drill opened near the top edge, and keeps
  `pointer-events: auto`.
- A hosted `select` fills the block it sits in (`#stylePreset`, `#styleElementSelect`), which is
  what the inline 45% / 42% widths broke.
- Moving the app's own theme while the wheel is open repaints the ring: the sector fills follow the
  colour, and their alpha is `.97` at transparency 0 and the `.8` floor at transparency 100.
- `MENU → Layers → Political → Borders` flips the real layer: `Layers.isOn("borders")` changes and
  the sector's fill becomes `#8a9c6c` without the ring closing.
- Drilling to depth 4 renders 4 rings with 3 spines; clicking a faded sibling swaps branch and
  leaves the deeper ring's parent chain consistent; clicking the dark ancestor collapses.
- The drawer survives a hover: hovering a sector while a drawer is open leaves the drawer attached
  and its borrowed controls live, and the ring visible (one bug closed the drawer on any hover;
  another rebuilt the ring on hover, which restarted the entry animation every frame and killed the
  whole mouse path).
- `MENU → Options → Realms` opens the drawer showing exactly the five Realms rows; changing
  `statesNumber` in the drawer updates the same value the top-bar Options tab shows after close.
- Closing the wheel with a drawer open leaves `#optionsContent` back inside `#options` in its
  original position, and the top-bar Options tab renders normally.
- Right-click near a viewport corner keeps wheel and drawer on screen together.
- Right-click while `customization` is active does not open the wheel.
- **No label's ink leaves its own sector.** Measured on what is actually painted — each text LINE's
  rect, clipped by the box that clamps it — against the band's inner and outer arcs and the wedge's
  radial edges, over the rings that hold the tree's hardest labels (the layer toggles, which carry a
  note; the 15-item Edit ring; the Options ring; the HERE subject list) at uiSize 0.8, 1 and 2. The
  unit bound above is what makes the guarantee; this samples the real thing and would catch a
  rendering that does not match the model it is solved against.
- A parent sector is marked with a tick and not with a line of label text, and the tick is drawn
  inside its band.
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

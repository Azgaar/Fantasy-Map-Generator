# PRD — Icon Assets

Updated: 2026-09-21. Covers the relief, burg/port and goods icons that `src/index.html` ships as inline
`<symbol>`s. The heraldic charges (`public/charges/`) and marker images already live outside the page
and are not affected.

## Problem Statement

`src/index.html` is 570KB and **511KB of it is icon markup**: relief 303KB (95 symbols in four sets),
burg and port icons 29KB (32 symbols), goods 188KB (72 symbols). Relief is the bulk, and it is the one
block a map never needs in full. This has four costs:

- **Startup bloat.** Every visitor downloads and parses all four relief sets although a map uses one.
  The page is also the one asset the service worker cannot hash, so the whole block is refetched on
  every release.
- **Unreviewable artwork.** One icon is a `<symbol>` somewhere in a 3,000-line block. GitHub cannot
  preview it, a PR diff of a redrawn mountain is a wall of path data, and an artist cannot open a single
  icon in an editor.
- **Invisible gaps.** The simple set has 9 relief icons, colored/gray 34, illustrated 18. Nothing lists
  what a set lacks.
- **Representation leaks into data.** `pack.relief[].icon` stores a set-specific symbol id
  (`relief-mount-3-bw`), so the set is baked into every icon whether the author chose it or not. Because
  all sets share one id namespace, the simple set uses variant `1` and the colored set variants `2..7` of
  the same type to avoid clashes, which makes even the simple/colored distinction an accident of
  numbering. And `Relief.changeSet` rewrites every icon on a style change, so a set the author picked
  deliberately for one icon — a real editor feature, `relief-editor.ts:406` writes the picked symbol id —
  does not survive it.

## Solution

Icons become **one `.svg` file per icon** under `src/assets/icons/`, grouped by family and, for relief,
by set. Vite bundles each set into its own lazy chunk; a small loader converts the files into
`<symbol>`s and injects them into `#defElements` the first time a renderer needs that set. Rendering
stays SVG `<use>`, export keeps inlining the symbols a map references.

Relief data stores a **set-independent icon descriptor**: `type`, `variant` and an optional `set` pin. An
icon with no pin is drawn in `styles.relief.options.set`, so changing the style changes pixels and never
`pack.relief`; an icon with a pin keeps the set the author chose for it. A catalog in `src/data`
declares the **union** of types and variant slots every set is measured against; a set is a directory of
files, so all four sets have the same format and a set that lacks a file gets an alias symbol at load
time. Because the union is the id space, an icon resolves in every set, pinned or not, and the gap list
is derived from the directories rather than pinned by hand.

### Decisions on the open items

| Item                  | Decision                                                                                                                       | Why                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home folder           | `src/assets/icons/`                                                                                                            | Vite bundles it: one hashed chunk per set, cache-safe, precached by the PWA, served under Electron's `app://`. `public/` would need a sprite build script, `?v=` stamping and runtime `fetch`.                                                                            |
| SVG or raster         | SVG `<symbol>` + `<use>`                                                                                                       | The map is SVG; burg and goods icons are recoloured through group `fill`/`stroke`; export inlines symbols; zoom must stay crisp. Rendering cost is DOM node count (already viewport-culled), not path complexity. Rasterizing only becomes relevant for a WebGL renderer. |
| Icon font / SDF       | No                                                                                                                             | Fonts hold single-colour glyphs; relief is multicolour and burg icons need independent fill and stroke. SDF pays off only on the GPU. Either needs a font toolchain.                                                                                                      |
| Atlas or texture      | An SVG sprite per set: `<symbol>`s in `<defs>`                                                                                 | That is the SVG-native atlas. Sources stay individual files.                                                                                                                                                                                                              |
| Build-time or runtime | Build assembles, runtime converts                                                                                              | `import.meta.glob(?raw)` gives one chunk per set with no custom script; turning `<svg>` into `<symbol>` is a string replace per icon.                                                                                                                                     |
| Registry format       | `src/data` holds the id contract (types, variant slots, preview tuning); the file system holds the art; a test reconciles both | Nothing is listed twice. Missing art is a test diff, not a guess.                                                                                                                                                                                                         |
| Alignment across sets | One set-independent union of slots with alias fallback; per-set coverage is the directory listing                              | Sets become peers with no per-set fields or `base`/`suffix` mapping. Data never depends on a set, and adding a file needs no code change.                                                                                                                                 |
| Per-icon set          | An optional `set` pin per icon; absent means follow `styles.relief.options.set`                                                | Picking an icon from another set is an existing editor feature. An explicit pin is data the author asked for; the defect was the _implicit_ global set in every id and `changeSet` rewriting it away.                                                                     |

## User Stories

1. As a visitor, I want the page to load only the icons my map draws, so that startup is faster.
2. As a map author, I want to switch the relief set and get every unpinned icon redrawn in the new style,
   so that the choice is a style, not an edit of my map.
3. As a map author, I want a set with less artwork to still show every icon, so that switching sets never
   leaves holes in the terrain.
4. As a map author, I want old `.map` files to open with their relief intact after the change.
5. As a map author, I want SVG and PNG exports to contain the icons I see, whatever set is active.
6. As a contributor, I want to open, redraw and review one icon as one file, so that artwork PRs are
   readable and previewable on GitHub.
7. As a contributor, I want a list of which set lacks which icon, so that I know what to draw next.
8. As a contributor, I want to add an icon by dropping a file into a directory, so that no code changes
   are needed for new artwork.
9. As a map author, I want to pin individual icons to a set while the rest of the map uses another, so
   that a deliberate choice survives a style change.

## Implementation Decisions

### Layout and id scheme

```
src/assets/icons/
  relief/{simple,colored,gray,illustrated}/<type>-<variant>.svg   → id relief-<set>-<type>-<variant>
  burgs/<name>.svg    circle.svg, watabou-capital.svg, illustrated-palace.svg, anchor.svg, harbor.svg
                                                                  → id icon-<name>
  goods/<name>.svg    wood.svg, salted-fish.svg, …                → id good-<name>
```

**Symbol id = sprite prefix + file basename.** Burg and goods ids do not change: they are stored in
user styles, style presets and `.map` files. Every set directory has the same format and the same
filename rule; nothing in the registry is per-set. Relief ids gain the set and are renumbered from 1
in every set: colored `mount-2..7` → `mount-1..6`, `hill-2..5` → `hill-1..4`, `dune-2` → `dune-1`,
`deciduous-2,3` → `deciduous-1,2`, `conifer/acacia/palm/grass-2` → `-1`, `swamp-2,3` → `swamp-1,2`.
The other types already start at 1.

No per-set index module: `components/icon-sets.ts` globs every SVG with
`import.meta.glob("@/assets/icons/**/*.svg", { query: "?raw", import: "default" })` and a
`manualChunks` rule in `vite.config.ts` groups the per-file lazy loaders into one chunk per directory,
keyed by the directory path.

### Source file convention

- Root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">` with exactly the attributes the symbol
  needs; burg icons keep `width="1em" height="1em" overflow="visible"` (1em = the group's `size`).
- Attribution in `<metadata description="…" source="…" license="…"/>` where the source art carried it,
  as the goods already do. The relief and burg sets have none to carry over.
- Never `<title>`: through `<use>` it becomes a hover tooltip on every instance.
- Inner details of recolourable icons (burgs, goods) are strokes and fills without hard-coded colours
  where the group is expected to colour them.
- The simple `grass` icon's former `scale: 1.2` moves into its viewBox; proportions belong to the
  artwork, so the registry carries no size override. Shrink the `100 × 100` viewBox by `1.2` around
  its center `(50, 50)`. The migration below compensates existing instances to preserve their appearance.

### Model (`src/generators/relief-generator.ts`)

The model is one class, `ReliefModel`, instantiated on the `Relief` global like `Goods`, `Markets` and
`Production`; callers use that global and do not import the class. Nothing hangs off the module as a
stray function. `Relief.types`
declares the union of slots every set is measured against—`variants` is the widest coverage any one set
has—so a stored `type`/`variant` resolves in all four sets, pinned or not, and a style change can never
invalidate it. Which slots a set
draws is its directory listing, and a set that fills fewer of them aliases the rest at load time. There
is no per-set registry entry: the old `base`/`suffix` mapping is gone and all four sets are peers.

A **relief variant** is a permanent logical slot within a type. Its artwork may improve between
releases: filling a missing slot replaces its fallback on existing maps, including pinned icons,
without changing their descriptors. This is accepted; missing artwork is planned to be filled before
release. Released slots must not be renumbered, reassigned or removed without a data migration.

```ts
const SETS = ["simple", "colored", "gray", "illustrated"] as const;
const TYPES = [
  { type: "mount", variants: 6 },
  { type: "mountSnow", variants: 6, fallback: "mount" },
  { type: "vulcan", variants: 3, fallback: "mount" },
  { type: "hill", variants: 4 },
  { type: "dune", variants: 1 },
  { type: "deciduous", variants: 2, zoom: 1.5 },
  { type: "conifer", variants: 1, zoom: 1.5 },
  { type: "coniferSnow", variants: 1, zoom: 1.5, fallback: "conifer" },
  { type: "acacia", variants: 1, zoom: 1.5 },
  { type: "palm", variants: 1, zoom: 1.5 },
  { type: "grass", variants: 1, zoom: 1.5 },
  { type: "swamp", variants: 2, zoom: 1.5 },
  { type: "cactus", variants: 3, zoom: 1.5, fallback: "dune" },
  { type: "deadTree", variants: 2, zoom: 1.5, fallback: "dune" }
] as const;

export type ReliefSet = (typeof SETS)[number];
export type ReliefIconType = (typeof TYPES)[number]["type"];

export interface ReliefType {
  type: ReliefIconType;
  variants: number; // widest coverage across the sets
  zoom?: number; // editor preview magnification
  fallback?: ReliefIconType;
}
TYPES satisfies readonly ReliefType[];

// the map stores this ref as it is; the renderer resolves the absent variant to 1 and the absent set to the style
export type ReliefIconRef = { type: ReliefIconType; variant?: number; set?: ReliefSet };
export type ReliefIcon = ReliefIconRef & { x: number; y: number; s: number };

export class ReliefModel {
  readonly sets = SETS;
  readonly types = TYPES;
  symbolId(icon: ReliefIconRef, styleSet: ReliefSet): string;
  variantsOf(type: ReliefIconType): number;
  isType(type: string): type is ReliefIconType;
  anchorY(icon: ReliefIcon): number;
  readonly byAnchor: (a: ReliefIcon, b: ReliefIcon) => number;
  generate(): ReliefIcon[];
}
```

Infer the catalog before checking it against `ReliefType`, so fallback names are checked without a
circular initializer constraint. The relief model owns its catalog, descriptor types and symbol id, the
way `Burg` and `Good` live with their generators; `services/io` only calls into it. The descriptor is
stored as plain JSON — no zod schema, no `parseRelief`/`serializeRelief` — and the renderer resolves
what the data leaves out, so the stored and drawn shapes are the same. Variants
are `1..variants` in every set. For a missing
slot, collect the set's available artwork for that type in numeric variant order; if none exists,
follow the type's `fallback` chain until artwork is available. Select
`available[(variant - 1) % available.length]`. Only actual files are candidates, never aliases.
This distributes fallback slots across available drawings deterministically, without consuming random
numbers or changing map data. Exact artwork always wins. For illustrated mountains with drawings
1–3, slots 4–6 alias 1–3 respectively, giving each drawing two of the six slots.

`zoom` is the editor preview magnification; it is per type too, so the editor looks the same in every
set. Dropping a file for a declared slot needs no code change; only a genuinely new type, or a variant
past `variants`, edits the catalog, because that changes the id space every set is measured against.
`RELIEF_CHOICES`, `ReliefSetDefinition` (with its `base`/`suffix`) and `ReliefTypeIcons` go away;
`styles-schema.ts` uses `z.enum(Relief.sets)` and derives any choice-label metadata locally by
capitalizing each value. The Relief Editor iterates the tuple and capitalizes its labels too; no
name-to-name map is stored in the catalog. `src/data/burg-icons.ts` keeps its `SETS`, `BURG_ICONS`
and `PORT_ICONS`.

### Loader (`src/components/icon-sets.ts`)

One class per chunk plus a registry over them, in the shape of the layers registry:

```ts
class IconChunk {
  readonly id: IconSetId;
  get isLoaded(): boolean;
  load(options?: { retry?: boolean }): Promise<void>; // one shared attempt per set; rejects on failure
  ensure(options?: { retry?: boolean }): Promise<void>; // renderers: a reported failure lets the draw continue
}
export class IconSetRegistry {
  isLoaded(id: IconSetId): boolean;
  load(id: IconSetId, options?: { retry?: boolean }): Promise<void>;
  ensure(id: IconSetId, options?: { retry?: boolean }): Promise<void>;
  ensureAll(ids: readonly IconSetId[], options?: { retry?: boolean }): Promise<void>;
  reliefSets(icons: readonly ReliefIconRef[], styleSet: ReliefSet): IconSetId[];
  setForId(id: string): IconSetId | undefined;
}
export const IconSets = new IconSetRegistry();
```

The chunk rewrites each file's root `<svg …>` to `<symbol id="…" …>` (dropping `xmlns*`), then walks
the union: for every `Relief.types` slot the set has no file for it emits an alias symbol using the
deterministic selection rule above, so every `type`/`variant` a map can hold resolves in every set,
pinned or not. The result is injected into `#defElements defs` as `<g id="icons-<set>">`.
Goods use `<g id="icons-goods">` inside `<g id="good-icons">`; the latter stays empty in `index.html`.

Every loader **appends** and never clears or replaces its container's children, because a container can
hold runtime art that no chunk provides. That matters for goods today: custom user-uploaded icons are
appended by the good editor and restored from map field `data[45]` on load, so a chunk that arrives after
the map must not wipe them. `isLoaded` tracks the chunk only and never inspects the container.

The `<svg>`→`<symbol>` rewrite and the alias walk are plain string work on the glob's values, so
`icon-sets.test.ts` runs in the node project; only the injection touches the DOM.

Renderers **await** the chunks at the top of their draw and then draw once—there is no redraw callback
and no `Layers.draw` from inside a draw. Relief awaits the style's set plus every distinct `set` pinned
in `pack.relief`, so a forked map pulls those chunks too while a fresh one pulls a single chunk. The
Relief Editor awaits a set when the author picks it. Every controller that displays goods icons triggers
the goods load on entry, independently of map layer visibility, and opens immediately: the browser
resolves `<use>` targets once the symbols appear, so no dialog waits for icons. Only the good editor's
icon picker needs the symbols present, so it fills its select when the chunk lands. Export awaits the
required chunks as described below; a later live redraw cannot repair an already serialized export.

Loading shares one pending promise per set and marks the set loaded only after conversion, alias
validation and injection succeed. Prepare the complete built-in group before appending it, so a failed
attempt leaves no partial group or duplicate ids on retry. On failure, log the set and original error
with `console.error` and show an error-type UI tip naming the affected icons and suggesting retry or
reload, once per failed attempt rather than once per waiting consumer. Keep the failed state so viewport
redraws do not create a retry or notification loop; `ensure` never rejects, so a failed draw simply
shows no icons. An explicit set selection or export request may pass `{ retry: true }` to start another
attempt; concurrent retries still share one promise. If retry fails again, the tip recommends reloading
the page. No automatic retry timer is needed. Loaded definitions stay cached even when their original
consumer is gone.

### Data model and generator

- `ReliefIcon` is `{ type, variant?, set?, x, y, s }`. `variant` defaults to `1`; `set` is an optional pin,
  and an absent `set` means the icon is drawn in `styles.relief.options.set`. Absent must mean "follow the
  style", not "equals the style when saved", or a style change would silently re-pin every icon.
- `Relief.generate` writes `type` and `variant` (picked uniformly from the union, regardless of set) and
  never writes `set`, so generated icons follow the style and a later style change cannot put a stored
  icon out of range. `changeSet`, `pickIcon`, `getTypeIcons`, `findType` and `getReliefIconId` are
  deleted; `changeSize` goes too — icon size is a render multiplier, not data.
- `styles.relief.options.size` is a **render multiplier**: the renderer draws each icon at `s * size`,
  anchored at its centre, and the slider just redraws. The anchor matters: `pack.relief` is ordered by
  the icon's anchor (the sampled cell point at the box centre), so keeping the drawn centre equal to
  `y + s / 2` keeps that order a valid z-order. The box bottom is not the anchor — the art is padded
  differently inside each `viewBox`, so sorting by `y + s` would add half the icon size and float big
  mountains in front of smaller hills. `pack.relief` is never scaled by the slider.
  Generation bakes the base footprint only, and the 1.154 migration divides old sizes by the incoming
  map's size, moving `x`/`y` so the anchor is unchanged, then re-sorts by that anchor.
- `pack.relief` is stored as plain JSON: the descriptor is JSON-serializable by nature, `save.ts`
  stringifies it and `load.ts` assigns the parsed field. No zod schema and no
  `parseRelief`/`serializeRelief`; the renderer resolves an absent `variant` to 1, so what is stored
  and what is drawn are the same shape.
- `coniferSnow` stops being a relief-side temperature branch. It becomes a normal entry in the cold
  biome icon weights (`biomes-generator.ts`, Taiga today), and the `type === "conifer" && temp < 0` swap
  in `getBiomeIcon` is deleted, so the biome-icon path no longer reads temperature. The height-based
  `mountSnow` pick in `getReliefIcon` is unrelated and stays. `Relief.types` gets no biome flag.
  Biome data intentionally owns tree-icon selection for now, including the snowy-tree weights; this
  is a behavior change, not an equivalent rewrite of the temperature rule. More intelligent selection
  using temperature or other factors belongs at the biome level in later work.

### Renderers and export

- `draw-relief-icons.ts` writes the symbol id from the descriptor:
  `#relief-${icon.set ?? styles.relief.options.set}-${icon.type}-${icon.variant ?? 1}`, and draws it at
  `s * styles.relief.options.size` about its anchor;
  `draw-burg-icons.ts` and `draw-goods.ts` await their set, then draw.
- `services/io/export.ts` uses the map as it is when export starts. Before the first asynchronous wait,
  create the export clone and synchronously reconcile its icons from current state for the requested
  viewport or full-map bounds. Capture referenced map-carried definitions, including custom goods,
  into the clone at this point too. This does not require icon chunks to have loaded: the clone can
  already hold the final `<use>` ids. Derive the required built-in chunks from those captured references,
  then await them before completing the definition walk. After waiting, never reconcile icons or
  discover their required sets from the live map again. A later style change, edit or map load therefore
  cannot mix new icon choices or custom art into the export. Use the existing export clone as the
  snapshot; no second copy of the entire world state or global editing lock is needed. Usually the
  chunks are already loaded, so this adds no wait. A failed chunk load fails the export through its
  existing error handling instead of producing a file with missing icons.
- Replace the three per-family inlining blocks with one shared dependency walk: collect local `href`
  and `xlink:href` targets from `<use>` elements in the clone, copy missing definitions from
  `#defElements`, and visit `<use>` references inside those definitions too. Track visited ids to avoid
  duplicates and cycles; aliases must include their targets even when those targets have no direct map
  instances. Complete this walk before symbol flattening and serialization. Copy **by id, not by tag**:
  custom goods icons are raw `<svg>` elements. The no-op `#defs-relief` removal in `removeUnusedElements`
  is dropped.

### Editors

- Relief Editor: the **Set** control stays, but becomes `Default (style)` plus the four sets, and writes
  the icon's `set` pin only for a concrete choice; `Default` is what an unpinned icon shows. The grid is
  `Relief.types` × variants for the icon's effective set, and picking another set in the control awaits
  that chunk before drawing previews (the editor builds all four grids eagerly today, which would defeat
  the split). Grid entries carry `data-type="mount"`, `data-variant="3"` and `data-set`, and previews go
  through `<use href="#relief-<icon.set ?? style>-mount-3">`.
- The good editor enumerates icon roots for its picker:
  `#good-icons > #icons-goods > symbol[id^="good-"]` for built-ins and
  `#good-icons > svg[id^="good-custom-"]` for uploads. Container groups and descendants inside artwork
  are never picker entries, even when they have ids. It opens at once and refills the select when the
  goods chunk lands.
- Market overview, market deals overview, trade details, production overview and production chains
  trigger the goods load on entry and draw icons immediately; `<use>` resolves once the symbols exist.
  Each must work as the first goods consumer opened in a session, with the goods layer off and neither
  goods editor previously opened.
- Burg icon pickers in the Style Editor trigger the burgs load and draw their `<use>` previews, which
  the browser resolves when the chunk lands.

### Custom icons

A map can carry art no chunk provides. Only goods support this; the split must not break it.

**Goods (in scope).** The upload path is unchanged: the editor appends `<svg id="good-custom-<id>">`
(wrapped raster or sanitized SVG) to `#good-icons`, `save.ts` stores the `outerHTML` of
`#good-icons [id^="good-custom-"]` in `data[45]`, and `load.ts` clears the previous set and re-inserts it
before migrations run. Three rules keep that working after the move:

- the loader appends built-ins into `#icons-goods`, a child group of `#good-icons`, and leaves existing
  children alone;
- the export pass copies the referenced element by id, whatever its tag;
- the good editor uses the icon-root selectors above. The container holds custom `<svg>` roots beside
  the built-in group, so the picker selects both and excludes containers and artwork internals.

**Burgs and relief (not supported).** No upload path, map field, picker enumeration or custom id
namespace exists, and the descriptor has no custom branch. Adding one later means a map field beside
`data[45]`, picker enumeration, and — for relief — either an id space of its own or a symbol the loader
does not compose away. The append-only loader rule is what keeps that possible.

  A custom relief icon is set-independent, so a style change leaves it alone, and the editor grid lists
  

### Migration (`services/io/auto-update.ts`, next version)

`pack.relief[].icon` `relief-<type>-<n>[-bw|-illustrated]` becomes
`{ type, variant?, set?, x, y, s }`:

Run this step after the existing style migrations. Recover the incoming map's relief set from
`Styles.parse(safeParseJSON(data[48])).relief.options.set` (passing `undefined` when the field is absent),
using the same defaults and validation as load. Do not read the global `styles` for pin recovery:
`load.ts` installs the incoming styles only after `resolveVersionConflicts`, so that global can still
describe the previous map.

- **`variant`.** For ids without a suffix or with `-bw`, and a type the simple set shares (mount, hill,
  dune, deciduous, conifer, acacia, palm, grass, swamp): `m = n === 1 ? 1 : n - 1`; otherwise `m = n`.
  The offset matches the file renumbering, so the artwork is unchanged and only the number shifts.
- **`set`.** The pin is recovered from the old id against the incoming set parsed above: `-bw`
  names the gray art, `-illustrated` the illustrated art, and an unsuffixed id names the simple art when
  it is variant `1` of a shared type, the colored art otherwise. Write `set` only when that differs from
  the map's set, so a map generated with one style gets no pins and a mixed map keeps its overrides—the
  property `changeSet` used to destroy.
- **Simple grass dimensions.** Only old `relief-grass-1` instances use the enlarged simple artwork.
  For each, let `newS = s / 1.2`, set `x += (s - newS) / 2` and `y += (s - newS) / 2`, then set
  `s = newS`. Apply this once in the versioned migration without extra rounding, preserving the center
  and rendered footprint, including manually placed or resized grass and simple pins in mixed maps.
  Other grass sets and other types keep their dimensions. Newly generated icons use the unscaled size.

Two icons that differed only by set can end up with the same `type`/`variant` but different `set`; they
stay distinct and no icon instance is dropped. The small historical table this needs—the shared-type list
and the suffix→set map—is inlined in `auto-update.ts` even though `RELIEF_ICONS` is deleted. The v1.142
migration that lifted relief out of the SVG keeps emitting old-format ids and the new step runs after it.
The `icon-anchor` symbol rewrite goes: the extracted art is the same drawing and the symbol is no longer
in the document until the burgs set loads, so the rewrite only ever replaced it with itself.

## Testing Decisions

- `relief-generator.test.ts` (node): the catalog lives here now, so it also holds the directory coverage
  check — reads `src/assets/icons/relief/<set>/` with `fs` and fails on a file whose type is not in
  `Relief.types` or whose variant exceeds `variants`. It asserts the union is tight (each type's highest
  declared variant exists in some set, and each set's files for a type run contiguously from 1), prints
  the derived coverage table, and covers the plain-JSON descriptor round-trip and the
  style-switch-leaves-descriptors-untouched property. The gap list is a property of the directories, so
  there is no `KNOWN_GAPS` constant to maintain (today: simple fills 9 of 34 slots, colored and gray 34,
  illustrated 18). A generated icon is `{ type, variant }` with no `set` and a size independent of
  `styles.relief.options.size`; the `index.html` scan goes.
- `draw-relief-icons.test.ts` (jsdom): the style size scales the `<use>` geometry about the icon's anchor
  and leaves `pack.relief` untouched; a big icon above a smaller one stays behind it at every size.
- `burg-icons.test.ts` and `styles.test.ts`: listed and preset icons have a file in
  `src/assets/icons/burgs/`. The jsdom assertions that parse `src/index.html` move to the extracted
  `<svg>`; the "Illustrated icons retain accent colors while their main surfaces inherit group paint"
  checks are the ones that matter.
- `icon-sets.test.ts` (node): `<svg>` → `<symbol>` conversion, alias emission for unfilled slots,
  idempotent loading, and that a pinned map asks for every set it references. Verify slots 4–6 map to
  drawings 1–3 when those are the available variants, fallback types use the same rule, and resolution
  is independent of file enumeration order and repeated loads. Reject missing fallback targets or
  cycles that leave a slot without real artwork. Adding an exact-slot file replaces that slot's alias
  without changing the saved descriptor. Verify concurrent callers share an attempt, failure leaves
  no partial definitions, redraws do not retry failed loads, and an explicit retry can succeed.
  Browser-facing loader tests verify one console error and error-type tip per failed attempt.
- `auto-update.test.ts`: the variant table (`-bw`, `-illustrated`, mixed-set) and pin recovery from the
  incoming `data[48]`, with the current global set deliberately different. A colored map holding
  `relief-mount-1` becomes `{ type: "mount", variant: 1, set: "simple" }` even when the current map is
  simple; its colored icons remain unpinned. Cover pre-v1.142 maps through the full migration chain.
  Verify simple grass preserves its rendered footprint and center within floating-point tolerance,
  including resized icons and mixed-set pins; other grass sets are unchanged and reloading the migrated
  save applies no second compensation. A map whose style size is not 1 has its old sizes divided by it,
  so the new render multiplier reproduces the original appearance exactly. Keep the existing "restores
  every defs element index.html declares" test, whose expected list is sliced out of `@/index.html?raw`
  and shrinks with the move.
- Export tests hold chunk promises pending while requesting SVG and PNG immediately after a layer is
  enabled or a relief set changes. Export must wait, use the descriptors captured when export started,
  and include pinned sets and all alias targets. While pending, switch the style again, edit an icon,
  or load another map with different custom goods; the exported icons and custom definitions must
  still match the initial snapshot. Test nested references, deduplication/cycles, and chunk rejection.
- Controller tests trigger each goods-consuming overview, trade details and production chains with the
  goods layer off and no loaded goods chunk, and verify the goods load starts on entry. Editors no
  longer wait for icons, so there is no stale continuation to guard: the picker refills when the chunk
  lands, and the browser resolves `<use>` on its own.
- A `pack.relief` round-trip: the descriptor survives `JSON.stringify` → `JSON.parse` unchanged, and a
  style switch leaves `pack.relief` untouched while changing what is drawn.
- Custom goods: `data[45]` round-trips a `good-custom-*` `<svg>`, a chunk loading after the map does not
  remove it, the export pass copies it by id, and the editor picker lists it. Include ids on the
  built-in container and nested artwork elements; only built-in and custom icon roots enter the picker.
- e2e does not cover this path today: the `relief.html` snapshot is an empty hidden `<g>` and does not
  change. The relief layer is off by default, so any new assertion must `Layers.show("relief")` first
  (`style-presets.spec.ts` already measures a relief `<use>` that way). Every other layer snapshot must
  stay identical: relief is generated at draw time, after every other stage, so it cannot shift the
  seeded output of anything else.

## Acceptance Criteria

- `src/index.html` no longer contains `#defs-relief`, `#defs-icons` or the built-in goods symbols, and
  `#good-icons` stays in it as an empty container, filled only at runtime. It is ~44KB, down from 570KB.
- A fresh map loads exactly one relief chunk (its style's set), plus one per set pinned in the map, the
  burgs chunk and, when the goods layer or any goods-consuming controller needs it, the goods chunk.
  The worker still precaches all of them for offline use.
- Switching the relief set in the Style Editor redraws unpinned icons in the new set and leaves pinned
  icons alone; `pack.relief` is byte-identical before and after. Moving the size slider scales the drawn
  icons the same way, without touching `pack.relief`.
- Every union slot renders in every set, either as its own art or as an alias, pinned or not.
- Missing slots use available artwork deterministically across redraws, reloads and exports. Filling
  a slot with new artwork updates existing maps automatically while their descriptors stay unchanged.
- A `.map` saved before the change draws the same relief: the artwork and the per-icon set choices are
  recovered independently of the previously open map's style. Variant numbers are renumbered; simple
  grass dimensions are compensated once to preserve its rendered size and position.
- SVG and PNG exports include every definition the exported map references—built-in `<symbol>` or custom
  `<svg>`, including alias dependencies—even when requested before the required chunks finish loading.
  Icon choices and custom art reflect the map at export start even if the live map changes while
  loading. A chunk failure reports an export error rather than silently omitting icons.
- Failed icon loads produce a console error and an error-type UI tip identifying the affected set.
  Redraws do not repeatedly retry or report the same failure; an explicit user action can retry. A
  failed draw shows no icons and never blocks a dialog or a controller.
- The Relief Editor places, selects, replaces and removes icons and can pin one to a set, with `Default`
  meaning the style.
- Custom goods icons survive save, load, the editor picker and both exports unchanged.
- Goods pickers list each icon root once and exclude container groups and artwork internals.
- Goods icons appear in every consuming controller when it is opened first with the goods layer off.

## Documentation

- `docs/architecture/data-model.md`: `ReliefIcon` is `{ type, variant?, set?, x, y, s }`, stored as
  plain JSON; `set` is a pin that defaults to the style.
- New `docs/architecture/icons.md`: layout, the union and alias rule, source-file convention, current
  coverage per set, the custom-icon containers and reserved id spaces, how to add an icon, a variant or a
  set.
- `CONTEXT.md`: the `index.html` caution no longer mentions SVG `<defs>` as a major part of the file
  (it is 570KB / 3.5K lines today, not 9K).

## Out of Scope

- Drawing the missing artwork. Filling gaps is planned before release as separate artist work; the
  pipeline still supports gaps and the test prints them.
- Renaming burg or goods symbol ids for consistency with the relief scheme (would migrate user
  styles and presets for no functional gain).
- Deriving the gray set from the colored one at load time (their geometry differs; gray is its own art).
- Rasterized sprites, icon fonts or a WebGL renderer.
- Heraldic charges, marker images and textures, which already live in `public/`.
- Uploading custom art for relief and burgs. This change only guarantees the existing goods flow; the
  other two have no upload path, map field or custom id namespace.

## Further Notes

- The relief generator now rolls a variant for types that had a single one in the active set, and
  `coniferSnow` moves from a temperature branch to the Taiga biome weights, so seeded relief placement
  changes once. Simple grass carries its former `scale: 1.2` in its viewBox; the migration divides old
  simple-grass sizes by that factor and shifts their positions to preserve the center and appearance.
  Newly generated grass needs no size multiplier. Seeds for every other layer are untouched.
- Mixed sets on one map stay supported, now explicitly: an unpinned icon follows the style, a pinned one
  keeps its set. The defect was not the mixing but that the global set was implicit in every id and
  `changeSet` rewrote it away.
- `pack.relief` is a large part of a save—about 18% of a 4.35MB map with 12,750 icons—so the descriptor
  is kept as small as the data allows: an absent `variant` means 1 and an absent `set` means the style,
  and both are stored only when they carry information.
- The service worker precaches every build file, so the split saves first-paint fetch and parse, not
  cache size.
- The first draw after a set change runs before its chunk resolves and is redrawn when the promise
  resolves; live icons can be incomplete for the duration of that load. Exports and controller previews
  await their required chunks.
- The extraction of the current symbols into files is a one-off script that is not committed.

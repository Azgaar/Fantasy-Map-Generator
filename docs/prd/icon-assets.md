# PRD — Icon Assets

Updated: 2026-09-21. Covers the relief, burg/port and goods icons that `src/index.html` ships as inline
`<symbol>`s. The heraldic charges (`public/charges/`) and marker images already live outside the page
and are not affected.

## Problem Statement

`src/index.html` is 570KB and **389KB of it is icon markup**: relief 303KB (95 symbols in four sets),
burg and port icons 29KB (32 symbols), goods 57KB (72 symbols). Relief is the bulk, and it is the one
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

| Item | Decision | Why |
|---|---|---|
| Home folder | `src/assets/icons/` | Vite bundles it: one hashed chunk per set, cache-safe, precached by the PWA, served under Electron's `app://`. `public/` would need a sprite build script, `?v=` stamping and runtime `fetch`. |
| SVG or raster | SVG `<symbol>` + `<use>` | The map is SVG; burg and goods icons are recoloured through group `fill`/`stroke`; export inlines symbols; zoom must stay crisp. Rendering cost is DOM node count (already viewport-culled), not path complexity. Rasterizing only becomes relevant for a WebGL renderer. |
| Icon font / SDF | No | Fonts hold single-colour glyphs; relief is multicolour and burg icons need independent fill and stroke. SDF pays off only on the GPU. Either needs a font toolchain. |
| Atlas or texture | An SVG sprite per set: `<symbol>`s in `<defs>` | That is the SVG-native atlas. Sources stay individual files. |
| Build-time or runtime | Build assembles, runtime converts | `import.meta.glob(?raw)` gives one chunk per set with no custom script; turning `<svg>` into `<symbol>` is a string replace per icon. |
| Registry format | `src/data` holds the id contract (types, variant slots, preview tuning); the file system holds the art; a test reconciles both | Nothing is listed twice. Missing art is a test diff, not a guess. |
| Alignment across sets | One set-independent union of slots with alias fallback; per-set coverage is the directory listing | Sets become peers with no per-set fields or `base`/`suffix` mapping. Data never depends on a set, and adding a file needs no code change. |
| Per-icon set | An optional `set` pin per icon; absent means follow `styles.relief.options.set` | Picking an icon from another set is an existing editor feature. An explicit pin is data the author asked for; the defect was the *implicit* global set in every id and `changeSet` rewriting it away. |

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

Each set directory carries a one-line module so that Vite emits one chunk per set:

```ts
export default import.meta.glob("./*.svg", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
```

### Source file convention

- Root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">` with exactly the attributes the symbol
  needs; burg icons keep `width="1em" height="1em" overflow="visible"` (1em = the group's `size`).
- Attribution in `<metadata description="…" source="…" license="…"/>`, as the goods already do.
- Never `<title>`: through `<use>` it becomes a hover tooltip on every instance.
- Inner details of recolourable icons (burgs, goods) are strokes and fills without hard-coded colours
  where the group is expected to colour them.
- The simple `grass` icon's former `scale: 1.2` moves into its viewBox; proportions belong to the
  artwork, so the registry carries no size override.

### Registry (`src/data/relief-icons.ts`, `src/types/relief.ts`)

The registry describes the **id space**, not the sets. `RELIEF_TYPES` declares the union of slots every
set is measured against—`variants` is the widest coverage any one set has—so a stored `type`/`variant`
resolves in all four sets, pinned or not, and a style change can never invalidate it. Which slots a set
draws is its directory listing, and a set that fills fewer of them aliases the rest at load time. There
is no per-set registry entry: the old `base`/`suffix` mapping is gone and all four sets are peers.

```ts
export const RELIEF_SETS: Record<ReliefSet, string> = { simple: "Simple", colored: "Colored", gray: "Gray", illustrated: "Illustrated" };

// literal union of the catalog's types, so a typo in stored data or in the catalog is a compile error
export type ReliefTypeName = (typeof RELIEF_TYPES)[number]["type"];

// Variants are 1..variants and name the same slot in every set. A set drawing no art of a slot aliases
// it: its own variant 1 of the type, else variant 1 of `fallback`. The map data is never rewritten.
export interface ReliefType {
  type: ReliefTypeName;
  variants: number; // widest coverage across the sets, colored today
  zoom?: number; // editor preview magnification, 1 by default
  fallback?: ReliefTypeName; // type to borrow when the active set draws none of this one
}

export const RELIEF_TYPES = [
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
] as const satisfies readonly ReliefType[];

// the state stores these three fields; only the renderer turns them into a symbol id.
// the reserved custom branch is under Custom icons
export type ReliefIconRef = { type: ReliefTypeName; variant?: number; set?: ReliefSet };
export const reliefSymbolId = (icon: ReliefIconRef, styleSet: ReliefSet) =>
  `relief-${icon.set ?? styleSet}-${icon.type}-${icon.variant ?? 1}`;
```

`zoom` is the editor preview magnification; it is per type too, so the editor looks the same in every
set. Dropping a file for a declared slot needs no code change; only a genuinely new type, or a variant
past `variants`, edits the registry, because that changes the id space every set is measured against.
`RELIEF_CHOICES`, `ReliefSetDefinition` (with its `base`/`suffix`) and `ReliefTypeIcons` go away;
`styles-schema.ts` reads `RELIEF_SETS` directly. `src/data/burg-icons.ts` keeps its `SETS`,
`BURG_ICONS` and `PORT_ICONS`.

### Loader (`src/renderers/icon-sets.ts`)

```ts
const SPRITES = {
  "relief-simple": { prefix: "relief-simple-", files: () => import("@/assets/icons/relief/simple") },
  // relief-colored, relief-gray, relief-illustrated
  burgs: { prefix: "icon-", files: () => import("@/assets/icons/burgs") },
  goods: { prefix: "good-", files: () => import("@/assets/icons/goods") }
};
export type IconSet = keyof typeof SPRITES;
export const isIconSetLoaded = (set: IconSet): boolean;
export function loadIconSet(set: IconSet): Promise<void>; // idempotent, memoised
```

`loadIconSet` rewrites each file's root `<svg …>` to `<symbol id="…" …>` (dropping `xmlns*`), then walks
the union: for every `RELIEF_TYPES` slot the set has no file for it emits an alias symbol (its own
variant 1 of the type, else variant 1 of the `fallback` type), so every `type`/`variant` a map can hold
resolves in every set, pinned or not. The result is injected into `#defElements defs` as
`<g id="icons-<set>">`. Goods go into `<g id="good-icons">`, which the move leaves in `index.html` empty.

Every loader **appends** and never clears or replaces its container's children, because a container can
hold runtime art that no chunk provides. That matters for goods today: custom user-uploaded icons are
appended by the good editor and restored from map field `data[45]` on load, so a chunk that arrives after
the map must not wipe them. `isIconSetLoaded` tracks the chunk only and never inspects the container.

The `<svg>`→`<symbol>` rewrite and the alias walk are plain string work on the glob's values, so
`icon-sets.test.ts` runs in the node project; only the injection touches the DOM.

Renderers call `loadIconSet(set)` at the top of their draw and, if the set was not loaded yet, redraw
their layer when the promise resolves. The synchronous draw proceeds regardless; browsers also resolve
`<use>` targets that appear later. Relief loads the style's set plus every distinct `set` pinned in
`pack.relief`, so a forked map pulls those chunks too while a fresh one pulls a single chunk. The Relief
Editor loads a set on demand when the author picks it in the set control.

### Data model and generator

- `ReliefIcon` is `{ type, variant?, set?, x, y, s }`. `variant` defaults to `1`; `set` is an optional pin,
  and an absent `set` means the icon is drawn in `styles.relief.options.set`. Absent must mean "follow the
  style", not "equals the style when saved", or a style change would silently re-pin every icon.
- `Relief.generate` writes `type` and `variant` (picked uniformly from the union, regardless of set) and
  never writes `set`, so generated icons follow the style and a later style change cannot put a stored
  icon out of range. `changeSet`, `pickIcon`, `getTypeIcons`, `findType` and `getReliefIconId` are
  deleted; `changeSize` stays.
- Serialization is canonical so `load → save` is stable: the in-memory icon always carries `variant` and
  `save.ts` drops it when it is `1`; `set` is written only when pinned.
- `coniferSnow` stops being a relief-side temperature branch. It becomes a normal entry in the cold
  biome icon weights (`biomes-generator.ts`, Taiga today), and the `type === "conifer" && temp < 0` swap
  in `getBiomeIcon` is deleted, so the biome-icon path no longer reads temperature. The height-based
  `mountSnow` pick in `getReliefIcon` is unrelated and stays. `RELIEF_TYPES` gets no biome flag.
- The `changeReliefSet` style effect and the preset applier only redraw the layer—that is what preserves
  pins: a style change rewrites no data at all.

### Renderers and export

- `draw-relief-icons.ts` writes the symbol id from the descriptor:
  `#relief-${icon.set ?? styles.relief.options.set}-${icon.type}-${icon.variant ?? 1}`;
  `draw-burg-icons.ts` and `draw-goods.ts` load their set.
- `services/io/export.ts` replaces the three per-family inlining blocks with one pass: collect every
  `use[href^="#"]` target in the clone and copy the element it names from `#defElements` when the clone
  does not already have it. It must copy **by id, not by tag**: custom goods icons are raw `<svg>`
  elements, and the goods block already selects them that way. The no-op `#defs-relief` removal in
  `removeUnusedElements` is dropped.

### Editors

- Relief Editor: the **Set** control stays, but becomes `Default (style)` plus the four sets, and writes
  the icon's `set` pin only for a concrete choice; `Default` is what an unpinned icon shows. The grid is
  `RELIEF_TYPES` × variants for the icon's effective set, and picking another set in the control loads
  that chunk before drawing previews (the editor builds all four grids eagerly today, which would defeat
  the split). Grid entries carry `data-type="mount"`, `data-variant="3"` and `data-set`, and previews go
  through `<use href="#relief-<icon.set ?? style>-mount-3">`.
- Good editor and goods editor await `loadIconSet("goods")` before enumerating `#good-icons [id]`—not
  `symbol`, because a custom upload is a `<svg>` (see Custom icons).
- Burg icon pickers in the Style Editor await `loadIconSet("burgs")` before drawing previews.

### Custom icons

A map can carry art no chunk provides. Goods support this today and the split must not break it; burgs
and relief are seams left deliberately for later.

**Goods (in scope).** The upload path is unchanged: the editor appends `<svg id="good-custom-<id>">`
(wrapped raster or sanitized SVG) to `#good-icons`, `save.ts` stores the `outerHTML` of
`#good-icons [id^="good-custom-"]` in `data[45]`, and `load.ts` clears the previous set and re-inserts it
before migrations run. Three rules keep that working after the move:

- the loader appends built-ins into a child group of `#good-icons` and leaves existing children alone;
- the export pass copies the referenced element by id, whatever its tag;
- the good editor enumerates its picker from `[id]`, not `symbol`. The container holds `<svg>` customs
  beside `<symbol>` built-ins and `good-editor.ts:15` lists only symbols today, so a restored custom icon
  is missing from the dropdown until this is fixed.

**Burgs and relief (out of scope).** Documented so the seams exist rather than being discovered later:

- Burgs already render unknown ids—`burgIcon` falls back to a "custom icon" entry and `burgIconPreview`
  draws `<use href>`—so what is missing is an upload path, a map field beside `data[45]`, picker
  enumeration of custom ids, and excluding custom ids from the "listed icons have a file" test. The
  append-only loader rule is what keeps it possible.
- Relief composes its symbol id from `set`/`type`/`variant`, so custom relief art cannot be a normal slot
  without either overriding a chunk symbol (coupling the loader to map data) or living in its own id
  space. Reserve `relief-custom-<id>` now and give the descriptor a custom branch, so the composed id
  never has to be overridden:

  ```ts
  type ReliefIcon =
    | { type: ReliefTypeName; variant?: number; set?: ReliefSet; x: number; y: number; s: number }
    | { custom: string; x: number; y: number; s: number };
  // reliefSymbolId: custom ? `relief-custom-${custom}` : `relief-${set ?? style}-${type}-${variant ?? 1}`
  ```

  A custom relief icon is set-independent, so a style change leaves it alone, and the editor grid lists
  `RELIEF_TYPES` plus the custom symbols the map carries, the way the goods picker does.

### Migration (`services/io/auto-update.ts`, next version)

`pack.relief[].icon` `relief-<type>-<n>[-bw|-illustrated]` becomes
`{ type, variant?, set?, x, y, s }`:

- **`variant`.** For ids without a suffix or with `-bw`, and a type the simple set shares (mount, hill,
  dune, deciduous, conifer, acacia, palm, grass, swamp): `m = n === 1 ? 1 : n - 1`; otherwise `m = n`.
  The offset matches the file renumbering, so the artwork is unchanged and only the number shifts.
- **`set`.** The pin is recovered from the old id against the map's `styles.relief.options.set`: `-bw`
  names the gray art, `-illustrated` the illustrated art, and an unsuffixed id names the simple art when
  it is variant `1` of a shared type, the colored art otherwise. Write `set` only when that differs from
  the map's set, so a map generated with one style gets no pins and a mixed map keeps its overrides—the
  property `changeSet` used to destroy.

Two icons that differed only by set can end up with the same `type`/`variant` but different `set`; they
stay distinct and no icon instance is dropped. The small historical table this needs—the shared-type list
and the suffix→set map—is inlined in `auto-update.ts` even though `RELIEF_ICONS` is deleted. The v1.142
migration that lifted relief out of the SVG keeps emitting old-format ids and the new step runs after it.
The `icon-anchor` symbol rewrite goes: the extracted art is the same drawing and the symbol is no longer
in the document until the burgs set loads, so the rewrite only ever replaced it with itself.

## Testing Decisions

- `src/data/relief-icons.test.ts` (node): reads `src/assets/icons/relief/<set>/` with `fs` and fails on a
  file whose type is not in `RELIEF_TYPES` or whose variant exceeds `variants`. It also asserts the union
  is tight (each type's highest declared variant exists in some set, and each set's files for a type run
  contiguously from 1) and prints the derived coverage table. The gap list is a property of the
  directories, so there is no `KNOWN_GAPS` constant to maintain (today: simple fills 9 of 34 slots,
  colored and gray 34, illustrated 18).
- `relief-generator.test.ts`: every union slot resolves in every set through the alias rule, and a
  generated icon is `{ type, variant }` with no `set`; the `index.html` scan goes.
- `burg-icons.test.ts` and `styles.test.ts`: listed and preset icons have a file in
  `src/assets/icons/burgs/`. The jsdom assertions that parse `src/index.html` move to the extracted
  `<svg>`; the "Illustrated icons retain accent colors while their main surfaces inherit group paint"
  checks are the ones that matter.
- `icon-sets.test.ts` (node): `<svg>` → `<symbol>` conversion, alias emission for unfilled slots,
  idempotent loading, and that a pinned map asks for every set it references.
- `auto-update.test.ts`: the variant table (`-bw`, `-illustrated`, mixed-set) and pin recovery against
  the map's `styles.relief.options.set`—a colored map holding `relief-mount-1` becomes
  `{ type: "mount", variant: 1, set: "simple" }`—plus the existing "restores every defs element
  index.html declares" test, whose expected list is sliced out of `@/index.html?raw` and so shrinks with
  the move.
- A `pack.relief` round-trip: `save → load → save` is byte-identical with `variant: 1` and an unpinned
  `set` omitted, and a style switch leaves `pack.relief` untouched while changing what is drawn.
- Custom goods: `data[45]` round-trips a `good-custom-*` `<svg>`, a chunk loading after the map does not
  remove it, the export pass copies it by id, and the editor picker lists it.
- e2e does not cover this path today: the `relief.html` snapshot is an empty hidden `<g>` and does not
  change. The relief layer is off by default, so any new assertion must `Layers.show("relief")` first
  (`style-presets.spec.ts` already measures a relief `<use>` that way). Every other layer snapshot must
  stay identical: relief is generated at draw time, after every other stage, so it cannot shift the
  seeded output of anything else.

## Acceptance Criteria

- `src/index.html` no longer contains `#defs-relief`, `#defs-icons` or the built-in goods symbols, and
  `#good-icons` stays in it as an empty container, filled only at runtime. It is ~180KB, down from 570KB.
- A fresh map loads exactly one relief chunk (its style's set), plus one per set pinned in the map, the
  burgs chunk and, with the goods layer on, the goods chunk. The worker still precaches all of them for
  offline use.
- Switching the relief set in the Style Editor redraws unpinned icons in the new set and leaves pinned
  icons alone; `pack.relief` is byte-identical before and after.
- Every union slot renders in every set, either as its own art or as an alias, pinned or not.
- A `.map` saved before the change draws the same relief: the artwork and the per-icon set choices are
  recovered, and only the variant numbers shift with the renumbering.
- SVG and PNG exports include every definition the exported map references—built-in `<symbol>` or custom
  `<svg>`—whether it was in the page or loaded on demand.
- The Relief Editor places, selects, replaces and removes icons and can pin one to a set, with `Default`
  meaning the style.
- Custom goods icons survive save, load, the editor picker and both exports unchanged.

## Documentation

- `docs/architecture/data-model.md`: `ReliefIcon` is `{ type, variant?, set? }` plus position and size;
  `set` is a pin that defaults to the style, and `{ custom }` is reserved for map-carried art.
- New `docs/architecture/icons.md`: layout, the union and alias rule, source-file convention, current
  coverage per set, the custom-icon containers and reserved id spaces, how to add an icon, a variant or a
  set.
- `CONTEXT.md`: the `index.html` caution no longer mentions SVG `<defs>` as a major part of the file
  (it is 570KB / 3.5K lines today, not 9K).

## Out of Scope

- Drawing the missing artwork. The pipeline makes gaps harmless and the test prints them; filling them is
  artist work.
- Renaming burg or goods symbol ids for consistency with the relief scheme (would migrate user
  styles and presets for no functional gain).
- Deriving the gray set from the colored one at load time (their geometry differs; gray is its own art).
- Rasterized sprites, icon fonts or a WebGL renderer.
- Heraldic charges, marker images and textures, which already live in `public/`.
- Uploading custom art for relief and burgs. The seams are documented under Custom icons; this change
  only guarantees the existing goods flow and reserves `relief-custom-<id>` for later.

## Further Notes

- The relief generator now rolls a variant for types that had a single one in the active set, and
  `coniferSnow` moves from a temperature branch to the Taiga biome weights, so seeded relief placement
  changes once. Simple grass carries its former `scale: 1.2` in its viewBox, so its stored size shrinks
  by that factor once. Seeds for every other layer are untouched.
- Mixed sets on one map stay supported, now explicitly: an unpinned icon follows the style, a pinned one
  keeps its set. The defect was not the mixing but that the global set was implicit in every id and
  `changeSet` rewrote it away.
- `pack.relief` is a large part of a save—about 18% of a 4.35MB map with 12,750 icons—and `.map` files are
  plain text, so the descriptor omits `variant: 1` and an unpinned `set`. That keeps the new format
  smaller than today's set-specific ids.
- The service worker precaches every build file, so the split saves first-paint fetch and parse, not
  cache size.
- The first draw after a set change runs before its chunk resolves and is redrawn when the promise
  settles; that one JIT-load frame is the only new moment of incomplete icons.
- The extraction of the current symbols into files is a one-off script that is not committed.

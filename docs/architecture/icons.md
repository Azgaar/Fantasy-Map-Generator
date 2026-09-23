# Icon assets

Artwork lives in `src/assets/icons/` as standalone SVG files, one directory per **icon set**:

```
src/assets/icons/
  relief/{simple,colored,gray,illustrated,stickers}/<type>-<variant>.svg    set relief-<set>   id relief-simple-mount-1
  burgs/<style>/<name>.svg                                         set burgs          id burgs-atlas-circle, burgs-watabou-capital
  ports/<name>.svg                                                 set ports          id ports-anchor
  goods/<name>.svg                                                 set goods          id goods-wood
```

**Symbol id = set id + `-` + file path within the set, with `/` as `-`.** Nothing composes ids by hand:
`IconSets.symbolId(set, file)` is the one rule, `IconSets.setForId(id)` inverts it. Every burg style is a
subdirectory (`burgs/atlas/`, `burgs/watabou/`, `burgs/illustrated/`), so a name carries its style and
the picker groups by it.

## Defining a set

A set is an `IconSet` (`src/types/icons.ts`), and the **model that draws it owns it**:

```ts
interface IconSet {
  id: string; // the chunk id and the symbol id prefix
  folder: string; // the directory under src/assets/icons/
  em?: number; // user units per em: anchored art, sized in em by the loader
  aliases?: (names: readonly string[]) => IconAlias[]; // symbols for ids the directory does not draw
}
```

- `Relief.iconSets` — one per relief set (`relief/<set>`), with `aliases` resolving the union slots the
  directory has no file for (`Relief.aliasSlots`).
- `Burgs.iconSets` — `burgs` and `ports`, both `em: 10`.
- `Goods.iconSet` — `goods`; map-carried uploads use `IconSets.customPrefix("goods")`.

`components/icon-sets.ts` is family-agnostic: `IconSetRegistry.sets()` lists the models, and every set goes through
the same steps — glob the directory (`import.meta.glob(?raw)`, one hashed lazy chunk per set via
`manualChunks` in `vite.config.ts`), turn each `<svg>` root into `<symbol id>`, apply `em` framing if
declared, append `aliases` if declared, inject the whole group as `<g id="icons-<set>">` into
`#defElements defs`. `IconSetRegistry` (`IconSets`) owns loading: `load` returns the shared attempt and
never rejects, `retry` starts a fresh attempt for an explicit demand (a picker, an export), `isLoaded`
answers after the fact, `files(set)` lists the directory synchronously (pickers need no chunk to list
choices). Failed attempts leave no partial definitions, report once, and stay failed until a `retry`;
renderer redraws never retry. Export asserts `isLoaded` after the wait, so a chunk that never arrived
fails the export instead of silently dropping icons.

To add:

- **artwork to an existing set** — drop the file in the directory. No code changes. The picker (burgs, goods)
  or the union (relief) sees it.
- **a burg style** — a subdirectory under `burgs/` like `atlas/`; its name becomes the picker heading.
- **a relief set** — a directory under `relief/` and its name in `Relief.sets`.
- **a relief type or variant** — extend `Relief.types`, provide artwork and a fallback, run the coverage tests.
- **a new family** — give its model an `IconSet` and list the model in `IconSetRegistry.sets()`; its
  renderer awaits `IconSets.load(id)` before drawing. Declare `em` if the art is anchored, `aliases` if
  some ids must resolve without a file.

## Anchored art (`em`)

Burg and port art is drawn around its anchor, the origin, at **10 user units per em**: the plain circle
(`r=5`) is 1em wide, so a group `size` of 1 draws it 1 map unit wide. The loader keeps the file's frame,
sizes the symbol in em (`width="1.26em"`) and translates the art so the anchor sits at the frame's corner;
`<use x y>` under the group's `font-size` then lands the anchor on the burg with the art overflowing
around it. Inherited `stroke-width` resolves in the art's own units, so a `scale()` wrapper preserves
both the size and the stroke weight of art drawn at another scale. Previews (`style-editor/icon-preview.ts`)
frame a symbol with its own viewBox, read from the loaded set.

## Logical relief slots

`Relief.types` declares the union of `type`/`variant` slots every set is measured against; a stored
descriptor `{ type, variant?, set? }` resolves in every set, pinned or not, and a style change never
edits `pack.relief`. The renderer resolves the absent `variant` to 1 and the absent `set` to
`styles.relief.options.set`; `s` is the base size and `styles.relief.options.size` a render multiplier
anchored at the icon's centre (the z-order key).

Each set resolves all 34 union slots. `Relief.aliasSlots` owns the rule: exact files win. For a missing
slot, collect real files of the same type in numeric variant order; if there are none, follow the
catalog's fallback type chain. Select `available[(variant - 1) % available.length]` and emit an alias
symbol containing a `<use>`. Aliases are never candidates; a missing terminal target or an unproductive
cycle is an error. Filling a slot updates existing maps, including pinned icons. Released slots must never
be renumbered, reassigned or removed without migration.

Current coverage (the unit test derives the full missing-slot list from directories):

| Set         | Real artwork | Aliased slots |
| ----------- | -----------: | ------------: |
| simple      |           18 |            16 |
| colored     |           34 |             0 |
| gray        |           34 |             0 |
| illustrated |           34 |             0 |
| stickers    |           34 |             0 |

Stickers uses hand-drawn paths and flat base and shadow colors. Its ground lines sit around 72% of the
box for mountains, 62% for hills and trees, and 56–58% for low plants and dunes; keep this padding when
editing artwork, as tight framing makes vegetation overwhelm the map.

The relief Style Editor writes `stroke` and `stroke-width` on the relief group and every icon inherits
them, so an icon's stroke unit is its viewBox. All icons of a type share one viewBox width, sized to the
type's generated footprint so a width draws equally thick on every icon: 130 for mountains and volcanoes,
50 for hills, 90 for everything else. Bring new art to that width by scaling its coordinates: a `scale()`
wrapper keeps the art's old stroke unit.
Every icon keeps at least one inheriting shape; fill-only shapes set `stroke="none"`. Where shading would
cover the silhouette's stroke, a `fill="none"` copy of the silhouette is drawn over the art. Thin glyphs
(grass, reeds, bare branches, palm fronds) sit in a `scale(k)` group with coordinates scaled by `1/k`, so
their outline draws at `k` of the icon's weight instead of swallowing the shape. Keep structural details
and accents, such as cattail heads and lava, as filled paths so they survive a zero width and a recolour.
Presets set the width that restores each set's former linework: simple `1`, illustrated `1.2`, gray `0.4`.

## Editing artwork

Every file is a plain, previewable SVG: a root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">`
whose viewBox frames the art, with no sizing or overflow attributes. Anchored art has the origin inside
its frame (a negative viewBox origin). Preserve inherited fills and strokes on recolourable surfaces and
intentional accent colours. Credit third-party art in a `<desc>` element — the goods and the Watabou
burg icons do; the relief and in-project burg art carry none. Do not add `<title>`: `<use>` instances
would display it as a tooltip. Proportions belong in the viewBox, not in code. UI glyphs are not icon-set
assets: a button that needs one inlines its SVG in its own markup.

## Map-carried art and exports

A map can carry art no set provides. Its ids use the reserved namespace `custom-<set>-…`
(`IconSets.customPrefix`), never a set's own, so the registry needs no special case, and
`IconSets.customIcons(set)` lists them. Only goods use it today: the good editor appends
`<svg id="custom-goods-<id>">` to `#defElements defs` beside the loaded groups, map field 45 persists
the ones `pack.goods` references (unused uploads are dropped on save), and loading clears the previous
map's uploads without touching the groups. An uploaded SVG is parsed inertly and stripped of scripting
and external references (`sanitizeSvgIcon`), and its inner ids and classes are prefixed with the upload's
id (`scopeSvgIcon`), so it neither collides with the document nor styles it. The good editor lists
`IconSets.files("goods")` plus those uploads. Burg and relief uploads are
not implemented; the append-only loader and the reserved namespace are the seam for them.

`export.ts` reconciles its clone for the requested bounds before its first asynchronous wait, captures
referenced map-carried definitions, and derives the required sets from the remaining references through
`setForId`. It then waits for the sets and walks local `href`/`xlink:href` dependencies, copying by id
regardless of tag and deduplicating cycles. Only loaded groups may be read after waiting, so the export
reflects the map as it was when it started. Failed sets fail the export.

## History

Version 1.154 moved the icons out of `index.html` and derived every symbol id from its file path. It
migrates old relief ids (`relief-mount-3-bw`) into descriptors after the style migrations, recovering pins
against the incoming map's styles, and renames `#icon-<name>` to `#burgs-atlas-<name>` (or `#burgs-<name>`
for names that already carried their style) / `#ports-<name>` in
style records (`styles-legacy.ts`, so presets are covered too), `good-<name>` to `goods-<name>` and
`good-custom-<id>` to `custom-goods-<id>` in `pack.goods` and field 45.

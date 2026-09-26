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
- `Goods.iconSet` — `goods`.

`components/icon-sets.ts` (`IconSets`) is the family-agnostic catalog of the built-in sets and touches no
DOM: `sets()` lists the models, `files(set)` lists a directory synchronously (pickers need no chunk to list
choices), and `read(set)` turns a set into symbols — glob the directory (`import.meta.glob(?raw)`, one hashed
lazy chunk per set via `manualChunks` in `vite.config.ts`), turn each `<svg>` root into `<symbol id>`, keep
an anchored set's frame unclipped, append `aliases` if declared.

`components/icons.ts` (`Icons`) puts them in the page, as `<g data-set="<set>">` in
`#defElements defs > g#icons-library`. `load` returns the shared attempt and never rejects, `retry` starts a
fresh attempt for an explicit demand (a picker, an export), `isLoaded` answers after the fact. Failed
attempts leave no partial definitions, report once, and stay failed until a `retry`; renderer redraws never
retry. Export asserts `isLoaded` after the wait, so a chunk that never arrived fails the export instead of
silently dropping icons.

To add:

- **artwork to an existing set** — drop the file in the directory. No code changes. The picker (burgs, goods)
  or the union (relief) sees it.
- **a burg style** — a subdirectory under `burgs/` like `atlas/`; its name becomes the picker heading.
- **a relief set** — a directory under `relief/` and its name in `Relief.sets`.
- **a relief type or variant** — extend `Relief.types`, provide artwork and a fallback, run the coverage tests.
- **a new family** — give its model an `IconSet` and list the model in `IconSetRegistry.sets()`; its
  renderer awaits `Icons.load(id)` before drawing. Declare `em` if the art is anchored, `aliases` if
  some ids must resolve without a file.

## Anchored art (`em`)

Burg and port art is drawn around its anchor, the origin, at **10 user units per em**: the plain circle
(`r=5`) is 1em wide, so a group `size` of 1 draws it 1 map unit wide. The symbol keeps the file's
anchor-relative frame (a negative viewBox origin) and never clips it, so anywhere else it is an ordinary
boxed icon. The burg renderer alone places it around the point: `Icons.anchoredBox(id)` is the frame
over `em`, the group translates by its origin in em, and each `<use x y>` is as wide as the frame in em,
under the group's `font-size`. Any other icon on a burg gets the box `[-0.5, -0.5, 1, 1]`: centred on
the point. Inherited `stroke-width` resolves in the art's own units, so a `scale()` wrapper preserves
both the size and the stroke weight of art drawn at another scale.

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

## Icon references

Every icon slot stores a **bare symbol id** and draws a `<use>`; the `#` is added where the href is
written (`Icons.href`). `Icons` is the one entry point for a reference, whatever its source: its `kind`,
`name`, `frame`, `href` and `html`. An empty reference is no icon. Three kinds of id resolve:

- **Set icons** — `<set>-<path>`, loaded as above. `href` starts the set's chunk, so a marker may use a
  goods icon; `<use>` resolves the id once the chunk lands.
- **Glyphs** — any short text, `glyph-<code points in hex>` (`Icons.glyph`, `Icons.glyphText`). `href` builds
  the symbol on first use in the `glyph` group: the text centred in a `0 0 100 100` frame at font size 100,
  so a box of `n` draws it as large as `n`-sized text did. It sets no font, fill or shadow, so it takes them
  from where it is drawn, and no stroke, which would outline emoji.
- **Custom icons** — `custom-<8 hex>` (`custom-goods-<id>` for uploads kept from older maps), the
  pictures in `options.map.customIcons` (`CustomIcons`, beside `Icons` in `components/icons.ts`). Each is SVG
  markup or an image URL with its frame. `Icons.syncCustom()` rebuilds the `custom` group from the list
  on generation, after a load and after a change; SVG content is sanitised again on the way, since a
  file may carry anything, and an image must be an `http(s)` or `data:image/` URL.

The slots are goods, markers, regiments, military unit types, burg group icons and anchors, and the market
marker; `Icons.uses(id)` counts the references in each.

`Icons.html(id)` draws an icon in the interface — editors, overviews, the picker: an inline svg boxing the
icon in its own frame. Art takes a default paint (a burg's white fill and dark stroke) where no style colours
it; a glyph takes the text colour. The icon picker (`controllers/icon-picker/`) takes only the current icon
and a callback, offers one tab per source — Built-in, Emoji, Custom — and opens on the tab holding the
current icon with its set expanded, else on Built-in.

## Authoring custom icons

`controllers/icon-picker/pictures.ts` turns input into a picture — kind, content, frame — and throws messages
meant for the author. A link must be `http(s)` and load as an image. An SVG upload (up to 200 kB) is
sanitised, keeps its root's paint on a wrapping group and is scoped to the icon's id. A raster upload
(up to 2 MB) is redrawn at 256 px on its longer side and stored as WebP, or PNG where the browser cannot
encode WebP. A new picture is **fitted**: a square around its visible content, padded by 5% — the SVG
bounding box, the opaque pixels of an image, or the whole box for a link whose pixels the site does not
share.

The Custom tab adds by link or upload and picks the new icon; Replace gives an icon a new picture under
its id, so every slot follows; Remove confirms with the uses `Icons.uses` counts and leaves the
references to draw nothing. The positioner (`controllers/icon-picker/positioner.ts`) zooms and pans a square
frame, writing the symbol's `viewBox` as it moves so the map and the previews follow; Cancel restores
it and Apply stores it. Every change rebuilds the custom symbols (`Icons.syncCustom`).

## Exports

`export.ts` reconciles its clone for the requested bounds before its first asynchronous wait, captures
referenced definitions a chunk does not own (glyphs, custom icons), and derives the required sets from
the remaining references through `setForId`. It then waits for the sets and walks local
`href`/`xlink:href` dependencies, copying by id regardless of tag and deduplicating cycles. Only loaded
groups may be read after waiting, so the export reflects the map as it was when it started. Failed sets
fail the export. A raster export draws the SVG as an image, which fetches no external files, so linked
custom images are inlined as base64 where the host allows it and dropped where it does not; an SVG
export keeps its links.

## History

Version 1.154 moved the icons out of `index.html` and derived every symbol id from its file path. It
migrates old relief ids (`relief-mount-3-bw`) into descriptors after the style migrations, recovering pins
against the incoming map's styles, and renames `#icon-<name>` to `#burgs-atlas-<name>` (or `#burgs-<name>`
for names that already carried their style) / `#ports-<name>` in
style records (`styles-legacy.ts`, so presets are covered too), `good-<name>` to `goods-<name>` and
`good-custom-<id>` to `custom-goods-<id>` in `pack.goods` and field 45.

Version 1.154.0 made every slot a bare icon reference. The 1.154.0 auto-update step migrates an older map,
and generation migrates the unit types a browser keeps between maps:
goods uploads in map field 45 become custom icons under their ids (field 45 is written empty since),
inline `data:` images and URLs become one custom icon per distinct value, text becomes glyphs, and
`#`-prefixed ids lose the `#`. Stored and shipped style presets are rewritten the same way by
`normalizeStyles`.

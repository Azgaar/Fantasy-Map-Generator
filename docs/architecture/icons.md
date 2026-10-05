# Icon assets

How icons are stored, loaded and drawn. The user-facing guide is the [Icons wiki page](../wiki/Icons.md).

Artwork lives in `src/assets/icons/` as standalone SVG files, one directory per **icon set**:

```
src/assets/icons/
  relief/{simple,colored,gray,illustrated,stickers}/<type>-<variant>.svg    set relief-<set>   id relief-simple-mount-1
  burgs/<style>/<name>.svg                                         set burgs          id burgs-atlas-circle, burgs-watabou-capital
  ports/<name>.svg                                                 set ports          id ports-anchor
  goods/<name>.svg                                                 set goods          id goods-wood
  charges/<category>/<name>.svg                                   set charges-<category> id charges-beasts-lionRampant
```

**Symbol id = set id + `-` + file path within the set, with `/` as `-`.** Nothing composes ids by hand:
`IconSets.symbolId(set, file)` is the one rule, `IconSets.setForId(id)` inverts it. Every burg style is a
subdirectory (`burgs/atlas/`, `burgs/watabou/`, `burgs/illustrated/`), so a name carries its style and
the picker groups by it.

## Defining a set

A set is an `IconSet` (`src/types/icons.ts`), and the **model that draws it owns it**:

```ts
interface IconSet {
  id: string; // the chunk id, the symbol id prefix and the directory: relief-simple ↔ relief/simple
  group: string; // the picker heading it is listed under
  em?: number; // user units per em: anchored art, sized in em by the loader
  aliases?: (names: readonly string[]) => IconAlias[]; // symbols for ids the directory does not draw
  prepare?: (svg: string, symbolId: string) => string; // rewrite a file before it becomes a symbol
  paint?: IconPaint; // what the art's open fill and stroke take where the slot sets none
}
```

- `Relief.iconSets` — one per relief set (`relief/<set>`), with `aliases` resolving the union slots the
  directory has no file for (`Relief.aliasSlots`).
- `Burgs.iconSets` — `burgs` and `ports`, both `em: 10`.
- `Goods.iconSet` — `goods`.
- `Emblems.iconSets` — one per charge category; `prepare` frames Armoria artwork and scopes internal ids.

`components/icon-sets.ts` (`IconSets`) is the family-agnostic catalog of the built-in sets and touches no
DOM: `sets()` lists the models in picker order, `files(set)` lists a directory synchronously (pickers need no chunk
to list choices), `fileOf(id)` names the set and file a symbol is drawn from, and `read(set)` turns a set
into symbols — glob the directory (`import.meta.glob(?raw)`, one hashed lazy chunk per set via
`manualChunks` in `vite.config.ts`), turn each `<svg>` root into `<symbol id>`, keep an anchored set's frame
unclipped, append `aliases` if declared.

`components/icons.ts` (`Icons`) puts them in the page, as `<g data-set="<set>">` in
`#defElements defs > g#icons-library`. `load` returns the shared attempt and never rejects, `retry` starts a
fresh attempt for an explicit demand (a picker), `require` retries and rejects for a demand that must succeed.
Failed attempts leave no partial definitions, report once, and stay failed until a `retry`; renderer redraws
never retry. Exports and emblem downloads `require` their sets, so a chunk that never arrived fails them instead
of silently dropping icons.

To add:

- **artwork to an existing set** — drop the file in the directory. No code changes. The picker (burgs, goods)
  or the union (relief) sees it.
- **a burg style** — a subdirectory under `burgs/` like `atlas/`; its name becomes the picker heading.
- **a relief set** — a directory under `relief/` and its name in `Relief.sets`.
- **a relief type or variant** — extend `Relief.types`, provide artwork and a fallback, run the coverage tests.
- **a new family** — give its model an `IconSet` and list the model in `IconSetRegistry.sets()` at its picker place; its
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
both the size and the stroke weight of art drawn at another scale. The flip side: a wrapper scales the
group's outline too, so art meant to share it with the rest of its set (the `atlas` shapes, `ports/harbor`) is
drawn at 10 units/em with no transform.

## Logical relief slots

A relief icon is either a type slot, described below, or `{ icon }`: any icon reference, drawn as it is
whatever the style's set. The renderer writes every `<use>` through `Icons.href`, so another family's set
starts loading; `Relief.requiredIconSets` covers only the relief sets.

A biome's **relief pool** (`pack.biomes[].icons`) weighs relief types and icon references for its lowland
relief; a relief rule (`options.map.relief.rules`, see [the data model](data-model.md#relief)) carries its
own pool for the cells it claims. Generation picks an entry with one roll against the cumulative weights in record order — the same
entry the older list of repeated entries gave, so seeds reproduce — and a type entry then rolls its
variant. An entry's `size` multiplies the icon size and spends no roll, so it never shifts a seed. Interface previews of relief art — the Relief Editor tiles, the pool dialog, the Biomes Editor
column — are painted in the relief style and cropped to the drawn art (`controllers/relief-previews.ts`),
since relief art sits small in its frame. The pool dialog also draws an uncropped sample patch at the map's sizes and spacing,
from its own seeded rolls, three a point, so resizing or reweighting one entry leaves the other icons in place.

`Relief.types` declares the union of `type`/`variant` slots every set is measured against; a stored
descriptor `{ type, variant?, set? }` resolves in every set, pinned or not, and a style change never
edits `pack.relief`. The renderer resolves the absent `variant` to 1 and the absent `set` to
`styles.relief.options.set`; `s` is the base size and `styles.relief.options.size` a render multiplier
anchored at the icon's centre; the z-order key is the box bottom.

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

The relief Style Editor writes `stroke` on the relief group and every stroked shape inherits its colour.
The width is baked into each file's root `<svg>`, restoring its set's former linework: simple `1`, gray
`0.4`, stickers `1`; colored sets `stroke="none"` on the root and draws no lines. Illustrated keeps the
old art's widths per type, converted to its viewBox (hills `0.81`, trees `1.24`, mountains `1.62`), with
finer hatching and snow caps set on their shapes.
A style-wide width would stroke every open shape of every instance, a raster cost on dense maps. An
icon's stroke unit is its viewBox. All icons of a type share one viewBox width, sized to the type's
generated footprint so a width draws equally thick on every icon: 130 for mountains and volcanoes, 50 for
hills, 90 for everything else. Bring new art to that width by scaling its coordinates: a `scale()` wrapper
keeps the art's old stroke unit.
Fill-only shapes set `stroke="none"`; stroke only what the old art stroked (simple grass draws none). Where shading would cover the silhouette's stroke, a `fill="none"` copy of the silhouette is drawn
over the art. Thin glyphs (reeds, bare branches, palm fronds) sit in a `scale(k)` group with coordinates
scaled by `1/k`, so their outline draws at `k` of the icon's weight instead of swallowing the shape. Keep
structural details and accents, such as cattail heads and lava, as filled paths so they survive a recolour.

## Goods linework

Every goods icon is drawn in a `0 0 100 100` frame with white bodies (`fill="#fff"`), unfilled linework
(`fill="none"`), and rounded joins. Strokes inherit both colour and width; existing artwork may retain
black filled details and scaled groups. When redrawing art, prefer actual strokes with rounded caps to
filled bands or doubled contours, so the line style can recolour and resize them. Use simple silhouettes
and sparse details that remain legible at marker size. Centre artwork in the frame and keep the original
source credits when redrawing an icon.

The goods icons style sets the lines: `stroke` is their colour and `stroke-width` the circle outline, the icon
lines drawn at 40% of it. `goodIconLines()` (`renderers/draw-goods.ts`) carries that width into the icon frame
at the marker's proportions and writes both on every goods `<use>` — markers, burg plates and the interface,
where `goodBadge(good)` draws a good on its circle — so a good looks the same wherever it is drawn.

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
  pictures in `options.map.customIcons` (`CustomIcons`, beside `Icons` in `components/icons.ts`), which this browser
  keeps in IndexedDB rather than `localStorage` ([configuration](configuration.md)). Each is SVG markup or an image
  URL with its frame. `Icons.syncCustom()` rebuilds the `custom` group from the list
  on generation and after a load; `CustomIcons` rebuilds one icon's symbol on every add, update and remove. SVG content is sanitised again on the way, since a
  file may carry anything, and an image must be an `http(s)` or `data:image/` URL.

The slots are goods, markers, regiments, military unit types, burg group icons and anchors, the market
marker, relief icons and the relief pools of biomes and relief rules, and picture emblems; `Icons.uses(id)` counts the
references in each.

`Icons.html(id)` draws an icon in the interface — editors, overviews, the picker: an inline svg boxing the
icon in its own frame, in its paint (below). The icon picker (`controllers/icon-picker/`) takes only the current icon
and a callback. Its header shows the selected icon, with Position, Replace and Remove when it is a custom
icon, and a search over the built-in and emoji names (`data/icons-list.ts` names each offered emoji); a side list holds Custom, then sections — Emoji by theme,
Settlements, Goods, Relief, Heraldry — whose entries are sets or a set's subdirectories; a section heading shows all
its entries. It opens on the current icon's entry, else on the first built-in section; a double click picks
and applies.

## Icon paint

Art leaves some fills and strokes open to take them from where it is drawn: a burg group's style, the goods
lines. A set declares the `paint` those open parts take where the slot drawing it sets none — burgs and ports
a white fill and dark outline, goods and relief their default style's lines; `Icons.paint(id)` reads it, a
glyph's being the text colour and a custom icon's none, so the picture looks as its file does. Slots without
paint of their own — the interface (`Icons.html`), markers and the market marker — write it on their `<use>`
with `Icons.paintAttributes(id, own)`, a slot's own colours over it: a marker's `iconFill` and `iconStroke`.
Styled slots (burg groups, goods, relief, regiments) keep colouring the art themselves. Attributes lose to CSS,
so a layer's CSS paint still wins.

## Authoring custom icons

`controllers/icon-picker/pictures.ts` turns input into a picture — kind, content, frame — and throws messages
meant for the author. A link must be `http(s)` and load as an image. An SVG upload (up to 200 kB) is
sanitised (CSS `url()`s and `@import`s reaching outside the file are dropped), keeps its root's paint on a
wrapping group and is scoped to the icon's id: its ids and classes are prefixed, and its stylesheet rules
apply only inside the group, which carries the icon's id as a class. A raster upload
(up to 2 MB) is redrawn at 256 px on its longer side and stored as WebP, or PNG where the browser cannot
encode WebP. The emblem editor opens the picker with an `emblem` profile: 1 MB SVG input, 10 MB raster
input and 1024 px on the longer raster side. A new picture is **fitted**: a square around its visible content, padded by 5% — the SVG
bounding box, the opaque pixels of an image, or the whole box for a link whose pixels the site does not
share.

The Custom tab adds by link or upload and picks the new icon; Replace gives an icon a new picture under
its id, so every slot follows; Remove confirms with the uses `Icons.uses` counts and leaves the
references to draw nothing. `IconsArchive` (`services/io/icons-archive.ts`) packs custom icons into a zip whose
`icons.json` restores them under their ids (the picture files are for people); an id the map uses for another
picture is replaced only on confirmation. The Custom tab exports and imports it,
and the Style Saver offers it when a downloaded preset references custom icons, since presets carry ids only.
The positioner (`controllers/icon-picker/positioner.ts`) zooms and pans a square
frame, writing the symbol's `viewBox` as it moves so the map and the previews follow; Cancel restores
it and Apply stores it. Replace and Remove cancel a positioner open on that icon.

## Exports

`export.ts` reconciles its clone for the requested bounds before its first asynchronous wait, captures
referenced definitions a chunk does not own (glyphs, custom icons), and derives the required sets from
the remaining references through `setForId`. It then waits for the sets and walks local
`href`/`xlink:href` dependencies, copying by id regardless of tag and deduplicating cycles. Only loaded
groups may be read after waiting, so the export reflects the map as it was when it started. Failed sets
fail the export; a symbol a loaded set lacks is skipped with a warning. A raster export draws the SVG as
an image, which fetches no external files, so linked custom images are inlined as base64 where the host
allows it and dropped where it does not; an SVG export keeps its links. Flattening symbols for SVG export
preserves their frame clipping; anchored art and glyphs that explicitly overflow their frame remain
unclipped. Emblem definitions are added before collecting icon references, so nested charge and picture
references join the export. Emblem downloads copy their referenced icon definitions as well.

## Emblems and Armoria

An emblem stores a Heraldic blazon or `{ icon, shield?, size?, x?, y? }`, a Picture emblem shown whole.
A charge's `charge` is a built-in charge name or any icon reference (`Emblems.chargeArt` resolves both), drawn in
the 80-unit charge box of the shield space. Its tincture fills the art's open parts; line art from a set that
paints its strokes (goods, relief) takes the tincture as its line colour through `--tincture`, since its bodies are
fixed; custom art gets no outline; a raster keeps its colours. Picking an icon for an emblem sets its first
charge (`Emblems.chargeOf` stores a charge set icon by its name, so blazons stay Armoria's); Shape _None_ turns
that charge into a Picture emblem, and choosing a shape puts a picture back on a field as its charge.

`controllers/emblems/armoria.ts` reads Armoria edit links, API links and COA strings without the DOM. The
drawability check in `drawability.ts` uses the renderer's known names. Drawable COAs stay heraldic; others
link Armoria's SVG API render. The GUI and API URLs are constants in the reader.
For local round-trip testing, `VITE_ARMORIA_GUI` can point an FMG development server at a local Armoria
server (the `armoria` and `dev-armoria` preview configurations do this); production builds always use the
published GUI origin.

Armoria opened from FMG receives `from=FMG`, a `session` and `returnOrigin`. It posts
`{ type: "armoria:coa", version: 1, session, coa, svg }` to the opener at `returnOrigin` after every edit, undo
and redo, once editing pauses for half a second; the unchanged original is not sent. FMG accepts an update only
from the GUI origin recorded for that session, with the session's token, while the same map is loaded; a session
stays live until the emblem opens in Armoria again. Updates of one session apply in order. A drawable COA
replaces the blazon; otherwise FMG sanitises the returned SVG into a Custom icon, one per session that later
updates replace, removed once a drawable update leaves it unused.
Armoria keeps recoloured and added tinctures in its own palette, so it sends each of them as its hex colour, as
its API accepts (`{ "t1": "#228833" }`, or `vair-#228833-or` inside a pattern); default tinctures keep their
names. An emblem therefore carries its exact shades, and reopening it in Armoria shows them. The renderer and the
drawability check take hex as a tincture; pattern ids drop the `#` so `url(#…)` links stay valid. A heraldic emblem is edited in Armoria; the editor's field and charge controls appear only
for an emblem whose main charge is a library picture, which Armoria cannot show.

The service worker's install and activate steps populate its build precache. This includes every charge
category chunk, so an emblem can load a category after the app is reopened offline.

## History

Version 1.154 moved the icons out of `index.html` and derived every symbol id from its file path. It
migrates old relief ids (`relief-mount-3-bw`) into descriptors after the style migrations, recovering pins
against the incoming map's styles, and renames `#icon-<name>` to `#burgs-atlas-<name>` (or `#burgs-<name>`
for names that already carried their style) / `#ports-<name>` in
style records (`styles-legacy.ts`, so presets are covered too), `good-<name>` to `goods-<name>` and
`good-custom-<id>` to `custom-goods-<id>` in `pack.goods` and field 45.

Version 1.154.0 made every slot a bare icon reference. The 1.154.0 auto-update step migrates an older map,
and startup (`adoptLegacyIconSlots` after restoring the options) migrates the unit types a browser keeps between maps:
goods uploads in map field 45 become custom icons under their ids (field 45 is written empty since),
inline `data:` images and URLs become one custom icon per distinct value, text becomes glyphs, and
`#`-prefixed ids lose the `#`. Stored and shipped style presets are rewritten the same way by
`normalizeStyles`. Custom emblems (`"custom"` before v1.91, `{ custom: true }` since) become picture emblems: one custom icon per
distinct image, a definition holding more than a single image kept whole as SVG, and no icon for removed entities.
Old uploads were stored at full size, so the step redraws every raster it adopts within today's upload limits, as
WebP when that is smaller: 1024 px for emblems, 256 px for other icons. Vector art and links stay as they are.

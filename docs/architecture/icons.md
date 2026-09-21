# Icon assets

Artwork lives in `src/assets/icons/` as standalone SVG files. Relief has four peer directories:
`relief/{simple,colored,gray,illustrated}/<type>-<variant>.svg`. Burg and port artwork lives in
`burgs/<name>.svg`; goods in `goods/<name>.svg`. `components/icon-sets.ts` globs every file with
`import.meta.glob(…, { query: "?raw" })` and a `manualChunks` rule in `vite.config.ts` groups the
per-file loaders into one hashed lazy chunk per directory. The service worker precaches these chunks
for offline use, including Electron's `app://` deployment.

At first use, the loader converts each SVG root into a symbol and appends a complete group to
`#defElements defs`. IDs are `relief-<set>-<type>-<variant>`, `icon-<name>` and `good-<name>`.
Goods have an extra container: `#good-icons > #icons-goods`. Loading never replaces existing children.
`components/icon-sets.ts` holds one `IconChunk` class per set and an `IconSetRegistry` singleton
(`IconSets`): `load` returns the shared attempt and rejects on failure, `ensure` never rejects so a
renderer draws without icons, and every renderer awaits the chunks before drawing. No dialog waits for
icons — the browser resolves `<use>` targets once the symbols exist. Failed attempts leave no partial
definitions, report once, and stay failed until an explicit selection or export requests a retry.

## Logical relief slots

`generators/relief-generator.ts` owns the relief model in `ReliefModel`, instantiated on the `Relief`
global like the other generator models: the set names and type catalog as fields, plus `symbolId`,
`variantsOf`, `isType`, `anchorY` and `byAnchor`. A descriptor contains `{ type, variant?, set? }`
and is stored as it is — `pack.relief` is plain JSON with no parse/serialize step. The renderer resolves
the absent `variant` to 1 and the absent `set` to `styles.relief.options.set`, so stored data and drawn
data never diverge and a style change never edits relief state. `s` is the icon's base size;
`styles.relief.options.size` is a render multiplier anchored at the icon's centre (the z-order key), never written
back. Custom relief and burg art are not supported yet.

Each set resolves all 34 union slots. Exact files win. For a missing slot, collect real files of the
same type in numeric variant order. If there are none, follow the catalog's fallback type chain.
Select `available[(variant - 1) % available.length]` and emit an alias symbol containing a `<use>`.
Aliases are never candidates. A missing terminal target or an unproductive cycle is an error.
Thus illustrated mountain slots 4–6 alias drawings 1–3, deterministically and without changing data.
Filling a slot updates existing maps, including pinned icons. Released slots must never be renumbered,
reassigned or removed without migration.

Current coverage (the unit test derives the full missing-slot list from directories):

| Set | Real artwork | Aliased slots |
| --- | ---: | ---: |
| simple | 9 | 25 |
| colored | 34 | 0 |
| gray | 34 | 0 |
| illustrated | 18 | 16 |

## Editing artwork

Use a root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">` and preserve the attributes needed
by the symbol. Burg icons retain `width="1em" height="1em" overflow="visible"`; the owning group's
font size controls their scale. Preserve inherited fills and strokes on recolourable surfaces and
intentional accent colours. Store attribution in `<metadata description="…" source="…" license="…"/>` when
the artwork came from a third party (goods do; relief and burgs are in-project art with none).
Do not add `<title>`: SVG use instances would display unwanted tooltips. Proportions belong in the
viewBox, not catalog size overrides. Simple grass's viewBox is shrunk by 1.2 around (50, 50).

- To fill an existing relief slot, add its SVG file to the set directory. No registry change is needed.
- To add a variant or type, extend the union, provide artwork and any fallback, and run the coverage tests.
- To add a set, add its directory, its name in `Relief.sets`, and its lazy entry in the loader.
- To add burg or port artwork, add its file and picker entry in `data/burg-icons.ts`.
- To add goods artwork, add its file. The picker discovers built-in roots automatically.

## Map-carried art and exports

Custom goods remain direct `<svg id="good-custom-<id>">` children of `#good-icons`. Map field 45
persists them; loading clears the previous map's custom art without touching built-ins. Pickers list
only `#good-icons > #icons-goods > symbol[id^="good-"]` and
`#good-icons > svg[id^="good-custom-"]`, excluding containers and artwork internals.

Burg and relief upload interfaces are not implemented. Neither has an upload path, a map field, picker
enumeration or a custom id namespace yet; a later change would add them. Loaders stay append-only to
preserve that seam.

`export.ts` reconciles its clone for the requested bounds before its first asynchronous wait, captures
referenced map-carried definitions, and derives the required chunks from those references.
It then waits for the chunks and walks local `href`/`xlink:href` dependencies, copying by ID regardless
of tag and deduplicating cycles. Only immutable built-in definitions can be read after waiting.
This snapshot preserves the original icon choices and custom goods if the live map changes meanwhile.
The walk finishes before SVG symbol flattening or PNG serialization. Failed chunks fail the export.

Version 1.154 migrates historical symbol IDs into descriptors after style migrations. It recovers pins
against the incoming map's styles, renumbers shared colored/gray types, and compensates old simple
grass dimensions once while preserving their center and rendered footprint.

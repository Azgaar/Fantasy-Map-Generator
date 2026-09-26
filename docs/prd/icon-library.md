# PRD — Icon Library

Updated: 2026-09-24. Follows [Icon Assets](icon-assets.md), which moved the built-in icons into set
directories and reserved the `custom-…` namespace for art a map carries. Terms follow the glossary:
Icon Library, Icon Set, Glyph, Custom icon, Icon reference, Icon slot, Icon frame, Anchored icon.

## Problem Statement

A map author who wants a particular picture on the map runs into three unrelated mechanisms, each with
its own limits:

- **Goods** accept an uploaded SVG or raster image, but only through the good editor. The picture is
  stored as raw markup in a map slot of its own, is framed however the file happened to be drawn (an
  off-centre or heavily padded image stays that way), and can only be used by goods.
- **Markers, regiments and military unit types** accept an emoji, free text, an image URL or an uploaded
  file through the Icon Selector. An uploaded file is inlined as a `data:` URI into **every** entity that
  uses it: a marker type with a hundred markers stores the same image a hundred times, and the `.map`
  file grows accordingly. They cannot use the shipped art, and the image cannot be reused by goods or
  burgs.
- **Burg and port icons** (a burg group's style) and the **market marker** can only be picked from one
  source each — the burg sets in a dialog of their own, an emoji in a text control.

Each place stores its icon differently (a bare symbol id, a `#`-prefixed id, emoji text, a URL, a
`data:` URI), so every renderer and editor branches on what the value looks like. An author cannot build
a set of pictures once and use it across the map; uploads bloat maps; there is no way to centre or scale
a picture that does not fit its frame; and linking to an image that already lives on the web — the
cheapest option — is only possible for markers and regiments. Three pickers do overlapping jobs with
different looks.

## Solution

One **Icon Library**: every icon any slot can use, from three sources — the shipped **Icon Sets**,
**Glyphs** (emoji and other short text) and the map's **Custom icons**. Every icon slot — a good, a
marker, a regiment, a unit type, a burg group, the market marker — accepts any icon from any source, and
stores it the same way: a bare symbol id.

- **Custom icons** are the pictures a map carries. One is added by **linking** an image hosted elsewhere
  (encouraged, since it keeps the map small) or by **uploading** an SVG or raster file. Like transport
  types, they are part of the map's setup: saved in the `.map` file, kept in the browser, replaced when
  another map is loaded and carried over to the next generated map.
- **Glyphs** become a virtual Icon Set: `🏰` is the symbol `glyph-1f3f0`, built on demand and never
  stored, so every slot draws through one `<use>` path and a style preset with a glyph works on any map.
- Every Custom icon can be **positioned** — zoomed and panned inside its frame, or fitted automatically
  to its visible content — and its picture can be **replaced**; every slot that uses it follows.
- Uploaded raster images are downscaled to 256 px on the long side, so a phone photo does not bloat a map.
- One **icon picker** with three tabs — **Built-in**, **Emoji**, **Custom** — replaces the three dialogs.
  It opens on the tab holding the current icon, else on Built-in. The Custom tab points
  authors to open icon sources.
- Old maps open unchanged: goods uploads and inline `data:` or URL images become Custom icons (one per
  distinct image), emoji and text become glyph references, and `#`-prefixed burg icon ids lose the `#`.

## User Stories

1. As a map author, I want to add an icon by pasting a link to an image, so that I can use art that is
   already online without making my map file bigger.
2. As a map author, I want the picker to suggest open icon sources, so that I know where to find
   suitable free images.
3. As a map author, I want to upload an SVG file as an icon, so that I can use my own vector art.
4. As a map author, I want to upload a PNG, JPEG or WebP image as an icon, so that I can use raster art.
5. As a map author, I want large raster uploads to be shrunk automatically, so that my map file stays
   small without me resizing images first.
6. As a map author, I want an uploaded SVG to be cleaned of scripts and external references, so that
   opening a shared map is safe.
7. As a map author, I want an uploaded SVG's internal ids and styles to stay inside the icon, so that it
   neither breaks nor restyles the rest of the map.
8. As a map author, I want a newly added icon to be fitted to its visible content, so that it looks
   centred without manual work.
9. As a map author, I want to zoom and pan a Custom icon inside its frame, so that I can fix art that is
   off-centre, too small or too big.
10. As a map author, I want a "Fit" action in the positioner, so that I can undo my adjustments quickly.
11. As a map author, I want the positioner preview to look the way the icon looks on the map, so that I
    can judge the framing.
12. As a map author, I want every place an icon is drawn to update when I reposition it, so that I do
    not have to reassign it.
13. As a map author, I want to replace a Custom icon's picture with a new link or upload, so that every
    good, marker and burg group using it shows the new art at once.
14. As a map author, I want to use any icon — built-in, glyph or custom — for goods, markers, regiments,
    unit types, burg groups and the market marker alike, so that I manage my pictures once.
15. As a map author, I want to use a built-in icon from another family (a goods icon as a marker, a
    relief mountain as a regiment), so that I can reuse the shipped art.
16. As a map author, I want a Custom icon or a glyph on a burg group to be centred on the burg, so that it
    marks the burg without extra setup.
17. As a map author, I want to pick a burg group's icon in the same picker as everything else, so that
    the interface is consistent.
18. As a map author, I want the picker to show art that takes its colours from the map in a readable
    default paint, so that every icon is visible whatever slot I pick it for.
19. As a map author, I want to keep picking emoji or typing short text (`XIV`, `⟱`) as an icon, so that my
    habits keep working.
20. As a map author, I want the picker to open where my current icon is, or on the icons that suit the
    slot, so that I do not hunt through every set.
21. As a map author, I want sets I do not open to cost nothing, so that the picker stays fast.
22. As a map author, I want to remove a Custom icon after a confirmation that tells me how many goods,
    markers, regiments, unit types and styles use it, so that I know what will lose its icon.
23. As a map author, I want icons I have not used yet to stay in the Custom tab, so that I can prepare a
    set before I need it.
24. As a map author, I want my Custom icons to survive generating a new map, so that I do not re-upload my
    pictures for every map.
25. As a map author, I want Custom icons to be saved inside the `.map` file, so that a map I share shows
    the same icons elsewhere.
26. As a map author, I want loading a map to bring that map's Custom icons with it, so that its icons draw.
27. As a map author, I want old maps with uploaded goods icons to open unchanged, so that nothing is lost
    on upgrade.
28. As a map author, I want old maps whose markers or regiments carry inline images to open unchanged,
    and to get smaller when saved again, so that the duplication is gone.
29. As a map author, I want migrated markers, regiments and unit types to keep their icon size, so that
    the upgrade does not change how my map looks.
30. As a map author, I want SVG exports to contain the icons the map uses, so that the export matches the
    screen.
31. As a map author, I want PNG and JPEG exports to include linked icons where the image host allows it,
    so that raster exports match the screen as far as possible.
32. As a map author, I want a clear message when an upload is too large or not an image, so that I know
    what to fix.
33. As a map author, I want a clear message when my Custom icons outgrow the browser's storage, so that I
    know they are still safe in the `.map` file.
34. As a map author, I want the picker to show which icon is currently selected, so that I can see what
    I am replacing.
35. As a contributor, I want uploads, links, storage, the Icon Library and the picker to be separate modules
    with small interfaces, so that future slots plug in without another copy of the upload code.

## Implementation Decisions

### Custom icon model

- A new model module, a bare global like the other models, owns the Custom icons. It is data only and
  touches no DOM.
- The Custom icons live in the map settings (`options.map`), beside the transport types and military
  units, not in the pack: slots refer to them by id, and the set survives a new map. `Options.randomize`
  carries it across, the settings schema validates it, and a file without it gets an empty list.
- An icon has no name: it is known by its id, and asking authors to name pictures is friction.
- Entry shape (a schema decision, not working code):

  ```ts
  interface CustomIcon {
    id: string;              // symbol id `custom-<8 hex>`, from crypto.randomUUID
    kind: "svg" | "image";
    content: string;         // svg: sanitised, scoped markup; image: http(s) URL or data: URI
    viewBox: string;         // "x y w h": the icon frame
  }
  ```

- Ids come from `crypto.randomUUID`, never from the seeded `Math.random`, so adding an icon does not
  shift the map's random sequence. Ids are opaque and carry no family: the same icon serves any slot.
  Migrated goods uploads keep their `custom-goods-…` ids.
- Adding never deduplicates: the same picture added twice is two icons. Only migration collapses
  identical inline images, because that is what shrinks old maps.
- Positioning edits only `viewBox`. An image icon is an `<image>` letterboxed in a `0 0 100 100` space,
  so no intrinsic size is stored. Replacing swaps `kind` and `content`, keeps `id` and re-fits the frame.
- Interface: list, get, add, replace, update the frame, remove. Every change saves the options. Turning a
  link or a file into a picture is the upload and link service's, so the model stays data only.
- Removal does not rewrite references; a reference to a removed icon draws nothing, like any missing
  symbol.

### Icon slots

- The slots are good icons, marker icons, regiment icons, military unit type icons, burg group icons (burgs
  and ports parts) and the market marker style. Transport types are not a slot. No module keeps a slot
  list: the Icon Library counts the uses of an icon when asked, and the v1.154.0 migration walks the slots
  as they were in that version.
- Removing a Custom icon reports its uses per slot kind ("1 good, 12 markers, 1 burg group") in the
  confirmation.

### Icon references

- Every slot stores a bare symbol id: `goods-wood`, `burgs-atlas-circle`, `glyph-1f3f0`,
  `custom-1a2b3c4d`. The `#` is `href` syntax and is added only where `<use>` is written. An empty
  reference means no icon.
- Shipped defaults (marker types, military unit types, the market marker) store glyph references too.
- A glyph's id is `glyph-` plus its code points in hex joined by `-` (`XIV` → `glyph-58-49-56`), so any
  short text, including joined emoji sequences, round-trips.
- Styles may reference any icon. A preset applied to a map without a referenced Custom icon draws
  nothing there; glyph and set references work on every map.

### Symbols in the page

- One Icon Library module is the entry point for every reference, whatever its source; the icon-set
  registry stays the catalog of the built-in sets, and the Custom icon model lives beside the library.
  Symbols live in one container in the shared definitions, a group per set, the glyphs and the custom icons.
- Glyphs have no directory: a glyph symbol (`<text>` centred in a fixed frame) is built from its id when a
  renderer or the picker first needs it. The frame is calibrated so a 12 px box draws a glyph as large as
  today's 12 px text.
- The library has one synchronisation step that rebuilds every `custom-…` symbol in the shared
  definitions from the Custom icons. It is called on startup, after a map load, and by the picker after
  a change. It always rebuilds; the list is small.
- The goods-only helpers for the custom prefix and custom elements are removed.
- Exports need no new rule: they already copy referenced definitions by id, and glyph symbols are ordinary
  definitions. Raster exports additionally inline linked images of referenced Custom icons through the
  existing base64 helper, and drop an image that cannot be fetched.

### Rendering

- Every slot draws a `<use>`; the text/image branches in markers, military, overviews and editors are
  removed. A marker's `px` becomes the icon box size for every source.
- Anchored symbols keep their anchor-relative frame as a plain boxed symbol, so a burg icon frames
  correctly in a marker pin too. The burg renderer alone places them around the point, from the frame
  over `em`; any other icon is drawn as a 1 em box centred on the burg point. Group `dx`/`dy` stays
  anchors-only.
- Only Custom icons can be positioned; the frame belongs to the picture and each slot applies its own size
  and placement (a good's circle, a marker's pin, a regiment's box, a burg's em).

### Upload and link service

- A stateless service in the picker's controller folder turns input into a Custom icon's kind, content and
  frame. It throws messages meant
  for the author. Add and Replace both use it.
- SVG (up to 200 kB): parsed inertly and sanitised (existing helper), root presentation attributes
  preserved on a wrapping group, inner ids and classes scoped to the icon id (existing helper).
- Raster (up to 2 MB input): decoded, redrawn with the long side at most 256 px, stored as WebP with a
  PNG fallback.
- Link: only `http(s)` URLs, confirmed to load as an image.
- Fit: a square frame around the visible content with 5% padding — the SVG bounding box, the alpha
  bounds of an uploaded raster, or the full box for a linked image whose pixels cannot be read.
- Persisting the options tolerates a storage quota error and tells the author the `.map` file still
  holds the icons.

### Icon picker

- One controller replaces the Icon Selector and the burg/port icon dialog. A caller passes only the current
  reference and a callback: the picker has no per-slot variations.
- Tabs:
  - **Built-in**: every Icon Set as a section, grouped by its subdirectories. The current icon's set is expanded;
    the others are collapsed headings whose chunk loads when opened. A relief set shows one variant per
    type.
  - **Emoji**: the emoji grid and a free-text field; either yields a glyph reference.
  - **Custom**: the link field first, upload buttons, then the map's Custom icons with Position, Replace
    and Remove each, and a pointer to open icon sources.
- The picker opens on the tab holding the current icon, else on Built-in. The current icon is pressed.
- A positioner dialog in the same controller: a preview framed as on the map with the frame's surroundings
  dimmed, previews at map sizes, a zoom slider and wheel zoom, drag to pan, Fit, Apply and Cancel.
- Previews come from one shared function that boxes every icon in its own frame (anchored art keeps its
  anchor-relative frame, see Rendering) and draws art that inherits its paint in a default one (a burg's
  white fill and dark stroke); a glyph takes the text colour.
- Callers: the good editor, the style editor's burg/port and market marker controls, and the marker,
  marker type, regiment and unit editors.

### Save, load and migration

- The map slot that held goods uploads is retired and written empty; Custom icons travel in the settings
  block. The earlier rule that dropped unused goods uploads on save is reverted.
- Migration is part of the v1.154.0 auto-update step (this release), walking the slots of the map's
  entities and setup; the style record is converted by `normalizeStyles` in the same version's step:
  - old custom goods markup becomes Custom icons, keeping their ids (`good-custom-` renamed to
    `custom-goods-`), sanitised and scoped on the way; a root holding a single `data:` image becomes an
    image icon;
  - inline `data:` URIs and image URLs in slots become one Custom icon per distinct value, and the slots
    reference it;
  - emoji and text in slots (markers, regiments, unit types, the market marker) become glyph references;
    a value is a reference only when it is a glyph, a custom icon or an id an icon set owns, so text
    that looks like an id stays text; an empty value stays empty;
  - `#`-prefixed ids in burg group styles lose the `#`, in the map's styles and in stored presets
    (`styles-legacy.ts`); `default-styles.json` and the shipped presets are edited once;
  - the unit types a browser keeps between maps are migrated on New Map as well as on load.
- A custom icon the settings schema rejects is dropped on its own, so one broken entry never costs a map
  its other icons.

### Delivery

Three independently shippable steps:

All three steps are implemented.

1. **One reference form.** Glyphs, bare ids, the Icon Library, the Custom icon model, schema and symbol
   sync, the single `<use>` render path for every slot including burg centring, the picker with all three
   tabs (Custom icons selectable, not yet authored), and every migration. The Icon Selector and the burg
   icon dialog are deleted.
2. **Authoring Custom icons.** The upload and link service, Add, Position, Replace and Remove with the use
   count.
3. **Raster export of linked icons.** Raster exports inline linked custom images and drop the ones that
   cannot be fetched; SVG exports keep the links.

## Testing Decisions

- Tests exercise behaviour through each module's public interface: what ends up in the Custom icons, in
  the page definitions, in a migrated map, in the rendered picker — never private helpers.
- **Custom icon model:** add, add link, replace (id kept), update frame, remove; a new id never collides
  with a set namespace; a settings file without Custom icons gets an empty list. Prior art: the
  added-labels and markets model tests, and the options schema tests.
- **Glyph references:** text round-trips through its id, including joined emoji sequences and multi-letter
  text; the empty reference stays empty.
- **Icon slots:** counting finds uses in every slot kind; a new slot kind is covered by one list entry.
- **Symbol sync:** adds, replaces and removes `custom-…` symbols and leaves the loaded set groups alone;
  glyph symbols are built on demand. Prior art: the icon-sets loading tests.
- **Upload service:** SVG input keeps root paint, scopes ids and classes, rejects oversize and non-image
  input, validates links. The canvas path is stubbed in jsdom. Prior art: the file-utils sanitise and
  scope tests.
- **Rendering:** a burg group draws anchored icons at the anchor and other icons centred; markers draw
  every source through `<use>`.
- **Migration:** old goods markup becomes Custom icons with valid goods references; markers sharing a
  `data:` URI end up pointing at one icon; image URLs become icons; emoji and text become glyph
  references; burg style and preset ids lose the `#`. Prior art: the 1.154 auto-update and
  `styles-legacy` tests.
- **Picker:** the opening tab follows the current icon, else Built-in; the current icon's set is expanded and
  others are collapsed; the selection is pressed; Custom tiles carry their actions. Prior art: the
  style-editor dialog DOM test for the burg icon choices, which moves here.
- The full unit suite, `tsc` and Biome must pass; the upload, positioning, replace, New Map carry-over,
  save and reload, glyph sizing on migrated markers and marker export paths are
  checked in the browser.

## Out of Scope

- **Relief placement.** Relief icons are still placed by type and variant through their descriptor; a
  relief icon can be picked for another slot, but a relief feature cannot take a Custom icon or a glyph.
- **Custom emblems (coats of arms).** Their charges and upload flow are more involved and stay as they
  are.
- **Transport icons.** The unused `icon` field on transport types is not a slot.
- **Icon names, tags, search or folders** among Custom icons.
- **Deduplication on add,** and rewriting references (Replace changes a picture, never a reference).
- **Burg-style base alignment** for non-anchored icons on burgs (they are centred).
- **Sharing Custom icons between maps other than through New Map carry-over or a loaded file.**

## Further Notes

- Linking is the recommended path in the interface; uploading stays available for art that has no home
  online.
- Browser storage is limited (a few megabytes); downscaled rasters (tens of kB each) and the SVG size
  cap keep a normal set of Custom icons far below it, and a quota error never loses data because the
  `.map` file holds them.
- A linked image depends on its host: if it goes offline or blocks cross-origin requests, it disappears
  from the map or from raster exports respectively.
- `docs/architecture/icons.md` ("Map-carried art and exports") describes the goods-only mechanism and
  is rewritten with step 1.

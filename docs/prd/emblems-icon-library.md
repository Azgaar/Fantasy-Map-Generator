# PRD — Emblems in the Icon Library

Updated: 2026-09-28. Follows [Icon Library](icon-library.md), which listed custom emblems as out of scope.
Terms follow the glossary: Emblem, Icon Library, Icon Set, Custom icon, Icon reference, Icon slot, Icon frame;
this PRD adds Charge, Heraldic emblem and Picture emblem.

Status: implemented in FMG and the companion Armoria checkout. The renderer supports the Armoria
features below; charges are built-in icon sets; picture emblems, the picker, Armoria paste and send-back,
migration, and downloads are wired in. FMG build, type checking, Biome and unit tests pass. Browser checks
covered emblem selection, framing, paste and downloads, map SVG/PNG export, an Armoria send-back round
trip in Chrome, and an offline reload with a charge rendered after the preview server stopped.

## Problem Statement

A map author who wants an emblem the generator did not make has one path: design it in Armoria, download
the image, come back and upload it. That path has these limits:

- **Every upload is a copy.** A custom emblem is a `data:` URI kept under the entity's own id. A state and
  its capital sharing one coat of arms store it twice. The same picture can't be reused by another emblem,
  a marker or a regiment.
- **Upload is the only option.** An author can't link to an emblem hosted elsewhere, not even one Armoria
  itself serves.
- **Quality is capped by hand.** Files over 500 kB are refused, and the author is told to shrink the
  image with an outside tool. Nothing is resized or optimised automatically.
- **No framing, no replacing.** The picture is stretched into a fixed 200×200 box, and the shield shape
  can't be applied to it. Changing the art means uploading it again for every entity.
- **Armoria edits don't come back.** "Edit in Armoria" opens the emblem there, but the only way back is
  download, then upload. The result is a flat image: it can't be re-edited, doesn't follow the map's
  tinctures, and is lost to heraldry-aware tools.
- **The heraldic art is locked away.** The 338 charges (lions, towers, anchors, crosses) are fetched one
  file per emblem, copied into every emblem that uses them, and cached by the service worker only up to
  100 files, so offline maps miss some. No marker, regiment or burg can use them.

## Solution

An emblem becomes an **Icon slot**. It is either a **Heraldic emblem**, the generated or Armoria-made
blazon the renderer draws from data as today, or a **Picture emblem**: any icon reference, most often a
Custom icon. Picture emblems get everything Custom icons already have: link or upload, deduplicated
storage, positioning, Replace, carry-over and export. Emblem pictures are kept at **higher quality**.

Armoria becomes a first-class source:

- **Paste from Armoria.** The emblem editor accepts any of Armoria's "Copy edit link", "Copy API link" or
  "Copy COA string" outputs. If FMG can draw the blazon, it becomes a Heraldic emblem again: editable,
  offline, and drawn in the map's tinctures. If not, the emblem links Armoria's SVG render as a Custom icon.
- **Live updates from Armoria.** Armoria opened from FMG sends every edit back to the emblem it came from
  as you make it. No download, upload or button press needed.

The **charges** become built-in Icon Sets, one per charge category, loaded like every other set. The
emblem renderer draws charges from them, and every other slot can use them from a new **Heraldry** section
in the icon picker.

## User Stories

### Picture emblems

1. As a map author, I want to set an emblem from the same icon picker I use for markers and goods, so
   that I learn one tool.
2. As a map author, I want to link an emblem image hosted elsewhere, so that my map file stays small.
3. As a map author, I want to upload an SVG emblem, so that I can use vector art I made or downloaded.
4. As a map author, I want to upload a PNG, JPEG or WebP emblem, so that I can use raster art.
5. As a map author, I want emblem uploads kept at a noticeably higher resolution than marker icons, so
   that emblems stay sharp in the emblem editor, in large zoom and in high-resolution downloads.
6. As a map author, I want a large emblem upload to be scaled down to the emblem limit automatically
   instead of refused, so that I don't need an outside tool to resize it.
7. As a map author, I want a clear message when an emblem file is still too large or isn't an image, so
   that I know what to fix.
8. As a map author, I want a new emblem picture fitted to its visible content, so that transparent
   padding doesn't make it look small.
9. As a map author, I want to zoom and pan an emblem picture inside its frame, so that I can fix art
   that is off-centre.
10. As a map author, I want to give a state and its capital the same emblem picture, so that the map
    stores it once.
11. As a map author, I want to replace an emblem picture and have every emblem, marker or regiment using
    it follow, so that I update the art once.
12. As a map author, I want to clip a picture emblem to a shield shape I choose, so that emblems of
    different origins look uniform on the map.
13. As a map author, I want a picture emblem to show as drawn when I pick no shield, so that flags, seals
    and round badges keep their own outline.
14. As a map author, I want to pick an emoji, a goods icon or a heraldic charge as an emblem, so that
    small settlements can get a simple sign without a full blazon.
15. As a map author, I want the emblem picker to open on the Custom icons, so that my own art is one click
    away.
16. As a map author, I want removing a Custom icon to count the emblems using it along with the other
    slots, so that I know what will lose its picture.
17. As a map author, I want to return a picture emblem to a generated blazon, so that I can undo a custom
    emblem.
18. As a map author, I want emblem size and position on the map to stay where they were when I change
    the picture, so that my layout survives.

### Armoria

19. As a map author, I want to paste an Armoria edit link into the emblem editor, so that the blazon I
    designed comes back without downloading anything.
20. As a map author, I want to paste an Armoria COA string, so that I can reuse blazons I kept as text.
21. As a map author, I want to paste an Armoria API link, so that I can use links I already shared or
    saved.
22. As a map author, I want a pasted blazon FMG can draw to become a regular Heraldic emblem, so that it
    renders offline, takes the map's tinctures and can be edited again.
23. As a map author, I want a pasted blazon FMG can't draw fully to keep its exact look as a linked
    Armoria image, so that nothing is silently dropped.
24. As a map author, I want to be told when a blazon was linked as an image rather than drawn, so that I
    know it depends on the Armoria service.
25. As a map author, I want "Edit in Armoria" to also work on an emblem linked from Armoria, so that I can
    keep editing it.
26. As a map author, I want my edits in Armoria to show on the map as I make them when I opened it from
    FMG, so that I see the result in place without any extra step.
27. As a map author, I want Armoria's updates to reach the exact emblem I opened, even if I edited several
    emblems in turn, so that edits never land on the wrong entity.
28. As a map author, I want a blazon that uses my own Armoria charges to arrive as a picture, so that
    art that only lives in my Armoria browser still shows on the map.
29. As a map author, I want pasted input that isn't an Armoria link or blazon to be refused with a
    pointer to the picture buttons, so that the paste field never quietly adds an arbitrary image.
30. As a map author, I want a malformed Armoria link to give a clear error, so that I don't get a blank
    emblem.

### Charges as Icon Sets

31. As a map author, I want a Heraldry section in the icon picker with the charges grouped by category,
    so that I can use a lion or a tower as a marker, regiment or burg icon.
32. As a map author, I want to search charges by name, so that I find "anchor" without browsing categories.
33. As a map author, I want charges shown in a readable default tincture in the picker, so that I can see
    them before I pick.
34. As a map author, I want emblems to look exactly as they did before charges moved, so that my maps
    don't change.
35. As a map author, I want every emblem to draw offline once the charges have loaded, so that the app
    keeps working without a connection.
36. As a map author, I want a map with many emblems to load the charges it needs quickly, so that
    emblems appear promptly.
37. As a map author, I want the charges Armoria has and FMG lacks to be available, so that pasted blazons
    using them draw natively.
38. As a map author, I want my existing seeds to produce the same emblems after new charges are added, so
    that sharing a seed still works.
39. As a map author, I want emblem downloads and SVG exports to include the charges they use, so that the
    files show correctly elsewhere.

### Upgrade and persistence

40. As a map author, I want old maps with custom emblems to open unchanged, so that nothing is lost.
41. As a map author, I want identical custom emblems in an old map to become one Custom icon, so that the
    map gets smaller when saved again.
42. As a map author, I want migrated custom emblems to keep their size and position, so that the upgrade
    doesn't move anything.
43. As a map author, I want picture emblems saved in the `.map` file, so that a shared map shows the same
    emblems elsewhere.
44. As a map author, I want a clear message when high-resolution emblem pictures outgrow browser storage,
    so that I know they are still safe in the `.map` file.

### Contributors

45. As a contributor, I want emblem uploads to go through the Icon Library's picture pipeline with a
    quality profile, so that there is one upload path to maintain.
46. As a contributor, I want Armoria input parsing to be a pure module, so that every link shape is
    unit-tested without a browser.
47. As a contributor, I want one check that tells whether FMG can draw a given blazon, so that the paste
    path, the send-back path and future features agree.
48. As a contributor, I want the FMG↔Armoria message contract written down, so that both projects can
    change independently.

## Implementation Decisions

### Emblem model

- The emblem type becomes a union of **Heraldic emblem** (unchanged: `t1`, `division`, `ordinaries`,
  `charges`, plus the shared `shield`, `size`, `x`, `y`) and **Picture emblem**: the shared fields plus
  `icon`, a bare icon reference from any source. The `custom: true` variant goes.
- On a Picture emblem, `shield` is optional. When set, the picture is clipped to that shield path and
  gets the shield overlay (backlight and outline) Heraldic emblems get. When absent, the picture draws
  unclipped in the emblem's frame. The shape selector is enabled for Picture emblems and offers "none".
- The emblem renderer draws a Picture emblem as its emblem `<svg>` holding one `<use>` of the icon, boxed
  in the icon's frame, instead of warning and skipping. Its cache key covers the icon reference and
  shield, so repositioning or replacing a Custom icon redraws nothing: the `<use>` follows the symbol.
- "Emblem" joins the Icon slots: `Icons.uses` counts states, provinces and burgs whose emblem references
  the icon, and Remove's confirmation names them.
- The glossary gains **Charge** (a figure on a heraldic field, drawn from the charge Icon Sets), **Heraldic
  emblem** and **Picture emblem**. The Emblem and Icon slot entries are updated.

### Picture quality profiles

- The picture pipeline (`IconPictures`) takes a **quality profile** instead of fixed limits. Two exist:
  `icon` (today's limits: 256 px raster, 200 kB SVG, 2 MB raster input) and `emblem` (1024 px raster,
  1 MB SVG, 10 MB raster input; tune after testing). Rasters over the pixel limit are downscaled, never
  refused. Only input over the input cap is refused.
- The picker takes the profile from the slot that opened it. The emblem editor opens it with `emblem`.
  Add and Replace from that session use the emblem profile. The profile isn't stored on the Custom icon:
  a later Replace from a marker downscales to `icon`, which is the author's choice.
- Links have no size limit. Linking stays the encouraged path, and Armoria's SVG render is vector anyway.

### Picker

- The picker takes an optional preferred entry for when the current icon has none. The emblem slot
  prefers Custom.
- A **Heraldry** group lists one entry per charge category (conventional, crosses, beasts, …). Search
  covers charge names.

### Charges as Icon Sets

- The charge SVGs move from the public folder to the icon asset tree as one directory per charge category.
  Each category is its own Icon Set (`charges-<category>`), following the relief sets' one-set-per-directory
  pattern, so a map loads only the categories its emblems use. Symbol ids follow the one id rule
  (`charges-beasts-lionRampant`). The Armoria upload template isn't a charge and isn't shipped.
- The emblem model owns the charge sets, the way `Relief` owns the relief sets, and resolves a charge
  name to its icon reference through the catalog. Blazons keep storing charge names (`lionRampant`), since
  that is Armoria's vocabulary and the generator's. Inescutcheon charges stay built from shield paths,
  including Armoria's `inescutcheon<Shield>` variants, which the renderer now draws too.
- Charge files keep their coordinates in the 200-unit shield space the renderer's positions assume. The
  renderer draws each charge as a `<use>` of the set symbol, boxed so it lands exactly where today's
  inlined group lands. Tincture, `--secondary`, `--tertiary` and stroke keep inheriting from the charge
  group. Semy patterns reference the same symbols. A charge is defined once per page, not once per emblem.
- The charge sets declare a paint (a default tincture fill and dark stroke) for slots that set none, so
  charges read well as markers or in the picker.
- The service-worker route that cached charge files by extension goes. Set chunks are hashed assets,
  cached like the rest of the app, which removes the 100-file offline gap.
- The charges synced from Armoria (amphora, ant, caduceus, camelBactrian, chalice2, church, crancelin,
  gladius, hermit, kraken, polypus, seahorse, spider, stork, trident, violin) sit in their categories at
  generator weight 0 (done), so seeded generation is byte-identical.
- Emblem downloads include the charge and Custom icon symbols the emblem references, walking `href`
  dependencies the way map export already does.

### Armoria input

- A pure **Armoria reader** turns pasted text into one of: a blazon (from an edit link's `coa` parameter,
  an API link's `coa` parameter, or a bare or URI-encoded COA string) or an error with an author-facing
  message. Any other link, including Armoria seed or claim links (seeds aren't stable), is refused: other
  images go through the picture buttons.
- A pure **drawability check** answers whether FMG draws a blazon faithfully. With the renderer at
  Armoria parity, it fails only on names FMG doesn't ship: charges (for example Armoria-uploaded ones),
  shields, divisions, ordinaries, lines, patterns and diapers. The renderer and the check share the
  known-name lists, so they can't drift.
- A drawable blazon becomes a Heraldic emblem, keeping the entity's emblem `size`, `x` and `y`.
- An undrawable blazon becomes a Picture emblem whose icon is a linked Custom icon pointing at Armoria's
  SVG API render of that blazon. The editor says it was linked and why.
- "Edit in Armoria" on a Picture emblem whose Custom icon links an Armoria render opens Armoria with the
  blazon read back from that link. The link is the record, so no extra state is stored.
- The Armoria base URLs (GUI and API) are constants in one place.

### Armoria live updates (companion change in the Armoria repository)

- FMG opens Armoria with `from=FMG`, the blazon and a `session` token, and remembers which entity that
  token belongs to. Only the newest session per entity is live; it stays live for many updates.
- Armoria, when opened with `from=FMG` and a `window.opener`, posts
  `{ type: "armoria:coa", version: 1, session, coa, svg }` to the opener after every edit, undo and redo,
  once editing pauses for half a second. The unchanged original is not sent, nor anything once the map tab
  is closed. `coa` is the edited blazon and `svg` its rendered SVG, which FMG uses when the blazon isn't
  drawable (Armoria-uploaded charges).
- FMG accepts an update only from Armoria's origin, with a live `session`, for the loaded map, validates the
  payload shape and applies a session's updates in order: drawable → Heraldic emblem, otherwise the `svg`
  becomes a Custom icon at the emblem profile. One such icon per session is replaced by later updates and
  removed when a drawable update leaves it unused.
- The contract is versioned and documented in `docs/architecture/icons.md` next to the Armoria reader, and
  mirrored in Armoria's README.

### Migration

- An auto-update step turns each custom emblem into a Picture emblem. It reads the picture from the
  emblem's definition in the saved SVG, adds one Custom icon per distinct image with the whole box as its
  frame (no refit, so nothing moves), and keeps `size`, `x` and `y`. The old per-entity definitions are
  dropped. Maps that stored `"custom"` as a string still go through the existing earlier step first.

## Testing Decisions

- Tests exercise external behaviour: what a module returns for an input, or what the DOM shows after
  an action. They never test private helpers or markup details that don't matter to the result.
- **Armoria reader** (unit): every Armoria output shape (edit link, API link in SVG and PNG, encoded and
  bare COA strings, `#` escaping), non-Armoria links, seed and claim links, malformed JSON, non-`http`
  schemes.
- **Drawability check** (unit): a blazon per unsupported feature, an Armoria-uploaded charge, every
  shipped charge name, and all generator output over many seeds is drawable.
- **Charge sets** (unit, prior art: the relief coverage tests): every generator charge name resolves to
  exactly one file, names are unique across categories, and every file sits in a category the model
  lists.
- **Emblem renderer** (DOM, prior art: the existing renderer test): a Heraldic emblem renders the same
  geometry as before for a fixed set of blazons covering every charge (a reference rendering captured on
  master before the move). Picture emblems render clipped and unclipped. Semy patterns resolve.
- **Seed reproducibility** (unit, prior art: emblem generator tests): generated emblems for a fixed seed
  list are identical before and after the new zero-weight charges.
- **Picture profiles** (unit, prior art: pictures tests): the `emblem` profile downscales to its pixel
  limit and refuses only over its input cap, and the `icon` profile is unchanged.
- **Migration** (unit, prior art: auto-update tests): duplicate custom emblems collapse to one Custom
  icon, and `size`, `x` and `y` survive.
- **Send-to-map handler** (unit): wrong origin, stale session and malformed payload are ignored; a drawable
  payload applies the blazon; an undrawable one adds a picture.
- Checked in the browser: paste each Armoria shape, the send-back round trip with Armoria running
  locally, offline emblem rendering after first load, emblem PNG and SVG download, map SVG and PNG export.
  Unit tests, `tsc` and Biome must pass.

## Out of Scope

- **A heraldry editor inside FMG.** Armoria stays the editor.
- **Custom charges in FMG**, meaning uploading a charge for the generator to place. Blazons using
  Armoria-uploaded charges arrive as pictures.
- **Changing generator weights** or adding the new charges to procedural generation.
- **Claiming names on the Armoria API** from FMG.
- **Charge-level tincture control** when a charge is used outside an emblem, beyond the slot's usual
  fill and stroke.

## Further Notes

- The Armoria API is hosted separately from the GUI and was reachable at the time of writing. A linked
  render depends on it the way any linked Custom icon depends on its host. Drawable blazons avoid the
  dependency entirely, which is why they're always preferred.
- Charges total about 3 MB raw (1.1 MB gzipped), more than all other sets together. That is why they are
  split per category rather than shipped as one set.
- Browser storage is a few megabytes. A dozen 1024 px emblem pictures can approach it. The existing quota
  message applies, and the `.map` file remains the safe copy.
- Charge art is under mixed licences (CC0 for simple charges, CC BY-NC 3.0 for WappenWiki renders). The
  sources and licences in each file must survive the move. They go in the file's `<desc>` per the icon
  authoring rules, and the emblem editor keeps its licence link.

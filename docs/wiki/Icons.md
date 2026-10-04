Icons are the small pictures the map draws for its entities: burgs and ports, goods, markets, markers, regiments, military units and relief. Since version 1.154 they all come from one **Icon Library** and are chosen in one **icon picker**, so any picture can be used anywhere — a goods icon as a marker, an emoji as a regiment, your own drawing as a mountain.

This page explains where icons come from, how to pick them, how to bring your own pictures into a map and how they behave when you save, share and export the map.

## Where icons come from

The library has three sources:

- **Built-in icons** — the artwork shipped with the Generator, grouped into sets: settlements (the _Atlas_, _Watabou_ and _Illustrated_ burg styles, and port symbols), goods, relief and heraldic charges. They work on every map and cost nothing to store.
- **Emoji and text** — any emoji or short text such as `XIV`, `⟱` or `★`. The map stores only the text; the picture is drawn by your system's font, so emoji look different on Windows, macOS, Android and Linux.
- **Custom icons** — pictures you add to the map yourself, by linking to an image on the web or uploading a file. They belong to the map: they are saved in its `.map` file and travel with it when you share it.

## Where icons are used

| What | Where to change its icon |
| --- | --- |
| Burgs | _Style_ → _Icons_: select a burg group and click its icon. Every burg of the group uses it |
| Ports | _Style_ → _Icons_, the _Anchors_ card of the same burg group |
| Goods | _Tools_ → _Goods_: open a good and click its icon |
| Market marker | _Style_ → _Markets_: _Marker icon_ |
| Markers | Click a marker, then _select_ next to its icon. All markers of the same type change together |
| Marker types | _Markers Overview_ → generation settings: the icon of each type |
| Regiments | Click a regiment, then _change_ next to its icon |
| Military units | _Military Overview_ → _Units Editor_ (cog button): the icon column |
| A relief icon | Click it on the map to open the _Relief Editor_, then the **+** button at the bottom |
| Generated relief | _Biomes Editor_ → _Relief_ column (a biome's lowland relief), or the relief rules (mountain button) for hills and mountains: _Add any icon…_ |
| Picture emblems | _Emblems Editor_ → picture button; see [Emblems](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Emblems) |

Each of these is an **icon slot**, and every slot accepts every source.

## The icon picker

Every slot above opens the same _Select icon_ dialog.

- **The header** shows the icon currently selected and where it comes from. For a custom icon it also has the _Position_, _Replace_ and remove buttons.
- **The search box** finds built-in icons and emoji by name, e.g. `castle`, `wine` or `mount`.
- **The side list** holds _Custom_ (the map's own icons), then _Emoji_ by theme, _Settlements_, _Goods_, _Relief_ and _Heraldry_. Heraldry lists charges by category. Click a group to see its art; search also finds charges by name.
- **The tiles** — click one to select it. The map updates at once, so you can try icons before deciding.

Press _Apply_ to keep the selection, or _Cancel_ to go back to the icon you started with. Double-clicking a tile selects it and closes the dialog in one step.

The picker opens where the current icon is, so you can see its neighbours. On a phone the side list becomes a scrollable row above the tiles.

### Emoji and text

Open any _Emoji_ group and pick an emoji — there are over 500, from weapons and creatures to zodiac signs, colored markers and trade goods — or type into the _Type any short text_ field above the tiles: whatever you type becomes the icon as you type it. Short text works best — a letter, a number, a Roman numeral, a symbol. Emoji keep their own colors; text takes the color of the place it is drawn in.

## Custom icons

Open _Custom_ in the side list to see the icons this map carries and to add new ones.

### Adding an icon

There are two ways:

- **Add link** — paste a link to an image on the web (`https://…`) and press _Add link_ or <kbd>Enter</kbd>. The map stores only the link, so it stays small no matter how big the image is. This is the recommended way for large images.
- **Upload** — choose a file from your device:
  - an **SVG** file up to 200 kB. It is cleaned on upload: scripts, event handlers and links to other files are removed, and its styles are kept inside the icon so they cannot restyle the rest of the map;
  - a **PNG, JPEG or WebP** image up to 2 MB. It is shrunk to 256 px on its longer side and stored in a compact format, so a large photo does not bloat the map.

A new icon is **fitted** automatically: its frame is squared around the visible part of the picture with a small margin, so off-centre or heavily padded art comes out centred. The new icon is selected in the slot you opened the picker from.

The Emblems Editor opens the picker on _Custom_ and gives uploads more room: SVG files up to 1 MB and raster files up to 10 MB, shrunk to 1024 px on their longer side. These are input limits; a larger raster within 10 MB is scaled down automatically.

The same picture added twice becomes two separate icons. The _Custom_ page links to a few sources of free icons: [game-icons.net](https://game-icons.net), [The Noun Project](https://thenounproject.com), [OpenMoji](https://openmoji.org) and [Wikimedia Commons](https://commons.wikimedia.org). Check the licence of any art you use, especially for maps you publish.

### Link or upload?

| | Link | Upload |
| --- | --- | --- |
| Map file size | Tiny: only the address is stored | The picture is stored in the map |
| Works offline | No, the image loads from its site | Yes |
| If the site goes down or removes the image | The icon disappears | Not affected |
| Appears in PNG / JPEG exports | Only if the site allows it (see [Exports](#exports)) | Yes |

Some sites refuse to show their images on other pages. If a link is rejected with _The link does not open an image, or its site does not allow it_, download the image and upload it instead, or find another host.

### Positioning an icon

Select a custom icon and press _Position_ in the picker header to zoom and pan the picture inside its frame:

- drag the picture to move it, scroll or use the _Zoom_ slider to scale it;
- the dashed square is the frame; everything outside it is dimmed;
- the small previews below show the icon at map sizes, including on a goods circle;
- _Fit_ refits the frame to the visible picture, undoing your adjustments.

The map follows as you drag. _Apply_ keeps the new frame, _Cancel_ restores the old one. The frame belongs to the picture, so positioning an icon fixes it everywhere it is used. How big an icon is drawn stays a setting of each place: the marker's icon size, the burg group's size and so on.

Built-in icons and emoji cannot be positioned.

### Replacing an icon

Select a custom icon, press _Replace_, then link or upload the new picture. The icon keeps its identity, so every good, marker, burg group or relief icon using it shows the new picture at once — no need to reassign it one by one. Press _Cancel_ in the yellow note to stop replacing.

### Removing an icon

Select a custom icon and press the trash button. The confirmation tells you what uses it, e.g. _1 good, 12 markers_. Those places show no icon after the removal; pick them a new one if needed.

An icon you do not use yet stays in _Custom_, so you can prepare a set of pictures before placing them.

### Where custom icons are kept

Custom icons are part of the map's setup, like military units and transport types:

- they are **saved in the `.map` file**, so a shared map shows the same icons for everyone (linked icons need their site to be reachable);
- they are **kept in your browser**, and **carried over when you generate a new map**, so you do not have to add your pictures again;
- **loading another map replaces them** with that map's own icons.

The browser keeps a limited amount of data. If the icons outgrow it, a message says the latest settings are not kept in this browser. Nothing is lost: save the map and its icons are in the file. Linking instead of uploading, or uploading smaller images, avoids the limit.

### Moving icons to another map

_Download all_ in the _Custom_ tab saves the map's custom icons as a zip archive: one file per picture to look at, plus `icons.json` that restores them. On another map, _Import zip_ adds them back under the same identity, so goods, markers or style presets referencing them show them again. If the map uses an archived icon's identity for a different picture, you choose whether to replace it or keep the map's.

Style presets can reference custom icons too, but a preset stores only which icon to use, not the picture. A preset applied to a map that does not carry the icon draws nothing in that place; built-in icons and emoji work on every map. When you download a style preset that uses custom icons, the Style Saver offers to download them as a zip to import on the target map.

## Icon colors

Built-in art leaves some of its colors open so it can be recolored where it is drawn:

- **burg and port icons** take the burg group's fill and stroke (_Style_ → _Icons_). Illustrated icons keep their roofs, shadows and other painted details;
- **goods** are drawn on a circle of the good's color, with the line color and width of _Style_ → _Goods_;
- **relief** takes the stroke color and width of _Style_ → _Relief_;
- **markers** have _Icon colors_ in the marker editor: a fill and a stroke for the parts the icon leaves uncolored. The arrow button restores the icon's default colors. Emoji keep their own colors.

Elsewhere, and when a place sets no colors of its own, a built-in icon shows in its default paint: burg art white with a dark outline, goods and relief in their default line style. Custom icons keep the colors of their own picture; only an SVG that leaves its colors unset takes them from the place it is drawn in, like built-in art.

## Burg and port icons

Burg and port art stands on the burg: it is drawn around the burg's point, so a castle's base sits on the settlement, not its middle. Any other icon on a burg group — a goods icon, an emoji or a custom icon — is centred on the burg point instead.

The burg groups (capital, city, town, fort and so on) decide which icon a burg gets. Change the group of one burg in the Burg Editor, or the criteria in the Burg Groups configurator.

## Relief icons

Relief art has its own rules because it is generated in bulk:

- **The relief set** is chosen in _Style_ → _Relief_. Changing it restyles every relief icon of the map at once; nothing is regenerated.
- **Pinning to a set** — in the _Relief Editor_, the _Set_ selector draws the selected icon (or the icons you place with the brush) in a fixed set, whatever the style says. _Default (style)_ follows the style again.
- **Any icon** — the **+** button in the _Relief Editor_ gives the selected relief icon any icon from the library: your own mountain drawing, an emoji tree, a goods icon. Such an icon ignores the relief set.
- **Relief pools** — generated relief is picked from weighted lists of relief types and icons: each biome has one for its lowland relief (_Biomes Editor_ → _Relief_), and each relief rule has one for the hills and mountains it places. _Add any icon…_ adds any icon to a pool, including custom icons. See [User Interface](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/User-Interface#biomes) for pools and rules.

Every relief set draws every relief type. Where a set has no picture of its own for a type or variant, it uses its closest drawing, so switching sets never leaves gaps.

## Exports

- **SVG** exports contain the icons the map uses, including emoji and custom icons. Linked custom icons stay links, so the SVG shows them only while their site is reachable.
- **PNG and JPEG** exports include uploaded icons. Linked icons are included where their site allows other pages to read the image; otherwise they are left out of the image.

Before exporting, the Generator makes sure every icon set the map uses has loaded. If one cannot be loaded, for example after losing the connection, the export fails with a message instead of quietly dropping icons.

## Older maps

Maps from before 1.154 open unchanged and are converted on load:

- goods icons uploaded in older versions become custom icons;
- images pasted into markers, regiments and military units as a link or a `data:` image become custom icons, one per distinct image, so a marker type used a hundred times stores its picture once. Old custom emblems migrate the same way, keeping their size and position. Save the map again and the file gets smaller;
- emoji and text icons become emoji-and-text icons, and icon sizes stay the same.

## Troubleshooting

- **A linked icon does not show** — the site is down, has removed the image, or you are offline. Replace the icon with an upload to make the map independent of the site.
- **_Cannot load … icons_** — a set of built-in icons failed to download, usually because of a lost connection. Reload the page or retry the action; opening the picker on that set retries too.
- **An emoji looks different on another computer** — emoji are drawn by the system font. Use a built-in or custom icon when the exact look matters.
- **A custom icon is off-centre or too small** — use _Position_ or _Fit_ in the picker.
- **A burg or marker shows nothing** — its icon was a custom icon that has been removed, or it came from a style preset made on another map. Pick a new icon.

## Contributing artwork

The built-in icons are plain SVG files in the [`src/assets/icons`](https://github.com/Azgaar/Fantasy-Map-Generator/tree/master/src/assets/icons) folder of the repository, one folder per set. A new file in a set's folder appears in the picker with no code changes. The drawing conventions for each set are described in [docs/architecture/icons.md](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/docs/architecture/icons.md); open a pull request to propose new art.

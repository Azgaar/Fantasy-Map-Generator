# Style migration — manual test checklist

Branch `style-migration` (v1.143.3). Run in a browser against `npm run dev`. Everything below is
covered by automated tests only in part: the point of this pass is the paths a headless DOM check
cannot judge — that the map still *looks* right.

Handy console probes (F12):

- `style.layers` — the whole store
- `style.layers.terrs.children.landHeights.options` — a node's options
- `document.getElementById("terrs").outerHTML` — what actually reached the DOM
- `options.reliefDensity` — relief density (no longer a style value)

A failure is: the map changes appearance when it should not, does not change when it should, or the
store and the rendered SVG disagree.

---

## 1. Fresh map — the style editor, element by element

Generate a new map (`F2`). Open Style (the palette tab), and for **every** element in the
*Element* dropdown: change each visible input and confirm the map updates immediately, then change
it back and confirm it returns.

- [ ] Watch for a control that does nothing at all (a broken store write) or that changes the wrong
      thing (a wrong layer id).
- [ ] After each element, `style.layers.<id>` in the console holds the value you just set.

The eight **group-aware** elements have a second dropdown (the group) — for each, switch groups and
confirm the editor's inputs repopulate from the selected group, and that an edit only affects that
group's features on the map:

- [ ] Labels (state / burg / province / river / route groups — the group names are map-generated)
- [ ] Burg icons (capital / city / town / …)
- [ ] Anchors (capital / city / town / …)
- [ ] Borders (state / province)
- [ ] Lakes (freshwater / salt / sinkhole / frozen / lava / dry)
- [ ] Routes (roads / trails / sea routes)
- [ ] Coastline (sea islands / lake islands)
- [ ] Heightmap (`terrs`: land heights / ocean heights)

Also, not group-select driven but two-child: Regions — states body and the states halo. The halo
width must survive a zoom in and back out.

The two **options-heavy** elements:

- [ ] Heightmap (`terrs`): scheme, terracing, skip, relax, curve — separately for land and ocean
      heights. Each must repaint the heightmap; none may be written back as an SVG attribute
      (`#terrs > g` should carry only presentation attributes).
- [ ] Ocean layers: the layers list (e.g. `-6,-3,-1`), base fill and the oceanic pattern (href +
      opacity). Changing the layers list must redraw the ocean bands.

## 2. Preset switching

- [ ] Switch default → ancient → night → default. The map fully takes on each preset, and coming
      back to default looks exactly like the fresh map did.
- [ ] Switch default → pale → default with the relief layer on: relief icon **size** changes with
      the preset and comes back; icon **density** must not change (density is not a style value).
- [ ] Switch default → darkSeas → default: relief set/size survive the round trip.
- [ ] Switch to watercolor and gloom (texture and filter heavy) and back.
- [ ] After every switch, the style editor's inputs show the *new* preset's values, not the old.

## 3. Custom presets

- [ ] Edit a few styles, save as a custom preset (name it), and confirm it appears in the preset list.
- [ ] Switch away to another preset and back to the custom one — the saved look returns.
- [ ] Download the custom preset (a `.json` file). Open it: it should be `{"layers": {...}}`, not a
      flat `{"#selector": …}` map.
- [ ] Re-upload that file and apply it — same look.
- [ ] Delete the custom preset; it disappears from the list and the map falls back cleanly.

## 4. Legacy custom preset from localStorage

Simulate a preset written by an older build (console, then reload):

```js
localStorage.setItem("fmgStyle_oldOne", JSON.stringify({
  "#regions": {opacity: 0.9, filter: null},
  "#terrs": {scheme: "light", terracing: 30, skip: 5, relax: 1, curve: "curveBasisClosed"},
  "#markers": {rescale: 0, filter: null}
}));
```

- [ ] "oldOne" appears in the preset list and applies without console errors.
- [ ] Regions opacity 0.9 is visible; `style.layers.regions.presentation.opacity === 0.9`.
- [ ] The heightmap uses the light scheme; `style.layers.terrs.children.landHeights.options.scheme
      === "light"` and `#terrs > #landHeights` carries **no** `scheme` attribute.
- [ ] Markers do not rescale on zoom.

## 5. Save → reload round trip

- [ ] Edit at least six different styles across different layers (including a label group, a burg
      icon group, statesHalo width, and a heightmap scheme), save the map, reload the page, load the
      file back. Every edit is preserved, visually and in `style.layers`.
- [ ] Export to `.map`, then open the file in a text editor: data index 48 is the JSON style with a
      single `layers` key.

## 6. Loading old maps

For each of these, the map must load without console errors and look the way it did in the version
that saved it:

- [ ] `public/__fixtures__/1.139.4.map` (pre-1.140 format — styles are still SVG attributes)
- [ ] `demo.map`
- [ ] A map saved by a 1.140–1.142 build if you have one (styles in the `labels.groups` /
      `burgIcons` / `anchors` / `relief` bags)
- [ ] A map saved by **this branch**
- [ ] After each load: `style.layers` is populated (not empty), and the old option attributes
      (`data-size`, `scheme`, `rescale`, `layers`, `data-width`) are gone from the SVG.
- [ ] Label groups and burg-icon groups keep their per-group fonts/sizes on the old maps — this is
      the most fragile migration path.

## 7. Relief

- [ ] Style → Relief: change **set** (simple / colored / gray) — icons are replaced in place, the
      map does not regenerate.
- [ ] Change **size** — icons resize.
- [ ] Change **density** (Options, not Style) — relief **regenerates** with a different icon count.
- [ ] Confirm the reverse: no style change ever regenerates relief placement.
- [ ] Turn the relief layer off, switch preset, turn it back on — it comes back with the new set/size.

## 8. Heightmap scheme dialog

- [ ] Style → heightmap → create a custom colour scheme: the dialog opens, a scheme can be built and
      saved, and it becomes selectable and renders.
- [ ] Save the map with the custom scheme, reload, load it back — the scheme is still registered and
      the heightmap renders with it.

## 9. Singletons and options-projected layers

Each of these is still projected onto a single DOM element rather than being read from the store by
its renderer — they are the most likely to break:

- [ ] Texture: change the texture image and its x/y offset; toggle the layer off and on.
- [ ] Vignette: toggle on, change its rect (size/rx/ry/filter) and colour.
- [ ] Compass: toggle on, move/scale it, and confirm it is not wiped out by the first edit after a
      preset switch (this failed once during development on the darkSeas preset).
- [ ] Scale bar: change font size, bar size, label and the back-plate (fill/opacity/stroke/filter);
      confirm the bar re-lays out and stays legible after a zoom.
- [ ] Legend: toggle on, change font size, columns and position.
- [ ] Markers: change the rescale option and zoom — markers must scale (or not) accordingly.
- [ ] Emblems: toggle on, change per-type sizes (state / province / burg), zoom in and out — the
      "hide small emblems" behaviour must still hide/show at the right zoom.
- [ ] Goods: toggle on, change icon size/circle and burg-panel size.
- [ ] Armies: change font size and box size — regiment boxes and their text both follow.

## 10. Export

- [ ] Export SVG after several style edits: the exported file reflects the current look (open it in
      a browser).
- [ ] Export PNG at 1× and 3×: same look, no missing layers.
- [ ] Export SVG from a map loaded from an **old** file (§6) — the migrated styles must be in it.

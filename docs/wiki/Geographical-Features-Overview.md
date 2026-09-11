_Geographical Features Overview_ lists every **geographical feature** on the map — every island, every lake and every ocean the heightmap produced — in one table. Use it to find an unnamed island, name it, reclassify a lake, or see how the landmasses compare by area.

Open it from _Tools_ → _Features_, or press <kbd>Shift</kbd> + <kbd>F</kbd>.

## What a feature is

A feature is a continuous area enclosed by a coastline or the map border:

* an **island** — any landmass, from a continent down to a single-cell isle
* a **lake** — a water body surrounded by land
* an **ocean** — water that reaches the map border

Features come from the heightmap, so **they cannot be created or removed here**. To add an island, drown one, or split a landmass in two, use _Tools_ → _Heightmap_. This Overview changes only how a feature is named, classified and drawn.

## Type, subtype and group

Each feature carries three labels, and they mean different things:

* **Type** — `island`, `lake` or `ocean`. Decided by the shape of the terrain, and not editable
* **Subtype** — the classification within the type. Generators read it, so it carries meaning: `dry`, `frozen` and `lava` lakes cannot be sailed and get no ports, `isle` affects how cultures and provinces form, and several subtypes affect where goods and markers appear
  * islands: `continent`, `island`, `isle`, `lake_island`
  * lakes: `freshwater`, `salt`, `dry`, `sinkhole`, `frozen`, `lava`
  * oceans have none
* **Group** — the SVG group the feature is drawn in, and nothing more. It decides appearance, never behaviour. Two lakes can share a subtype and be drawn differently, or share a group and behave differently

The subtype list is fixed: you can pick a different one, but you cannot invent your own. Groups are the opposite — you can create as many as you like.

## Columns

* **Locate** (the target icon) — zoom to the feature. Oceans have no outline to zoom to
* **Feature** — the name. Only lakes are named by the generator, so most islands and every ocean start out as _Unnamed_. Type a name to set one; clear the field to make it _Unnamed_ again
* **Type** — the subtype, shown as _Freshwater lake_ or _Isle_. Editable for islands and lakes; the type itself (island, lake, ocean) comes from the heightmap and cannot be changed. _Lake island_ is shown as plain text: an island is inside a lake or it is not, and that is decided by geography
* **Group** — editable for lakes only. Islands show their group as text, since `sea_island` and `lake_island` follow from where the island sits
* **Area** — the area in the selected units. A feature that reaches the map border (every ocean, and islands cut by the edge) continues beyond the map, so its area is an estimate marked with `~`: the feature is assumed to keep its share of the map over the whole globe. Hover the value to see the area inside the map
* **Note** (the book icon) — edit free text notes (legend) for the feature
* **Edit** (the pencil) — open the _Lake Editor_. Lakes only; islands and oceans have no editor of their own

Click a column header to sort by it, and use the sliders icon in the header to show or hide columns.

## Changing a subtype does not regenerate anything

Turning a freshwater lake into a dry one relabels it. It does not remove the ports on its shore, move the goods around it, or recalculate anything else — exactly like the other editors. Regenerate burgs, routes or goods yourself if you want the world to catch up.

## Highlighting

Hover a row to trace the feature's outline on the map. Hover the map to highlight the row for the feature under the pointer. Oceans are not drawn as a shape, so an ocean row does not trace an outline, but hovering the sea still highlights its row.

## Filters

* **Search** — matches the name (_Unnamed_ included), the type and the subtype
* **Type** — narrow to islands, lakes or oceans
* **Subtype** — the options follow the selected type; with the type set to _all_, every subtype is offered

The filters are remembered while the map is open, and the footer shows how many features are displayed out of the total, with their combined area.

## Buttons

* **Refresh** — rebuild the table, for instance after editing the heightmap
* **Heightmap** — open the _Heightmap Editor_, where features are actually added and removed
* **Export** — save the listed features as a `.csv` file

## Oceans

Oceans are listed for completeness and are largely read-only: no subtype, no group, no outline to locate. You can still name one and give it a note — useful when your world has a named sea — though the note will not pop up on map hover, since an ocean has no shape to hover over. Open it from the _Notes Editor_ or the search bar instead.

## Lake groups

New groups are created in the _Lake Editor_ (click a lake on the map, or use the pencil in this table): pick a lake, click the plus next to _Group_, and give the group a name. Once it exists, it appears in the Group column here for every lake, and in the _Style Editor_ under the _lakes_ element, where you can give it its own colours. The group is saved with the map.

Removing a custom group in the Lake Editor moves its lakes back to _freshwater_ and drops its style. The six default groups cannot be removed.

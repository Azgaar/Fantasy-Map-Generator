## Marker overview
Markers are icons on the map representing a point of interest, e.g. a battlefield, a bridge, an inn, etc. You can toggle the markers layer on or off using the button on the Layers tab or the <kbd>K</kbd> hotkey. The _Markers Overview_ (<kbd>Shift</kbd> + <kbd>K</kbd>) lists every marker, lets you filter and remove them, and exports them as a `.csv` file.

## Marker generation and editing
After map generation the markers are randomly generated according to a set of criteria (e.g. bridges can only appear on rivers), and you can add your own markers anywhere you want (<kbd>Shift</kbd> + <kbd>3</kbd>, or _Tools_ → _Add_ → _Marker_). Each randomly generated marker has a relevant note attached. Notes on both generated and manually added markers can be edited in the Notes editor, which supports rich text.

To edit a marker, click its icon. A small window with the marker properties appears, where you can change:

* **Type** — style changes apply to all markers of the same type. Leave it blank to make the marker unique
* **Icon** — a Unicode character or an image URL / data URI
* **Size** — the marker element size in pixels and the icon size separately
* **Icon shift** — the icon offset by X and Y as a percentage; 50 centers the icon
* **Pin shape** and its **fill** and **stroke** colors

The buttons at the bottom let you edit the legend, show all markers within a radius of this one, lock the marker so regeneration does not touch it, add another marker of the same type and remove the marker.

### Generation settings
The _Markers Overview_ has a settings dialog listing every marker type with its icon, a **multiplier** and the current count on the map. Set a multiplier to 0 to stop a type from being generated, or raise it to get more of them. Some types (disturbed burials, rifts, portals) are only generated when a fantasy culture set is used, i.e. their default multiplier is 0 otherwise.

## Special markers
There are special markers for dungeons, which link to Watabou's one-page dungeon generator (https://watabou.itch.io/one-page-dungeon).  These special markers show a preview in the notes.  In the notes editor, click on the <> button to show the HTML code used for the preview.  You can use the same text to generate your own previews to dungeons.  The text is below:

`<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=573621350629" target="_blank" rel="noopener">One page dungeon</a></div>`
`<p><iframe src="https://watabou.github.io/one-page-dungeon/?seed=573621350629" sandbox="allow-scripts allow-same-origin"></iframe></p>`


You can create an image preview using the <> button and text similar to this:

`<p>Ruins of an ancient city. Untold riches may lie within.</p>`
`<p>&nbsp;</p>`
`<img src="https://upload.wikimedia.org/wikipedia/commons/4/43/Peru_Machu_Picchu_Sunrise.jpg" alt="Machu Picchu at sunrise" width="150" height="200" />`


You can also make a clickable link with an image preview:

`<p>Ruins of an ancient city. Untold riches may lie within.</p>`
`<p>&nbsp;</p>`
`<a href="https://yourwebsitehere.com">`
`<img src="https://upload.wikimedia.org/wikipedia/commons/4/43/Peru_Machu_Picchu_Sunrise.jpg" alt="Machu Picchu at sunrise" width="150" height="200" />`
`</a>`


## Marker criteria
Criteria and types of randomly added markers are defined in the generator and can change between versions. The current generator includes the following types:

* Battlefields: These are areas within a state that have a noticeable population, found in mid-elevation regions.
* Bridges: These are found in cities located near rivers, especially where the river is not close to the ocean and the water flow is significant.
* Brigands: Roads with high activity, usually where there’s a strong cultural presence, may attract outlaws.
* Canoes: These appear in regions with rivers, representing local watercraft.
* Circuses: Found in cultural areas with developed roads, particularly near or around sea level.
* Dances: These events take place in towns with a moderately sized population.
* Dungeons: Isolated and sparsely populated regions often feature these hidden or abandoned places.
* Hill Monsters: These creatures are found in highland areas where there is some population present.
* Hot Springs: Located in elevated regions, these natural thermal baths are found in hilly or mountainous areas.
* Inns: These rest stops appear along busy roads in well-populated areas.
* Jousts: Held in larger towns, especially in places with a robust population.
* Lake Monsters: Found in freshwater lakes, representing mythical creatures.
* Lighthouses: These are positioned along coastlines with good access to the sea and a large number of water routes.
* Migrations: These occur in sparsely populated midland regions where people or animals move.
* Mines: Found in towns located in higher elevations where valuable minerals may be extracted.
* Mirage: Seen in hot desert regions, these are illusions caused by extreme heat and light conditions.
* Pirates: Found on the open sea along major shipping routes, representing maritime outlaws.
* Portals: These mystical gateways appear in the oldest towns.
* Rifts: Occur in sparsely populated biomes that are still somewhat habitable, representing splits in the earth.
* Ruins: Found in mid-elevation cultural areas, these represent remnants of past civilizations.
* Sacred Forests: These appear in cultural regions with temperate forests, believed to be places of natural reverence.
* Sacred Mountains: Found in high mountain regions, close to cultural areas, these are considered spiritually important.
* Sacred Palm Groves: Found in desert regions with cultural significance and some population, connected by roads.
* Sacred Pineries: These are located in cultural areas within boreal forests.
* Sea Monsters: Mythical creatures found in the ocean along busy sea routes.
* Statues: These monuments appear in low to mid-elevation regions.
* Volcanoes: Found in very high mountain regions, representing active or dormant volcanic activity.
* Waterfalls: Located in hilly or mountainous areas with rivers, especially where there’s a sharp drop in terrain nearby.
* Water sources: cells above height 30 that have a river.
* Libraries: burgs with a culture and a noticeable population.
* Fairs: small burgs.
* Caves: populated cells at height 50 and above.
* Disturbed burials: populated land cells. Fantasy culture sets only.
* Necropolises: land cells with almost no population.
* Encounters: populated land cells.
* Party: a single movable marker placed in a burg, meant to track the current location of an adventuring party.

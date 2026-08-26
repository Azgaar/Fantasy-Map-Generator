## Marker overview
Markers are icons on the map representing a point of interest, e.g. a battlefield, a bridge, an inn, etc.  You can toggle the markers layer on or off using the button on the Layers tab.

## Marker generation and editing
After map generation, the markers are randomly generated according to a set of criteria (e.g. bridges can only appear on rivers), and you can add your own markers anywhere you want.  Each randomly generated marker has some randomly generated relevant notes attached.  Notes on both randomly generated markers and manually added markers can be edited.  Notes can have different fonts which you can edit in the notes editor.  You can also edit properties for markers like the icon, icon size, pin shape, pin colors, and position.  To edit a marker, click the marker icon.  A small window with marker properties will appear.  You can edit notes using the bottom-left button.

Icons can be a built-in emoji, any Unicode character, or a custom external image pasted as a URL or `data:image` URI — see [Custom icons](#custom-icons) below.  There is no upload button on the marker itself, but a custom SVG or raster icon is achievable by pasting its data URI.

**Same-type editing gotcha:** the marker editor's Type field controls more than labeling — changing the icon, icon size, icon shift, size, pin shape, or pin colors on one marker applies that change to **every marker sharing the same type**, not just the one you're editing.  If you want a one-off look for a single marker, clear its Type field first so it's treated as unique.

**Locking:** each marker has a lock toggle (the padlock button in the marker editor).  A locked marker is protected from the "Regenerate" action described below — regenerating markers will leave locked ones untouched while replacing unlocked ones.

## Custom icons
Click the _select_ button next to a marker's icon to open the Icon Selector. It has two sections:
* **Unicode emojis** — pick from the grid, or type/paste any Unicode character into the input field.
* **External images** — paste a link to an image (`http(s)://` or a `data:image/...` URI) and click _Add_, or click _Upload file_ to load a local SVG or raster image (up to 200kB) from disk; it is embedded into the map file as a data URI. Once added, the image appears as a swatch you can reuse for other markers, unit icons, etc.

There is no "no custom icons" limitation — any image reachable by URL, or any local SVG/PNG you upload, can be used as a marker icon this way.

## Markers Overview
Open it from the marker editor, or via _Tools_. It shows every marker on the map as a sortable, filterable table (by state, culture, type, and free-text search), with a Pin column and Lock column you can toggle per row, a CSV export button, and a button to trigger regeneration of all unlocked markers. Clicking a row highlights and can jump to the corresponding marker on the map.

## Markers In Radius
Opened from a marker's editor (the target-circle button), this dialog lists every other marker within a chosen radius (in the map's distance unit) of the selected one, lets you locate the source marker on the map, and export the in-range list as a CSV file.

## Generation Settings
Opened from the Markers layer's settings, this dialog lists every marker type with its icon, a generation _multiplier_ (scaling how many of that type get generated) and the current count of that type on the map. You can change a type's name, icon, or multiplier here, then click _Regenerate_ to apply the changes and re-run marker generation.

## Pin shapes and colors
Besides the icon itself, each marker sits on a colored "pin" shape. Twelve pin shapes are selectable: bubble, pin, square, squarish, diamond, hex, hexy, shieldy, shield, pentagon, heptagon, circle, and "no" (no pin, icon only). Fill and stroke colors for the pin are set independently via two color pickers. As with the icon, changing pin shape or colors on one marker affects every marker of the same type (see the gotcha above).

## Special markers
There are special markers for dungeons, which link to Watabou's one-page dungeon generator (https://watabou.itch.io/one-page-dungeon).  These special markers show a preview in the notes.  In the notes editor, click on the <> button to show the HTML code used for the preview.  You can use the same text to generate your own previews to dungeons.  The text is below:

`<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=573621350629" target="_blank" rel="noopener">One page dungeon</a></div>`
`<p><iframe src="https://watabou.github.io/one-page-dungeon/?seed=573621350629" sandbox="allow-scripts allow-same-origin"></iframe></p>`

Random Encounter markers work similarly: while online, their notes embed a live web page (`https://deorum.vercel.app/encounter/...`) generating a random encounter for the map's seed; if generated offline, a plain text description is used instead.

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

### Notes: AI generation and file transfer
The notes editor has a _Generate note with AI_ button (needs an AI provider configured, see the AI Chat wiki page) that writes a legend for you based on the marker's context. Notes can also be downloaded to a file on your PC and uploaded back from disk, so you can edit them externally or reuse a note set across maps.

### The Party marker
"Party" is a special marker representing the current location of an adventuring party, meant to be moved manually as the party travels; it uses a distinct pin (a red-stroked white pin) rather than the type's default styling and is not affected by the normal regeneration multipliers.

## Marker criteria
Criteria and types of randomly added markers are below:

* Battlefields: These are areas within a state that have a noticeable population, found in mid-elevation regions.
* Bridges: These are found in burgs with population over 20, on non-lake river cells where river flow exceeds the map's average flux — i.e. towns on a significant river, not close to a lake.
* Brigands: Roads with high activity, usually where there’s a strong cultural presence, may attract outlaws.
* Canoes: These appear in regions with rivers, representing local watercraft.
* Caves: Found in populated hilly or mountainous areas.
* Circuses: Found in cultural areas with developed roads, particularly near or around sea level.
* Dances: These events take place in towns with a moderately sized population.
* Disturbed Burials (fantasy-only): Found in elevated areas with a modest population — a burial site disturbed enough to raise the dead.
* Dungeons: Isolated and sparsely populated regions often feature these hidden or abandoned places.
* Encounters: Found in elevated areas with some population; embeds a live random-encounter web page when generated online, or a text fallback offline.
* Fairs: Found in small towns (population roughly between 5 and 20).
* Hill Monsters: These creatures are found in highland areas where there is some population present.
* Hot Springs: Located in elevated regions, these natural thermal baths are found in hilly or mountainous areas.
* Inns: These rest stops appear along busy roads in well-populated areas.
* Jousts: Held in larger towns, especially in places with a robust population.
* Lake Monsters: Found in freshwater lakes, representing mythical creatures.
* Libraries: Found in cultural towns with population over 10.
* Lighthouses: These are positioned along coastlines with good access to the sea and a large number of water routes.
* Migrations: These occur in sparsely populated midland regions where people or animals move.
* Mines: Found in towns located in higher elevations where valuable minerals may be extracted.
* Mirage: Seen in hot desert regions, these are illusions caused by extreme heat and light conditions.
* Necropolises: Found in elevated regions with very low population — the eerie opposite of a Disturbed Burial site.
* Party: Marks the adventuring party's current location; see [The Party marker](#the-party-marker) above.
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
* Water Sources: Found in elevated areas (height over 30) with a river present — springs, wells, and similar sources.
* Waterfalls: Located in hilly or mountainous areas with rivers, especially where there’s a sharp drop in terrain nearby.

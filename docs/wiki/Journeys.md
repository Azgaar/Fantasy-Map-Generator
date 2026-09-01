A **journey** is a planned route across the map: a named trip made of one or more legs, each with its own mode of travel. Journeys are drawn on their own _Journeys_ layer, saved inside the `.map` file and exported to `.csv`. Nothing about them is required: if you never open the dialogs, the one journey generated with each new map simply sits there as an example.

![Journeys on the map](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/journeys-layer.jpg)

## Opening the journey tools

- **Journeys Overview** — <kbd>Shift</kbd> + <kbd>J</kbd>, or _Tools_ → _Journeys_. Lists every journey on the map
- **Journey Editor** — click the pencil icon on a row in the Overview, or click a journey path directly on the map
- **Journeys layer** — toggle it on the _Layers_ tab. Opening either dialog turns the layer on automatically
- **Transport Types** — the cog button in either dialog

## Journeys and segments

A journey is an ordered list of **segments**. Each segment is one leg of the trip and holds its own data: where it starts and ends, how it is travelled, the path drawn on the map, and the distance, speed and time that follow from those.

This is what makes mixed travel work. A single trip can sail to a port, wait three days for a caravan, walk inland and ride the last stretch — each leg measured on its own terms, with the journey adding them up.

Segments are chained: a new segment starts where the previous one ended, so you normally only pick one new endpoint per leg.

## Transport types and travel domains

![Transport Types](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/transport-editor.jpg)

The **transport** chosen for a segment sets its default speed and decides where the leg is allowed to go. Every transport belongs to one of four **domains**:

- **land** — walking, wheels and hooves. Both endpoints must be on land. The route follows the road network wherever one exists and cuts across country where it does not, taking biome and elevation into account
- **water** — boats and ships. Both endpoints must be in water, on a coastal cell touching water (you board from the shore), or on a navigable river. The route uses the same sea lanes as the generator's own sea routes and can run up navigable rivers
- **air** — flight and magic. No restrictions; the route is a straight line
- **stay** — no movement at all. Used for time that is not travel: a night at anchor, a week of preparation, waiting out a storm. A stay covers no distance, but its hours still count toward the journey

There are 20 transport types by default, from _On foot (laden)_ to _Teleport_. Open the **Transport Types** dialog to change any of them or add your own — a magic carpet, a river barge, a giant eagle. Each type has:

- **Name** — segments refer to the transport by name, so renaming one used on the map breaks the link. You will be warned on load if a saved journey refers to a transport that no longer exists
- **Speed** — sustained travel speed, shown in your chosen distance unit per hour
- **h/day** — the **travel day**: how many hours of travel a day this transport sustains. A caravan walks about 8, a ship under sail runs 24. See [Distance, speed and time](#distance-speed-and-time)
- **Domain** — one of the four above

The transport set is remembered in your browser, so any types you add or edit carry over to your next map. The restore button brings back the 20 defaults and removes custom types.

## Building a journey

1. Open the _Journeys Overview_ (<kbd>Shift</kbd> + <kbd>J</kbd>) and click the **+** button to create an empty journey. Its editor opens
2. Click **+** in the editor to add the first segment. You are asked to click the start cell on the map, then the end cell
3. Pick a **transport** for the segment. The route is found automatically and its distance and time appear
4. Add the next segment. It starts where the previous one ended, so you only click its destination
5. Name the journey, set its **type** (free text — _Quest_, _Trade run_, whatever suits) and pick a color

Press <kbd>Esc</kbd> at any point to cancel the cell picking.

## Shaping the route

![Editing a path](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/journey-path-edit.jpg)

The automatically found route is a starting point. Each segment row has icons to change it:

- **Endpoints** — click the _From_ or _To_ name, then click a different cell on the map. The route is recomputed. The target icon next to it zooms to that place instead
- **Edit points** (pencil) — shows the path's control points. Drag a point to move it, click the path to insert a point, right-click a point to remove it. <kbd>Esc</kbd> finishes
- **Draw** (brush) — draw the whole path yourself, cell by cell. Click cells to add points, right-click to undo the last one, <kbd>Enter</kbd> or the brush icon again to finish, <kbd>Esc</kbd> to discard
- **On-road / off-road** (land segments only) — the signpost icon means the route prefers roads and travels at full speed; the tree icon means it avoids them and travels at half speed
- **Reset** — discards manual edits: recomputes the path from the endpoints and restores the default color, speed and time

Endpoints and the path between them follow different rules. A sea voyage may begin and end on a shore, because you board from land, but the path itself may only cross water or navigable river cells. If a transport cannot reach between the cells you picked — two ports in separate seas, two towns on different continents — you get an explanation rather than a route through impossible terrain. An **air** transport accepts any pair of cells.

A path you drew or reshaped by hand is protected: changing its endpoints or its transport asks for confirmation before overwriting your work.

## Distance, speed and time

![Journey Editor](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/journey-editor.jpg)

Distances use the unit set in the [Units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Scale-and-distance), and speeds that unit per hour.

Each segment's time is its distance divided by its speed. Turning those hours into days is where the **travel day** matters: nobody walks 24 hours a day. Every full travel day a transport sustains costs a whole calendar day, and the hours left over cost only themselves. Eight hours of walking is one day gone; a ship that sails around the clock loses nothing to rest.

The editor therefore shows two different totals:

- **Total time** — calendar time from start to finish, in days. This is the answer to "when do they arrive"
- **Travel time** — hours actually spent moving or waiting, with no travel day applied. This is the answer to "how long were they on the road"

A thousand miles on foot and a thousand miles under sail can report similar travel hours and very different total days.

Both numbers can be overridden per segment:

- Type into the **Speed** cell to change a leg's pace — a forced march, a laden cart
- Type into the **Time** cell to state the duration outright. An explicit time wins over the distance-and-speed calculation, which is handy when you already know the leg took a fortnight

Hiding a segment with the eye icon takes it off the map and out of the totals. Use it to keep an alternative route, or a leg not yet travelled, alongside the real one.

## Generated journeys

![Journeys Overview](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/journeys-overview.jpg)

Every new map is created with one journey already plotted, and the shuffle button in the Overview adds another.

These are not random lines between random points. The generator picks one of 18 **archetypes** — Quest, Caravan, Military campaign, Embassy, Pilgrimage, Raid, Smuggling run, Courier ride, Expedition, Refugee flight, Treasure hunt, Monster hunt, Exile's flight, Royal progress, Airship voyage, Arcane errand, Mercenary contract, Wandering — and the archetype shapes the whole trip: how the party travels and which transports it prefers, how likely it is to leave the roads, how often it stops over in a town or camps in the open, and how the journey and its legs are named. A caravan keeps to the roads and rests in towns; a raid does not.

The result is a route with named legs — _The road from Siv_, _A night at The Cracked Pike_, _Market day in Coimbralha_ — that you can keep, edit or delete. A map needs at least two burgs reachable from one another for a journey to be plotted at all.

## Journeys Overview reference

Columns: journey color and **name**, **type**, **from** and **to**, total **distance**, average **speed** and **total time**. Click a header to sort; use the icon at the top right to choose which columns to show. The search box filters by name, type or endpoint.

Per-row icons: edit, locate on the map, toggle visibility, lock, remove.

Hovering a row animates a traveller along the whole route, so you can watch the trip play out. Slow legs take visibly longer than fast ones and a stay pulses in place.

![Travel animation](https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/docs/updates/v1.150.0/screenshots/journey-travel.jpg)

Buttons along the bottom:

- **Refresh** — redraw the table
- **+** — create an empty journey
- **Shuffle** — generate a random journey
- **Style** — open the Style Editor for the _Journeys_ layer
- **Cog** — open _Transport Types_
- **Download** — export all journeys as `.csv`, one row per journey
- **Lock** — lock or unlock every journey
- **Trash** — remove all **unlocked** journeys. Locked ones are kept

## Journey Editor reference

Columns: segment color and **name**, **from** and **to**, **transport**, **distance**, **speed** and **time**, followed by the on-road toggle, visibility, edit points, draw, reset, move up and remove icons.

The line below the table holds the journey's color, name and type. Below that are its totals: distance, average speed, total time and travel time.

Buttons along the bottom: refresh, add a segment, open _Transport Types_, export the segments as `.csv` (one row per segment), and remove the journey.

Hovering a segment row animates just that leg on the map.

## Saving and export

Journeys are stored in the `.map` file along with everything else, included in the `.json` export, and preserved through _Submap_ and _Transform_. The layer is styled like any other through the Style Editor.

Both dialogs export `.csv`: the Overview gives one row per journey with its endpoints, distance, average speed, travel hours and total days; the Editor gives one row per segment with its transport, speeds, distances, time, endpoints and flags.
